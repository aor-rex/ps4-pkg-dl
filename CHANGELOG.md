# Changelog

## [v0.2.0] - 2026-09-11 (beta)

### Security
- Settings API no longer exposes the archive.org cookie or RAWG key to the renderer (masked on read, overwrite-only on write)
- Catalog-title directory traversal closed: download folders can never escape the download directory

### Features
- Manual Extract and Clear Cache buttons work now (previously dead — no backend behind them), with live extract progress events
- Re-download actually forces: payload (force + cover/region/version) reaches the queue instead of being dropped
- Interrupted downloads resume correctly after restart (restored engines start fresh and pick up partials)

### Fixes
- Download slots accounted honestly: pause frees, resume/retry respect the concurrency limit (re-queued when full) instead of wedging or over-filling
- Flaky-network errors auto-retry boundedly instead of stranding jobs in limbo; cancelling a queued item persists properly
- Cancel/Retry report failures instead of silently doing nothing; search pagination works in the desktop app
- "Newest/Oldest" sorting no longer scrambles unenriched catalogs; trailers support all YouTube link shapes and non-http(s) URLs are rejected
- Backfill hardened: miss list capped at 500 with totals, below-exact matches quarantined for manual review, key required for both scopes
- Invalid page/limit query params fall back to defaults instead of returning null-paged empties
- GitLab releases publish correctly (glab install + explicit package/API flow)

### Chore
- Legacy single-source `catalogUrl` removed from the settings-write path; lazy DB guards; Lightbox empty-gallery guard

## [v0.1.10] - 2026-09-10 (beta)

### Features
- Interrupted downloads survive restarts: paused, cancelled and in-progress queues are restored as paused, resumable in one click
- Auto-check toggle: silent launch update checks can now be switched off in General (manual Check for Updates always works)
- New downloads save as `{Title} [{CUSA}] [{Region}] [v{Version}].pkg` instead of URL-derived filenames (new queues only, existing files untouched)

### Fixes
- Lightbox Previous/Next/thumbnail clicks no longer close the viewer (events bubbled to the overlay closer)
- Settings → About no longer hosts updater controls; update channel, check, and progress live in a dedicated General section
- Raw catalog URLs removed from the app README (canonical links live in the catalog repo)

### Chore
- GitLab history reconciled (ancient pre-rewrite commits merged, tree unchanged) and tag-release CI mirrored there
- Catalog setup docs point at the `ps4-pkg-catalog` mirror + extras sources

## [v0.1.9] - 2026-09-10 (beta)

### Fixes
- Download rows can no longer show a blank game name: titles are trimmed with filename-derived fallback
- OS notifications actually work now: fixed icon path, Settings toggles honored live, missing events wired
- Changelog dialog renders markdown instead of raw text

### Features
- Animated toast notifications with per-type accents and dismiss transitions
- In-app notification center: bell with unread badge, history, clear and mark-read


## [v0.1.8] - 2026-09-09 (beta)

### Fixes
- Update downloads no longer freeze at 0%: progress events now reach the UI with transferred/total figures
- Stalled update downloads announce themselves with a retry action instead of sitting silently


## [v0.1.7] - 2026-09-09 (beta)

### Fixes
- Re-downloading a finished game no longer creates `file (1).pkg` duplicates: completed downloads are detected and surfaced in the Completed tab instead
- Completed downloads survive app restarts (rebuilt from history, missing files skipped)
- Removing a download clears its record but keeps the game file, and the row disappears immediately
- Update errors are channel-aware and human-readable (e.g. Stable with no stable releases says so plainly), shown persistently in Settings → About

### Features
- Completed rows have an explicit Download-again action for forced re-downloads, plus a tooltip clarifying Remove keeps the file
- Professional README rewrite (features, config locations, updating, contributing) and MIT license

## [v0.1.6] - 2026-09-09 (beta)

### Fixes
- In-app updates no longer offer the running version: availability now uses the updater's real signal plus a strict newer-version check
- Downloading an update without a staged offer fails cleanly with guidance instead of "Please check update first"
- install.sh rewritten: loud errors on every step, retries, visible progress with resume, dual-source version discovery

## [v0.1.5] - 2026-09-09 (beta)

### Fixes
- Fix main-process crash when downloading after checking for updates (updater events overwrote the download event sender)
- Update check no longer demands a production release: pre-releases are discovered when the channel allows
- Update failures now show a one-line message instead of a stack-trace and header dump

### Features
- Release channel setting (Settings → About): Pre-release or Stable, switchable anytime with an immediate re-check; downgrades stay blocked with an explanatory note instead

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
