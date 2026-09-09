const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DEFAULT_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/andshrew/PlayStation-Titles/master/Json/PS4_Titles.json';

function dataDir() {
  const dir = require('../../main/settings').getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Normalize any CUSA form to bare uppercase id: CUSA03173 */
function normalizeCusa(input) {
  if (!input) return null;
  const m = String(input).toUpperCase().match(/CUSA\d{5}/);
  return m ? m[0] : null;
}

/**
 * Local CUSA → official Sony title lookup (andshrew/PlayStation-Titles snapshot).
 * Offline after first sync; snapshot refreshed monthly.
 */
class CusaTable {
  constructor({ snapshotUrl = DEFAULT_SNAPSHOT_URL, ttlDays = 30 } = {}) {
    this.snapshotUrl = snapshotUrl;
    this.ttlDays = ttlDays;
    this.jsonPath = path.join(dataDir(), 'cusa-ps4.json');
    this.metaPath = path.join(dataDir(), 'cusa-ps4.meta.json');
    this.index = new Map();
    this.loaded = false;
  }

  status() {
    let fetchedAt = null;
    try {
      fetchedAt = JSON.parse(fs.readFileSync(this.metaPath, 'utf8')).fetchedAt || null;
    } catch {
      /* no meta */
    }
    return {
      entries: this.index.size,
      loaded: this.loaded,
      fetchedAt,
      stale: fetchedAt ? Date.now() - fetchedAt > this.ttlDays * 86400000 : true,
    };
  }

  async sync(force = false) {
    const st = this.status();
    if (!force && st.fetchedAt && !st.stale && fs.existsSync(this.jsonPath)) {
      this._load();
      return st;
    }
    console.error(`[cusa] downloading snapshot (${this.snapshotUrl})…`);
    const res = await axios.get(this.snapshotUrl, {
      timeout: 120000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'ps4-pkg-dl/0.1.0', Accept: 'application/json' },
    });
    if (!Array.isArray(res.data)) throw new Error('CUSA snapshot has unexpected shape');
    fs.writeFileSync(this.jsonPath, JSON.stringify(res.data));
    fs.writeFileSync(this.metaPath, JSON.stringify({ fetchedAt: Date.now(), count: res.data.length }));
    this._load();
    console.error(`[cusa] snapshot synced: ${this.index.size} entries`);
    return this.status();
  }

  async ensure() {
    if (this.loaded && this.index.size) return this;
    try {
      if (fs.existsSync(this.jsonPath)) {
        this._load();
        // refresh in background if stale, don't block
        if (this.status().stale) this.sync(false).catch((e) => console.error(`[cusa] background refresh failed: ${e.message}`));
        return this;
      }
    } catch (e) {
      console.error(`[cusa] disk load failed: ${e.message}`);
    }
    await this.sync(false);
    return this;
  }

  _load() {
    const raw = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
    this.index.clear();
    for (const e of raw) {
      const id = normalizeCusa(e.titleId);
      if (!id || !e.name) continue;
      if (!this.index.has(id)) {
        this.index.set(id, { name: e.name, contentId: e.contentId || null, region: e.region || null });
      }
    }
    this.loaded = true;
  }

  /** { name, contentId, region } | null */
  lookup(cusa) {
    const id = normalizeCusa(cusa);
    if (!id) return null;
    return this.index.get(id) || null;
  }
}

module.exports = { CusaTable, normalizeCusa, DEFAULT_SNAPSHOT_URL };
