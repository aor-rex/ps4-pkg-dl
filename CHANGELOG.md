# Changelog

## [v0.1.1] - 2026-09-09 (beta)

### Fixes
- Fix desktop app bridge: catalog add, download-folder picker, update check, logs, cache and open-folder all work inside the AppImage again (the preload script failed to load, so the app silently fell back to the browser API)
- Adding a catalog URL in the desktop app no longer fails with a fetch error

### Polish
- Lightbox thumbnails now lazy-load, fixing janky image loading in the gallery

## [v0.1.0] - 2026-09-09 (beta)

First beta release (Linux AppImage).

### Features
- Multi-catalog library: add several `games.json` URLs or local files, enable/disable per source, per-source refresh
- RAWG enrichment (backfill): descriptions, genres, screenshots and trailers cached locally, with Fill-missing / Refresh-all scopes
- Manual match resolution: "Needs attention" list with RAWG candidates, pin-a-match, and a persistent ignore list
- Download manager: queue, pause/resume, cancel/retry, progress and ETA, login-gated archive.org support via your own cookie
- Collapsible sidebar (drag to resize, snaps to icon rail) with per-genre icons
- Full desktop UI: browse grid/list, game detail with gallery and trailers, settings, notifications with test button

### Fixes / Polish
- Honest empty states when offline instead of mock data; entry HTML never caches so refreshes pick up updates
- Solid toast notifications; download counts moved into the manager tabs
