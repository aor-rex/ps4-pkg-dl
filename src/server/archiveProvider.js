const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_CATALOG_URL = '';

function catalogCachePaths() {
  const dir = path.join(process.env.HOME || process.cwd(), '.ps4-pkg-dl');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    jsonPath: path.join(dir, 'games.json'),
    metaPath: path.join(dir, 'games.meta.json'),
  };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function filenameFromUrl(pkgUrl) {
  try {
    const p = new URL(pkgUrl).pathname;
    return decodeURIComponent(p.split('/').filter(Boolean).pop() || 'game.pkg');
  } catch {
    return 'game.pkg';
  }
}

function normalizeEntry(pkgUrl, raw, source) {
  const sizeBytes = Number(raw.size) || 0;
  return {
    id: `${raw.title_id || 'UNKNOWN'}:${crypto.createHash('md5').update(pkgUrl).digest('hex').slice(0, 8)}`,
    titleId: raw.title_id || 'UNKNOWN',
    title: raw.name || filenameFromUrl(pkgUrl),
    name: raw.name || filenameFromUrl(pkgUrl),
    slug: (raw.title_id || filenameFromUrl(pkgUrl)).toLowerCase(),
    region: raw.region || 'Unknown',
    version: raw.version || 'Unknown',
    sizeBytes,
    size: formatBytes(sizeBytes),
    minFw: raw.min_fw || raw.minFw || null,
    release: raw.release || null,
    pkgUrl,
    downloadUrl: pkgUrl,
    filename: filenameFromUrl(pkgUrl),
    cover: raw.cover_url || raw.coverUrl || '',
    coverUrl: raw.cover_url || raw.coverUrl || '',
    source: (source && source.label) || 'catalog',
    sourceId: (source && source.id) || null,
  };
}

function sourceIdFor(type, location) {
  return `src_${crypto.createHash('md5').update(`${type}:${String(location).trim()}`).digest('hex').slice(0, 8)}`;
}

function normalizeSource(s, index = 0) {
  const type = s.type === 'file' ? 'file' : 'url';
  const location = String(s.location || '').trim();
  return {
    id: s.id || sourceIdFor(type, location),
    type,
    location,
    label: s.label || (type === 'file' ? path.basename(location) : `Catalog ${index + 1}`),
    enabled: s.enabled !== false,
  };
}

class ArchiveProvider {
  constructor(options = {}) {
    this.ttlHours = options.ttlHours ?? 24;
    const paths = catalogCachePaths();
    this.jsonPath = paths.jsonPath;
    this.metaPath = paths.metaPath;
    // Back-compat: single catalogUrl option becomes one source
    const initial = Array.isArray(options.catalogs)
      ? options.catalogs
      : options.catalogUrl
        ? [{ type: 'url', location: options.catalogUrl }]
        : [];
    this.sources = initial.map((s, i) => normalizeSource(s, i));
    this.sourceState = new Map(); // id -> {fetchedAt, count, error}
    this.games = [];
    this.fetchedAt = null;
    this.loaded = false;
  }

  // ── source CRUD ────────────────────────────────────────────────
  getSources() {
    return this.sources.map((s) => ({ ...s, ...(this.sourceState.get(s.id) || {}) }));
  }

  setSources(list) {
    this.sources = (Array.isArray(list) ? list : []).map((s, i) => normalizeSource(s, i));
    this.loaded = false;
    this.games = [];
    this.fetchedAt = null;
  }

  static validateLocation(type, location) {
    const loc = String(location || '').trim();
    if (!loc) return 'Location is empty.';
    if (type === 'file') {
      if (!fs.existsSync(loc)) return `File not found: ${loc}`;
      return null;
    }
    if (!/^https?:\/\/.+/i.test(loc)) return 'URL must start with http:// or https://';
    return null;
  }

  static validateUrl(url) {
    return ArchiveProvider.validateLocation('url', url);
  }

