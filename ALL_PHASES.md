# PS4 PKG Downloader — All Phases Roadmap

**Project**: ps4-pkg-dl  
**Current Status**: Phase 1 ✅ Complete | Phase 2 🚧 In Progress (Core Implementation Done, Integration Pending)  
**Tech Stack**: Electron + React + Node.js

---

## Phase 1: Backend CLI Validation ✅ COMPLETE

**Goal**: Prove the core scraping pipeline works before building any UI.

### 1.1 Project Initialization ✅
- [x] Initialize npm project with dependencies
- [x] Create folder structure (`src/main/scraper/`, `src/main/downloader/`, `src/main/extractor/`, `src/cli/`)
- [x] Electron main process entry (placeholder for Phase 3)
- [x] Install all dependencies (axios, cheerio, puppeteer, commander, node-downloader-helper, node-7z)

### 1.2 Site Scraper ✅
- [x] Category page scraping (`dlpsgame.com/category/ps4/`) — 20 games/page
- [x] WordPress site search (`?s=query`) — with pagination
- [x] PS4 filter (slug must contain "ps4", case-insensitive)
- [x] Anti-bot bypass: axios → Puppeteer + stealth fallback on 403/429
- [x] Game detail extraction: title, cover, gallery images, YouTube videos, description, metadata
- [x] Ad-link decoding: shrinkearn.com/clk.sh base64 URL decoding
- [x] downloadgameps3.net multi-step scraping:
  - Decode shrinkearn → downloadgameps3.net main page
  - Extract plain text URLs from body (MediaFire direct links)
  - Follow sub-pages per mirror (archives/XXXXX) → more plain text URLs
- [x] Multi-host detection: MediaFire, 1Fichier, Akirabox, Viking File, FileCrypt, Google Drive, Mega, Rootz, UploadHaven
- [x] Rate limiting handling: delays between requests, retry logic

**Verified with real tests**:
- Search "fc 26" → 16 results found
- FC 26 → 98 mirrors (Akirabox 37, Viking 29, 1Fichier 31, Google Drive 1)
- Danganronpa V3 → 10 mirrors (MediaFire 3, 1Fichier 2, FileCrypt 1, Google Drive 1, Akirabox 3)

### 1.3 Link Resolver ✅
- [x] yt-dlp integration (child process) — `yt-dlp --get-url <mirror-url>`
- [x] Puppeteer fallback for unsupported hosts
- [x] Per-host resolvers: MediaFire, Viking File, Akiabox, GoFile
- [x] Host detection from URL
- [x] Filename extraction from URL

### 1.4 Download Engine ✅
- [x] node-downloader-helper wrapper
- [x] Pause/resume/cancel/retry support
- [x_] Progress tracking: speed, ETA, percentage, bytes downloaded
- [x] Retry logic with configurable attempts and delay
- [x] Event-based architecture (start, progress, complete, error, pause, resume, cancel)

### 1.5 Download Manager ✅
- [x] Queue-based system
- [x] Configurable concurrent downloads (1-5, default 2)
- [x] Auto-start next in queue when one completes
- [x] State tracking: active, queued, completed, failed, cancelled
- [x] Methods: add, pause, resume, cancel, retry, getStatus, getAll

### 1.6 Auto-Extract Module ✅
- [x] node-7z integration for .zip, .rar, .7z
- [x] Multi-part archive detection (.part1.rar, .r00, .001 patterns)
- [x] Validates all parts exist before extracting
- [x] Configurable extraction: subfolder, same directory, or custom
- [x] Delete archive after extraction (optional)
- [x] Directory watcher for auto-extract on download completion

### 1.7 CLI Interface ✅
- [x] `ps4dl search <query>` — site search with PS4 filter
- [x] `ps4dl info <slug>` — full game details with all mirrors
- [x] `ps4dl download <slug> --mirror` — download (framework ready)
- [x] `ps4dl status` — show download queue
- [x] `ps4dl resolve <url>` — resolve mirror URL (framework ready)
- [x] `ps4dl extract <file>` — extract archive (framework ready)
- [x] `ps4dl check` — system/yt-dlp configuration check
- [x] `ps4dl settings [key] [value]` — view/modify settings

### 1.8 Logger ✅
- [x] File rotation (10MB max, 5 files)
- [x] Colored console output (debug=cyan, info=green, warn=yellow, error=red)
- [x] Log levels: debug, info, warn, error
- [x] Timestamp formatting

### 1.9 Settings Manager ✅
- [x] JSON persistence at `~/.ps4-pkg-dl/settings.json`
- [x] All planned settings with defaults
- [x] Read/write via CLI
- [x] Auto-create config directory

