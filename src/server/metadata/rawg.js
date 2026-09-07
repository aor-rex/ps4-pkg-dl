const axios = require('axios');

const PS4_PLATFORM_ID = 18;

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[™®©]/g, '')
    .replace(/['’]/g, '') // RAWG drops apostrophes: "monster's" -> "monsters"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** Edition suffixes stripped (end-of-title only) for variant slug attempts. */
const EDITION_SUFFIXES = [
  'game-of-the-year-edition',
  'game-of-the-year',
  'goty-edition',
  'goty',
  'complete-edition',
  'definitive-edition',
  'deluxe-edition',
  'deluxe',
  'anniversary-edition',
  'remastered',
  'remaster',
  'directors-cut',
  'directors-cut-edition',
  'ultimate-edition',
  'premium-edition',
  'collection-edition',
].sort((a, b) => b.length - a.length);

function stripEditionSlug(slug) {
  for (const suffix of EDITION_SUFFIXES) {
    if (slug.endsWith(`-${suffix}`)) return slug.slice(0, -(suffix.length + 1));
  }
  return slug;
}

/** Token overlap 0..1 between two slugs (significant words only). */
function tokenOverlap(a, b) {
  const words = String(a || '').split('-').filter((w) => w.length > 2);
  if (!words.length) return 0;
  const cand = String(b || '');
  return words.filter((w) => cand.includes(w)).length / words.length;
}

class RawgClient {
  constructor({ apiKey = '', timeout = 20000 } = {}) {
    this.apiKey = apiKey;
    this.http = axios.create({ baseURL: 'https://api.rawg.io/api', timeout });
  }

  get configured() {
    return !!(this.apiKey && String(this.apiKey).trim());
  }

  setApiKey(key) {
    this.apiKey = key || '';
  }

  async _get(path, params = {}) {
    if (!this.configured) throw new Error('RAWG API key not configured (Settings → Network → RAWG API key)');
    const res = await this.http.get(path, { params: { key: this.apiKey, ...params } });
    return res.data;
  }

  /** Raw candidate pool for manual matching: PS4-filtered + unfiltered searches, deduped. */
  async candidates(title, pageSize = 8) {
    const seen = new Map();
    for (const params of [
      { search: title, platforms: PS4_PLATFORM_ID, page_size: pageSize },
      { search: title, page_size: pageSize },
    ]) {
      let results = [];
      try {
        const data = await this._get('/games', params);
        results = data.results || [];
      } catch (e) {
        console.error(`[rawg] candidate search failed for "${title}": ${e.message}`);
      }
      for (const r of results) {
        if (r.id != null && !seen.has(r.id)) {
          seen.set(r.id, {
            rawgId: r.id,
            slug: r.slug || null,
            name: r.name,
            released: r.released || null,
            backgroundImage: r.background_image || null,
            rating: r.rating ?? null,
            ps4: this.hasPs4(r),
          });
        }
      }
    }
    return [...seen.values()];
  }
  async search(title, pageSize = 10) {
    const data = await this._get('/games', {
      search: title,
      platforms: PS4_PLATFORM_ID,
      page_size: pageSize,
    });
    return data.results || [];
  }

  async detail(rawgId) {
    return this._get(`/games/${rawgId}`);
  }

  async screenshots(rawgId) {
    const data = await this._get(`/games/${rawgId}/screenshots`, { page_size: 8 });
    return (data.results || []).map((s) => s.image).filter(Boolean);
  }

  async movies(rawgId) {
    const data = await this._get(`/games/${rawgId}/movies`, { page_size: 6 });
    return (data.results || [])
      .map((m) => ({
        name: m.name || 'Trailer',
        preview: m.preview || null,
        url: (m.data && (m.data.max || m.data['480'])) || null,
      }))
      .filter((t) => t.url);
  }

  /** Direct lookup by slug. 404 → null; other errors propagate. */
  async lookupBySlug(slug) {
    if (!slug) return null;
    try {
      const detail = await this._get(`/games/${slug}`);
      if (!detail || !detail.id) return null;
      return detail;
    } catch (e) {
      if (e.response && e.response.status === 404) return null;
      throw e;
    }
  }

  hasPs4(detailOrResult) {
    const plats = detailOrResult.platforms || [];
    return plats.some((p) => {
      const pl = p.platform || p;
      return pl.id === PS4_PLATFORM_ID || pl.slug === 'playstation4';
    });
  }

  /**
   * Verify a slug-direct hit is really the queried game.
   * RAWG slugs are unique, but a mangled query slug could collide —
   * the name check keeps that deterministic instead of lucky.
   */
  verifySlugHit(queryTitle, detail) {
    const want = slugify(queryTitle);
    const got = slugify(detail.slug || detail.name);
    if (got === want) return true;
    return tokenOverlap(want, got) >= 0.8;
  }

  async hydrate(detail, confidence) {
    const [full, screenshots, trailers] = await Promise.all([
      detail.name && detail.genres ? detail : this.detail(detail.id).catch(() => detail),
      this.screenshots(detail.id).catch(() => []),
      this.movies(detail.id).catch(() => []),
    ]);
    return {
      rawgId: detail.id,
      rawgSlug: detail.slug || null,
      name: full.name || detail.name,
      genres: (full.genres || []).map((g) => g.name).filter(Boolean),
      description: full.description_raw || full.description || null,
      metacritic: full.metacritic ?? null,
      rating: full.rating ?? null,
      backgroundImage: full.background_image || null,
      ps4: this.hasPs4(full && full.platforms ? full : detail),
      screenshots,
      trailers,
      confidence,
    };
  }

  /**
   * Full enrichment for a title.
   *  1. slug-direct (full, then edition-stripped) with name verify → exact
   *  2. PS4-filtered search, exact slug → exact
   *  3. PS4-filtered search, token overlap ≥0.6 → high
   *  4. Unfiltered search, token overlap ≥0.6 → high (RAWG under-tags PS4)
   *  5. null — no match beats a wrong match.
   */
  async enrichByTitle(title) {
    const want = slugify(title);
    if (want) {
      const variants = [want];
      const stripped = stripEditionSlug(want);
      if (stripped && stripped !== want) variants.push(stripped);
      for (const slug of variants) {
        const hit = await this.lookupBySlug(slug).catch((e) => {
          console.error(`[rawg] slug lookup failed for "${slug}": ${e.message}`);
          return null;
        });
        if (hit && this.verifySlugHit(title, hit)) {
          return this.hydrate(hit, 'exact');
        }
      }
    }

    const searches = [
      { params: { search: title, platforms: PS4_PLATFORM_ID, page_size: 10 } },
      { params: { search: title, page_size: 10 } },
    ];
    for (const { params } of searches) {
      let results = [];
      try {
        const data = await this._get('/games', params);
        results = data.results || [];
      } catch (e) {
        console.error(`[rawg] search failed for "${title}": ${e.message}`);
        continue;
      }
      if (!results.length) continue;
      const pickExact = results.find((r) => slugify(r.slug || r.name) === want);
      if (pickExact) {
        const detail = await this.detail(pickExact.id).catch(() => pickExact);
        return this.hydrate({ ...pickExact, ...detail }, 'exact');
      }
      let best = null;
      let bestScore = 0;
      for (const r of results) {
        const score = tokenOverlap(want, slugify(r.slug || r.name));
        if (score > bestScore) {
          bestScore = score;
          best = r;
        }
      }
      if (best && bestScore >= 0.6) {
        const detail = await this.detail(best.id).catch(() => best);
        return this.hydrate({ ...best, ...detail }, 'high');
      }
    }
    return null;
  }
}

module.exports = { RawgClient, slugify, PS4_PLATFORM_ID };