  /** Parse + validate raw JSON text into normalized games (no side effects). */
  static parseCatalogJson(text, source) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Not valid JSON.');
    }
    const body = data && data.DATA ? data.DATA : data;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Not a games catalog: expected JSON object {DATA: {pkgUrl: {...}}}.');
    }
    const games = Object.entries(body).map(([pkgUrl, raw]) => normalizeEntry(pkgUrl, raw || {}, source));
    if (!games.length) throw new Error('Catalog is empty — no games found in this file.');
    games.sort((a, b) => a.title.localeCompare(b.title));
    return games;
  }

  async fetchSourceGames(source) {
    if (source.type === 'file') {
      let text;
      try {
        text = fs.readFileSync(source.location, 'utf8');
      } catch (e) {
        throw new Error(`Cannot read file: ${e.message}`);
      }
      return ArchiveProvider.parseCatalogJson(text, source);
    }
    let res;
    try {
      res = await axios.get(source.location, {
        timeout: 60000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'ps4-pkg-dl/0.1.0', Accept: 'application/json' },
      });
    } catch (e) {
      throw new Error(`Could not fetch URL (${e.message}). Check the link and your connection.`);
    }
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    return ArchiveProvider.parseCatalogJson(text, source);
  }

  /** Validate + add a source, refresh it, re-merge. Returns combined status. */
  async addSource({ type, location, label }) {
    const cleanType = type === 'file' ? 'file' : 'url';
    const problem = ArchiveProvider.validateLocation(cleanType, location);
    if (problem) throw new Error(problem);
    const source = normalizeSource({ type: cleanType, location, label }, this.sources.length);
    if (this.sources.some((s) => s.id === source.id)) throw new Error('This source is already added.');
    const games = await this.fetchSourceGames(source); // validates before committing
    this.sources.push(source);
    this.sourceState.set(source.id, { fetchedAt: Date.now(), count: games.length, error: null });
    this._merge();
    this.saveToDisk();
    return this.status();
  }

  async removeSource(id) {
    this.sources = this.sources.filter((s) => s.id !== id);
    this.sourceState.delete(id);
    this._merge();
    this.saveToDisk();
    return this.status();
  }

  async toggleSource(id, enabled) {
    const s = this.sources.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown source: ${id}`);
    s.enabled = enabled !== false;
    this._merge();
    this.saveToDisk();
    return this.status();
  }

  async refreshSource(id) {
    const s = this.sources.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown source: ${id}`);
    const games = await this.fetchSourceGames(s);
    this.sourceState.set(s.id, { fetchedAt: Date.now(), count: games.length, error: null });
    this._merge();
    this.saveToDisk();
    return this.status();
  }

  // ── loading / merging ──────────────────────────────────────────
  _merge() {
    const seen = new Set();
    const merged = [];
    for (const s of this.sources) {
      if (s.enabled === false) continue;
      const cached = this._sourceGames.get(s.id) || [];
      for (const g of cached) {
        if (seen.has(g.pkgUrl)) continue;
        seen.add(g.pkgUrl);
        merged.push(g);
      }
    }
    merged.sort((a, b) => a.title.localeCompare(b.title));
    this.games = merged;
    this.fetchedAt = Date.now();
    this.loaded = true;
  }

  _sourceGames = new Map(); // id -> games[] (in-memory per-source lists)

  isStale(id = null) {
    const ttl = this.ttlHours * 3_600_000;
    if (id) {
      const st = this.sourceState.get(id);
      if (!st || !st.fetchedAt) return true;
      return Date.now() - st.fetchedAt > ttl;
    }
    if (!this.fetchedAt) return true;
    return Date.now() - this.fetchedAt > ttl;
  }

  loadFromDisk() {
    try {
      if (!fs.existsSync(this.jsonPath)) return false;
      const raw = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.games || [];
      if (!list.length) return false;
      this.games = list;
      this._sourceGames.clear();
      for (const g of list) {
        if (!g.sourceId) continue;
        if (!this._sourceGames.has(g.sourceId)) this._sourceGames.set(g.sourceId, []);
        this._sourceGames.get(g.sourceId).push(g);
      }
      try {
        const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf8'));
        this.fetchedAt = meta.fetchedAt || null;
        if (Array.isArray(meta.sources)) {
          for (const s of meta.sources) this.sourceState.set(s.id, { fetchedAt: s.fetchedAt || null, count: s.count || 0, error: s.error || null });
        }
      } catch {
        this.fetchedAt = fs.statSync(this.jsonPath).mtimeMs;
      }
      this.loaded = true;
      return true;
    } catch {
      return false;
    }
  }

  saveToDisk() {
    try {
      fs.writeFileSync(this.jsonPath, JSON.stringify({ games: this.games }, 'utf8'));
      fs.writeFileSync(
        this.metaPath,
        JSON.stringify({
          fetchedAt: this.fetchedAt,
          count: this.games.length,
          sources: this.sources.map((s) => ({ id: s.id, ...(this.sourceState.get(s.id) || {}) })),
        }, 'utf8')
      );
      try {
        require('./metaView').stampSightings(this.games);
      } catch {
        /* sightings optional */
      }
    } catch (err) {
      console.error(`[archive] cache write failed: ${err.message}`);
    }
  }

  /** Back-compat: single-URL load (validates, replaces sources with one). */
  async loadUrl(url) {
    const problem = ArchiveProvider.validateUrl(url);
    if (problem) throw new Error(problem);
    this.setSources([{ type: 'url', location: String(url).trim() }]);
    const status = await this.refresh(true);
    if (!this.games.length) throw new Error('Catalog is empty — no games found in this file.');
    return status;
  }

  /** Back-compat shim. */
  setCatalogUrl(url) {
    const clean = String(url || '').trim();
    if (!clean) {
      this.setSources([]);
      return;
    }
    this.setSources([{ type: 'url', location: clean }]);
  }

  get catalogUrl() {
    const first = this.sources.find((s) => s.type === 'url' && s.enabled !== false);
    return first ? first.location : '';
  }

  async refresh(force = false) {
    if (this.loaded && !force && !this.isStale()) return this.status();
    if (!force && this.loadFromDisk() && !this.isStale()) return this.status();
    if (!this.sources.some((s) => s.enabled !== false)) {
      if (this.loadFromDisk()) return this.status();
      return this.status();
    }
    this._sourceGames.clear();
    for (const s of this.sources) {
      if (s.enabled === false) continue;
      try {
        const games = await this.fetchSourceGames(s);
        this._sourceGames.set(s.id, games);
        this.sourceState.set(s.id, { fetchedAt: Date.now(), count: games.length, error: null });
      } catch (err) {
        // isolate failures: keep previous games for this source if any
        const prev = this.sourceState.get(s.id) || {};
        this.sourceState.set(s.id, { fetchedAt: prev.fetchedAt || null, count: prev.count || 0, error: err.message });
        console.error(`[archive] source failed (${s.label}): ${err.message}`);
      }
    }
    this._merge();
    this.saveToDisk();
    console.error(`[archive] loaded ${this.games.length} games from ${this.sources.filter((s) => s.enabled !== false).length} source(s)`);
    return this.status();
  }

  async ensure() {
    if (!this.loaded) this.loadFromDisk();
    if (this.loaded && this.games.length) {
      try {
        require('./metaView').stampSightings(this.games);
      } catch {
        /* ignore */
      }
    }
    if (!this.loaded && !this.sources.some((s) => s.enabled !== false)) return this;
    if (!this.loaded || this.isStale()) {
      try {
        await this.refresh(false);
      } catch (err) {
        if (!this.loaded && !this.loadFromDisk()) throw err;
        console.error(`[archive] fetch failed, using stale cache: ${err.message}`);
      }
    }
    return this;
  }

  status() {
    return {
      configured: this.games.length > 0,
      count: this.games.length,
      fetchedAt: this.fetchedAt ? new Date(this.fetchedAt).toISOString() : null,
      stale: this.isStale(),
      loaded: this.loaded,
      sources: this.getSources(),
      // back-compat for older clients
      catalogUrl: this.catalogUrl || null,
    };
  }

  /**
   * List/search with pagination + filter + sort.
   */
  async list({ q = '', region = '', page = 1, limit = 50, sort = 'title', order = 'asc', onlyIds = null, addedMap = null } = {}) {
    await this.ensure();
    let out = this.games;
    if (onlyIds) {
      const set = onlyIds instanceof Set ? onlyIds : new Set(onlyIds);
      out = out.filter((g) => set.has(g.titleId.toUpperCase()));
    }
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter(
        (g) =>
          g.title.toLowerCase().includes(needle) ||
          g.titleId.toLowerCase().includes(needle) ||
          g.filename.toLowerCase().includes(needle)
      );
    }
    if (region) {
      out = out.filter((g) => g.region.toLowerCase() === region.toLowerCase());
    }
    const dir = order === 'desc' ? -1 : 1;
    out = [...out].sort((a, b) => {
      if (sort === 'size') return (a.sizeBytes - b.sizeBytes) * dir;
      if (sort === 'version') return String(a.version).localeCompare(String(b.version)) * dir;
      if (sort === 'region') return String(a.region).localeCompare(String(b.region)) * dir;
      if (sort === 'added') {
        const am = addedMap ? addedMap.get(String(a.titleId || '').toUpperCase()) || '' : '';
        const bm = addedMap ? addedMap.get(String(b.titleId || '').toUpperCase()) || '' : '';
        if (am !== bm) return (am < bm ? -1 : 1) * dir;
        return String(a.title).localeCompare(String(b.title));
      }
      return String(a.title).localeCompare(String(b.title)) * dir;
    });
    const total = out.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    page = Math.min(Math.max(1, page), pages);
    const items = out.slice((page - 1) * limit, page * limit);
    return { total, page, limit, pages, items };
  }

  /** All PKG variants for one CUSA id */
  async getVariants(titleId) {
    await this.ensure();
    const id = String(titleId).toUpperCase();
    return this.games.filter((g) => g.titleId.toUpperCase() === id);
  }

  async getByPkgUrl(pkgUrl) {
    await this.ensure();
    return this.games.find((g) => g.pkgUrl === pkgUrl) || null;
  }

  async getById(id) {
    await this.ensure();
    return this.games.find((g) => g.id === id) || null;
  }

  async regions() {
    await this.ensure();
    return [...new Set(this.games.map((g) => g.region))].sort();
  }
}

module.exports = { ArchiveProvider, DEFAULT_CATALOG_URL, formatBytes };
