/**
 * Metadata adapter: CUSA-anchored match chain with SQLite cache.
 *
 *   catalog title/CUSA → cusa table (canonical Sony name) → RAWG exact slug
 *   → RAWG fuzzy fallback → store → return. Never throws.
 */
const fs = require('fs');
const path = require('path');
const { dbManager } = require('../../main/database/db');
const { RawgClient } = require('./rawg');
const { CusaTable, normalizeCusa } = require('./cusa');

function overridesPath() {
  const dir = path.join(process.env.HOME || process.cwd(), '.ps4-pkg-dl');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'metadata-overrides.json');
}

function resolveApiKey(settings) {
  if (process.env.RAWG_API_KEY && process.env.RAWG_API_KEY.trim()) return process.env.RAWG_API_KEY.trim();
  try {
    const k = settings.get('rawgApiKey');
    if (k && String(k).trim() && String(k).trim() !== '***set***') return String(k).trim();
  } catch {
    /* ignore */
  }
  return '';
}

class MetadataService {
  constructor({ settings, ttlDays = 30 } = {}) {
    this.settings = settings || null;
    this.ttlDays = ttlDays;
    this.rawg = new RawgClient({ apiKey: resolveApiKey(settings) });
    this.cusa = new CusaTable();
    this.db = dbManager.getDb();
  }

  refreshConfig() {
    this.rawg.setApiKey(resolveApiKey(this.settings));
    if (this.settings) {
      try {
        const ttl = this.settings.get('metadataTtlDays');
        if (ttl) this.ttlDays = ttl;
      } catch {
        /* ignore */
      }
    }
  }

  status() {
    return {
      rawgConfigured: this.rawg.configured,
      cusa: this.cusa.status(),
      ttlDays: this.ttlDays,
    };
  }

  _rowToMeta(row) {
    if (!row) return null;
    let stale = true;
    if (row.fetched_at) {
      // SQLite datetime('now') is UTC "YYYY-MM-DD HH:MM:SS" — parse as UTC
      const t = Date.parse(String(row.fetched_at).replace(' ', 'T') + 'Z');
      stale = !isFinite(t) || Date.now() - t > this.ttlDays * 86400000;
    }
    return {
      titleId: row.title_id,
      rawgId: row.rawg_id,
      rawgSlug: row.rawg_slug,
      name: row.name,
      genres: safeJson(row.genres, []),
      description: row.description,
      metacritic: row.metacritic,
      rating: row.rating,
      screenshots: safeJson(row.screenshots, []),
      trailers: safeJson(row.trailers, []),
      confidence: row.match_confidence,
      ps4: row.ps4 == null ? null : !!row.ps4,
      fetchedAt: row.fetched_at,
      stale,
    };
  }

  /** User-curated overrides {CUSA: rawgSlug|rawgId}. Tiny file, read per lookup. */
  getOverride(titleId) {
    const id = normalizeCusa(titleId);
    if (!id) return null;
    try {
      if (!fs.existsSync(overridesPath())) return null;
      const map = JSON.parse(fs.readFileSync(overridesPath(), 'utf8'));
      const v = map[id] ?? map[id.toLowerCase()] ?? null;
      return v == null || v === '' ? null : v;
    } catch {
      return null;
    }
  }

  setOverride(titleId, slugOrId) {
    const id = normalizeCusa(titleId);
    if (!id) throw new Error('Invalid CUSA id');
    let map = {};
    try {
      if (fs.existsSync(overridesPath())) map = JSON.parse(fs.readFileSync(overridesPath(), 'utf8')) || {};
    } catch {
      map = {};
    }
    map[id] = slugOrId;
    fs.writeFileSync(overridesPath(), JSON.stringify(map, null, 2));
    // drop any stale auto-match so the override takes effect next lookup
    this.remove(id);
    return { titleId: id, override: slugOrId };
  }

  listOverrides() {
    try {
      if (!fs.existsSync(overridesPath())) return {};
      return JSON.parse(fs.readFileSync(overridesPath(), 'utf8')) || {};
    } catch {
      return {};
    }
  }

