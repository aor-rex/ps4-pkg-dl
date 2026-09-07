/** Shared metadata read helpers for the HTTP API and Electron IPC. */
const { dbManager } = require('../main/database/db');

function metaDb() {
  try {
    return dbManager.getDb();
  } catch {
    return null;
  }
}

function safeJsonArr(s) {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Batch-attach genres[] + hasMetadata to catalog items (one query). */
function attachMeta(items) {
  const db = metaDb();
  if (!db || !items.length) return items;
  try {
    const ids = [...new Set(items.map((g) => String(g.titleId || '').toUpperCase()))];
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT title_id, genres FROM metadata WHERE title_id IN (${placeholders})`).all(...ids);
    const map = new Map(rows.map((r) => [String(r.title_id).toUpperCase(), safeJsonArr(r.genres)]));
    return items.map((g) => {
      const genres = map.get(String(g.titleId || '').toUpperCase());
      return genres ? { ...g, genres, hasMetadata: true } : { ...g, genres: [], hasMetadata: false };
    });
  } catch {
    return items.map((g) => ({ ...g, genres: [], hasMetadata: false }));
  }
}

/** TitleIds (uppercased) whose metadata includes a genre (case-insensitive). */
function titleIdsForGenre(genre) {
  const out = new Set();
  const db = metaDb();
  if (!db || !genre) return out;
  try {
    const needle = String(genre).toLowerCase().replace(/"/g, '');
    for (const r of db.prepare('SELECT title_id, genres FROM metadata').all()) {
      if (safeJsonArr(r.genres).some((g) => String(g).toLowerCase() === needle)) {
        out.add(String(r.title_id).toUpperCase());
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Distinct genres with game counts, most popular first. */function genreCounts() {
  const counts = {};
  const db = metaDb();
  if (db) {
    try {
      for (const r of db.prepare('SELECT genres FROM metadata').all()) {
        for (const g of safeJsonArr(r.genres)) counts[g] = (counts[g] || 0) + 1;
      }
    } catch {
      /* ignore */
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Stamp first-seen rows for every CUSA in a game list (insert-only). */
function stampSightings(games) {
  const db = metaDb();
  if (!db || !games || !games.length) return 0;
  try {
    const ids = [...new Set(games.map((g) => String(g.titleId || '').toUpperCase()).filter((id) => /^CUSA\d{5}$/.test(id)))];
    if (!ids.length) return 0;
    const stmt = db.prepare('INSERT INTO catalog_sightings (title_id) VALUES (?) ON CONFLICT(title_id) DO NOTHING');
    const tx = db.transaction((list) => {
      let n = 0;
      for (const id of list) n += stmt.run(id).changes;
      return n;
    });
    return tx(ids);
  } catch {
    return 0;
  }
}

/** Map TITLEID -> first_seen ISO string (for added-date sort/display). */
function sightingsMap() {
  const map = new Map();
  const db = metaDb();
  if (!db) return map;
  try {
    for (const r of db.prepare('SELECT title_id, first_seen FROM catalog_sightings').all()) {
      map.set(String(r.title_id).toUpperCase(), r.first_seen);
    }
  } catch {
    /* ignore */
  }
  return map;
}

function toISODate(s) {
  if (!s) return '';
  const t = Date.parse(String(s).replace(' ', 'T') + 'Z');
  return isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
}

/** Attach added date (YYYY-MM-DD) to items as `date` (GameDetail "Added:" + newest/oldest sort). */
function attachAdded(items, map) {
  const m = map || sightingsMap();
  return items.map((g) => {
    const seen = m.get(String(g.titleId || '').toUpperCase());
    return seen ? { ...g, date: toISODate(seen) } : g;
  });
}

module.exports = { attachMeta, titleIdsForGenre, genreCounts, safeJsonArr, stampSightings, sightingsMap, attachAdded, toISODate };
