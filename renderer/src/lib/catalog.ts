/**
 * Map archive catalog entries (+ RAWG metadata) to the UI's Game shape.
 * Each PKG variant becomes one download group with a single
 * "Internet Archive" mirror whose url IS the direct PKG url, so the
 * existing GameDetail/MirrorModal flow works unchanged.
 */
import type { Game } from '../types';
import type { CatalogEntry, CatalogMetadata } from './backend';

/** Local fallback artwork (no third-party dependency, works offline). */
export const COVER_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="310" viewBox="0 0 220 310"><rect width="220" height="310" fill="#1e2b3b"/><text x="110" y="155" font-family="sans-serif" font-size="16" fill="#66c0f4" text-anchor="middle">No Cover</text></svg>`
  );

function archiveDescription(e: CatalogEntry): string {
  return `${e.title} [${e.titleId}] — Region ${e.region}, version ${e.version}. Direct PKG from the Internet Archive FPKGi collection.${e.minFw ? ` Requires firmware ${e.minFw}.` : ''}`;
}

export function entryToGame(e: CatalogEntry, index = 0): Game {
  return {
    id: e.id || `${e.titleId}-${index}`,
    title: e.title,
    slug: e.titleId,
    url: e.pkgUrl,
    cover: e.cover || e.coverUrl || '',
    size: e.size,
    sizeBytes: e.sizeBytes,
    region: e.region,
    version: e.version,
    date: e.date || '',
    genres: e.genres || [],
    description: archiveDescription(e),
    gallery: [],
    videos: [],
    downloads: [
      {
        type: 'PKG',
        size: e.size,
        mirrors: [
          { host: 'Internet Archive', url: e.pkgUrl, speed: 'Good', reliability: 'High' },
        ],
      },
    ],
  };
}

/** Merge RAWG metadata (genres, description, screenshots, trailers, rating). */
export function applyMetadata(game: Game, meta: CatalogMetadata | null): Game {
  if (!meta) return game;
  return {
    ...game,
    genres: meta.genres && meta.genres.length ? meta.genres : game.genres,
    description: meta.description || game.description,
    gallery: meta.screenshots && meta.screenshots.length ? meta.screenshots : game.gallery,
    videos: (meta.trailers || []).map((t) => ({
      url: t.url,
      title: t.name || 'Trailer',
      duration: '',
      // RAWG `preview` is a video clip, not an image — use the cover art.
      thumbnail: game.cover,
    })),
    metacritic: meta.metacritic,
    rating: meta.rating,
    hasMetadata: true,
  };
}

/** Merge all variants of a CUSA id into one Game with per-variant groups. */
export function variantsToGame(titleId: string, variants: CatalogEntry[], meta: CatalogMetadata | null = null): Game {
  if (!variants || variants.length === 0) {
    return {
      id: titleId,
      title: titleId,
      slug: titleId,
      url: '',
      cover: '',
      size: '',
      sizeBytes: 0,
      region: '',
      version: '',
      date: '',
      genres: [],
      description: '',
      gallery: [],
      videos: [],
      downloads: [],
    };
  }
  const first = variants[0];
  const base = entryToGame(first);
  const sourceNames = [...new Set(variants.map((v) => v.source).filter(Boolean))];
  const showSource = sourceNames.length > 1;
  const game: Game = {
    ...base,
    title: first.title,
    slug: titleId,
    downloads: variants.map((v) => ({
      type: `[${v.region}] v${v.version} — ${v.size}${showSource && v.source ? ` · ${v.source}` : ''}`,
      size: v.size,
      mirrors: [{ host: 'Internet Archive', url: v.pkgUrl, speed: 'Good' as const, reliability: 'High' as const }],
    })),
  };
  return applyMetadata(game, meta);
}
