# Changelog

## [v0.1.4] - 2026-09-09 (beta)

### Features
- App icon is now the gamepad from the UI
- Download rows show the game cover, title, region and version
- First-run "What's new" dialog with the version changelog (also in Settings → About), shown once per version
- In-app updates in the desktop app: automatic check on launch, prompt with notes, download with progress, restart to install

### Fixes
- Sidebar no longer carries the redundant disclaimer and Active Downloads sections (the bottom download bar owns that)

## [v0.1.3] - 2026-09-09 (beta)

### Fixes
- Download progress no longer shows raw byte counts or "ETA: Infinity" — speeds render as MB/s and unknown ETAs stay blank
- Pause/resume actually report failures now instead of silently flipping back
- About's folder button opened the download folder; it is now "Open Config Folder" and a separate "Open Download Folder" button sits next to Browse in General

### Features
- One-command install/update: `curl -fsSL .../install.sh | bash` installs the AppImage plus a launcher entry; re-running updates

## [v0.1.2] - 2026-09-09 (beta)

### Fixes
- Downloads queue again in the desktop app (the app sent the wrong field name, so every queue attempt failed)
- "Remember my choice for this session" in the mirror picker is now actually wired: checking it skips the picker on later downloads while the app stays open
- All app data now lives under `~/.config/ps4-pkg-dl/` (XDG-aware, OS conventions kept elsewhere); existing `~/.ps4-pkg-dl/` content migrates automatically on first launch
- Search-to-detail no longer risks a blank screen: empty detail results fall back safely, detail reads are defensive, a crash shows a "Back to Browse" panel instead of black, and result clicks no longer race the search blur

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