### 1.10 Documentation ✅
- [x] `UI_SPECIFICATION.md` — complete UI design spec (16 sections)
- [x] `PROJECT_SCOPE.md` — project scope, tech decisions, risks
- [x] `IMPLEMENTATION_PLAN.md` — step-by-step implementation plan
- [x] `PHASE1_RESULTS.md` — Phase 1 test results

---

## Phase 2: Backend Core (Hardening + Persistence) 🚧 IN PROGRESS

**Goal**: Make the backend production-ready with database, caching, and live download testing.

### 2.1 Live Download Testing
- [ ] Test actual download from 1Fichier via yt-dlp
- [ ] Test actual download from MediaFire via yt-dlp
- [ ] Verify yt-dlp resolves direct download URLs correctly
- [ ] Test pause/resume mid-download with real file
- [ ] Test retry on network interruption
- [ ] Test download to custom directory
- [ ] Handle download errors gracefully (expired links, dead mirrors)

### 2.2 Live Extract Testing
- [ ] Test extraction with real multi-part .rar archive
- [ ] Test extraction with .zip archive
- [ ] Test extraction with .7z archive
- [ ] Test "delete after extract" option
- [ ] Test extraction to subfolder vs same directory
- [ ] Handle corrupt archives with clear error messages
- [ ] Handle password-protected archives (show warning)
- [ ] Handle incomplete multi-part sets (wait for all parts)

### 2.3 SQLite Database ✅
- [x] Set up `better-sqlite3` dependency
- [x] Create database schema (`games`, `game_images`, `game_videos`, `game_mirrors`, `downloads`, `settings`, `cache_meta`)
- [x] Create database module (`src/main/database/db.js`)
- [x] Create download history module (`src/main/database/downloads.js`)
- [x] Create game cache module (`src/main/database/cache.js`)
- [ ] Migrate settings from JSON to SQLite (Pending: `src/main/settings.js` still uses JSON)

### 2.4 Game Data Caching ✅
- [x] Cache scraped game data in SQLite (avoid re-scraping)
- [x] Cache expiration: refresh after 24 hours (implemented in `GameCache`)
- [x] Cache search results
- [x] Cache category listing
- [x] Cache download links (separate from game data — mirrors change frequently)
- [x] Cache invalidation: manual clear option via CLI

### 2.5 Error Handling Hardening
- [ ] Network timeout handling (configurable timeouts)
- [ ] Retry logic for scraping (already exists, improve robustness)
- [ ] Graceful degradation when site is down (use cached data)
- [ ] Error messages for common failures
- [ ] Log all errors to file for debugging
- [ ] Crash recovery (resume interrupted downloads on restart)

### 2.6 CLI Improvements ✅
- [x] Integrate Phase 2 logic into `src/cli/index.js`
- [x] `ps4dl history` — show download history from database
- [x] `ps4dl cache clear/stats/clean` — manage game data cache
- [x] `ps4dl db` — show database stats
- [x] `ps4dl pause/resume/cancel/retry <id>` — control downloads by ID
- [ ] Interactive mode: `ps4dl` (no args) → interactive menu
- [ ] Progress bar improvements: use `cli-progress` or similar for better visuals

### 2.7 Mirror Intelligence ✅
- [x] Mirror reliability tracking (track success/failure rate per host in `GameCache`)
- [ ] Auto-select best mirror based on past success rate
- [ ] Mirror status indicators (🟢 good, 🟡 moderate, 🔴 poor) based on actual performance (implemented in `GameCache` reliability scores)

### 2.8 Notification System ✅
- [x] Desktop notifications via `node-notifier` (`src/main/notifications.js`)
- [x] Download complete/failed notifications
- [x] Extraction complete/failed notifications
- [x] Configurable: enable/disable per notification type (implemented in `NotificationManager` and `src/cli/index.js`)

### 2.9 System Check Improvements
- [ ] `ps4dl check` — comprehensive system check:
  - yt-dlp availability and version
  - 7z/p7zip availability
  - Download directory exists and is writable
  - Disk space check
  - Network connectivity test
  - Cache status
  - Database status
- [ ] Auto-install suggestions if dependencies missing

---

## Phase 3: Frontend UI

**Goal**: Build the React UI per UI_SPECIFICATION.md, connected to the working backend via IPC.

*(Details omitted for brevity, see original plan for full spec)*

---

## Phase 4: Polish & Packaging

**Goal**: Ship a polished, distributable desktop application.

*(Details omitted for brevity, see original plan for full spec)*

---

*Last Updated: April 14, 2026*