  getCached(titleId) {
    const id = normalizeCusa(titleId);
    if (!id) return null;
    try {
      const row = this.db.prepare('SELECT * FROM metadata WHERE title_id = ?').get(id);
      const meta = this._rowToMeta(row);
      if (meta && !meta.stale) return meta;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Main entry: cached hit wins, then user override, else CUSA→RAWG enrich.
   * @param {string} titleId CUSA id
   * @param {string} catalogTitle fallback title from archive catalog
   * @param {{rawgId?: number}} opts manual override (one-shot, not persisted)
   */
  async get(titleId, catalogTitle = '', opts = {}) {
    const id = normalizeCusa(titleId);
    if (!id) return null;
    const cached = this.getCached(id);
    if (cached) return cached;

    try {
      await this.cusa.ensure();
    } catch (e) {
      console.error(`[metadata] cusa table unavailable: ${e.message}`);
    }
    if (!this.rawg.configured) return null;

    // 0. persisted user override wins over all automation.
    // A pinned override that resolves to nothing fails LOUDLY (null) —
    // falling through to automation would silently misattribute the game.
    const override = opts.rawgId || this.getOverride(id);
    if (override != null && override !== '') {
      try {
        const detail =
          /^\d+$/.test(String(override).trim())
            ? await this.rawg.detail(String(override).trim())
            : await this.rawg.lookupBySlug(String(override).trim());
        if (detail) {
          const enriched = await this.rawg.hydrate(detail, 'manual');
          this.save(id, enriched);
          console.error(`[metadata] enriched ${id} via override "${override}" (manual)`);
          return this.getCached(id);
        }
        console.error(`[metadata] override "${override}" for ${id} resolved to nothing — fix with: ps4dl metadata override ${id} <correct-slug|id>`);
      } catch (e) {
        console.error(`[metadata] override failed for ${id}: ${e.message}`);
      }
      return null;
    }

    const official = this.cusa.lookup(id);
    const candidates = [official && official.name, catalogTitle].filter(Boolean);
    let enriched = null;
    let usedTitle = null;
    try {
      for (const t of candidates) {
        enriched = await this.rawg.enrichByTitle(t).catch((e) => {
          console.error(`[metadata] rawg enrich failed for "${t}": ${e.message}`);
          return null;
        });
        if (enriched) {
          usedTitle = t;
          break;
        }
      }
    } catch (e) {
      console.error(`[metadata] enrich failed for ${id}: ${e.message}`);
      return null;
    }
    if (!enriched) return null;

    // confidence penalty when official name disagrees with catalog title
    if (enriched.confidence !== 'manual' && official && catalogTitle) {
      const a = slugSimple(official.name);
      const b = slugSimple(catalogTitle);
      if (a && b && a !== b && !a.includes(b) && !b.includes(a)) enriched.confidence = 'low';
    }

    this.save(id, enriched);
    console.error(`[metadata] enriched ${id} via "${usedTitle}" (${enriched.confidence})`);
    return this.getCached(id);
  }

    /** Delete a cached row (used to drop low-confidence bulk matches). */
  remove(titleId) {
    const id = normalizeCusa(titleId);
    if (!id) return 0;
    try {
      return this.db.prepare('DELETE FROM metadata WHERE title_id = ?').run(id).changes;
    } catch {
      return 0;
    }
  }

  save(titleId, m) {
    const id = normalizeCusa(titleId);
    if (!id) return;
    this.db
      .prepare(
        `INSERT INTO metadata (title_id, rawg_id, rawg_slug, name, genres, description, metacritic, rating, screenshots, trailers, match_confidence, ps4, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(title_id) DO UPDATE SET
           rawg_id=excluded.rawg_id, rawg_slug=excluded.rawg_slug, name=excluded.name,
           genres=excluded.genres, description=excluded.description, metacritic=excluded.metacritic,
           rating=excluded.rating, screenshots=excluded.screenshots, trailers=excluded.trailers,
           match_confidence=excluded.match_confidence, ps4=excluded.ps4, fetched_at=datetime('now')`
      )
      .run(
        id,
        m.rawgId || null,
        m.rawgSlug || null,
        m.name || null,
        JSON.stringify(m.genres || []),
        m.description || null,
        m.metacritic ?? null,
        m.rating ?? null,
        JSON.stringify(m.screenshots || []),
        JSON.stringify(m.trailers || []),
        m.confidence || 'fuzzy',
        m.ps4 == null ? null : m.ps4 ? 1 : 0
      );
  }

  stats(totalCatalog = 0) {
    let enriched = 0;
    let low = 0;
    try {
      enriched = this.db.prepare('SELECT COUNT(*) AS c FROM metadata').get().c;
      low = this.db.prepare("SELECT COUNT(*) AS c FROM metadata WHERE match_confidence = 'low'").get().c;
    } catch {
      /* table may not exist yet */
    }
    return { enriched, lowConfidence: low, catalogTotal: totalCatalog };
  }

  exportAll() {
    try {
      return this.db.prepare('SELECT * FROM metadata ORDER BY title_id').all();
    } catch {
      return [];
    }
  }

  importAll(rows) {
    if (!Array.isArray(rows)) throw new Error('snapshot must be an array');
    const stmt = this.db.prepare(
      `INSERT INTO metadata (title_id, rawg_id, rawg_slug, name, genres, description, metacritic, rating, screenshots, trailers, match_confidence, ps4, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(title_id) DO NOTHING`
    );
    const tx = this.db.transaction((list) => {
      let n = 0;
      for (const r of list) {
        if (!r.title_id && !r.titleId) continue;
        stmt.run(
          normalizeCusa(r.title_id || r.titleId),
          r.rawg_id ?? r.rawgId ?? null,
          r.rawg_slug ?? r.rawgSlug ?? null,
          r.name || null,
          typeof r.genres === 'string' ? r.genres : JSON.stringify(r.genres || []),
          r.description || null,
          r.metacritic ?? null,
          r.rating ?? null,
          typeof r.screenshots === 'string' ? r.screenshots : JSON.stringify(r.screenshots || []),
          typeof r.trailers === 'string' ? r.trailers : JSON.stringify(r.trailers || []),
          r.match_confidence || r.confidence || 'snapshot',
          r.ps4 == null ? null : r.ps4 ? 1 : 0,
          r.fetched_at || r.fetchedAt || new Date().toISOString()
        );
        n++;
      }
      return n;
    });
    return tx(rows);
  }
}

function safeJson(s, fallback) {
  try {
    const v = JSON.parse(s || '');
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function slugSimple(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

module.exports = { MetadataService };
