# PS4 PKG Downloader — Implementation Plan

## Current Phase: Phase 1 — Backend CLI Validation

**Goal**: Prove the core pipeline works (scrape → resolve → download → extract) before building any UI.

---

## Step-by-Step Plan

### Step 1: Project Initialization
- [x] Create `package.json` with all planned dependencies
- [x] Create folder structure (`src/main/scraper`, `src/main/downloader`, `src/main/extractor`, `src/cli`, etc.)
- [x] Create Electron main process entry (`src/main/index.js`) — placeholder for now, CLI-only in Phase 1
- [ ] Run `npm install` to install all dependencies

### Step 2: Build dlpsgame.com Scraper (Category Page + PS4 Filter)

**File**: `src/main/scraper/dlpsgame.js`

**What it does**:
1. Fetch `https://dlpsgame.com/category/ps4/` using Cheerio (HTTP GET)
2. Parse the HTML to extract each game card:
   - Game title (from card heading/link text)
   - Slug/URL (e.g., `/bff-or-die-ps4-pkg/`)
   - Cover image URL (from `<img>` tag)
   - Game size (if visible on card, e.g., "45.2 GB")
   - Date added (if visible)
3. Apply PS4 filter: only keep games where slug contains "ps4" (case-insensitive)
4. Return array of game objects:
   ```javascript
   {
     title: "BFF or Die",
     slug: "bff-or-die-ps4-pkg",
     url: "https://dlpsgame.com/bff-or-die-ps4-pkg/",
     cover: "https://dlpsgame.com/wp-content/uploads/...",
     size: "45.2 GB",
     date: "2026-03-12"
   }
   ```
5. Handle pagination: scrape multiple pages if needed
6. Error handling: network errors, HTML structure changes, rate limiting

**Testing**: Run via CLI → `ps4dl search "god of war"` → should return matching PS4 games

### Step 3: Build Game Page Scraper (Individual Game Details)

**File**: `src/main/scraper/dlpsgame.js` (extends Step 2)

**What it does**:
1. Visit individual game page (e.g., `https://dlpsgame.com/bff-or-die-ps4-pkg/`)
2. Extract:
   - **Title**: `<h1>` or post title
   - **Cover image**: Featured image or first image in post
   - **Gallery images**: All `<img>` tags in post content (exclude icons, ads, thumbnails)
   - **YouTube videos**: Find `<iframe>` embeds or YouTube URLs in post content
   - **Description**: Post content text (strip HTML tags)
   - **Metadata**: Size, region, version (parse from text patterns like "Size: 45.2 GB", "Region: US", "v1.00")
   - **Download links**: All anchor links pointing to file hosts (MediaFire, Viking, Akiabox, etc.)
     - Group by file type: Base Game, Update, DLC (detect from link text/context)
     - Each link has: host name, URL, file size (if available)
3. Return structured game detail object:
   ```javascript
   {
     title: "BFF or Die",
     cover: "...",
     gallery: ["...", "...", "..."],
     videos: [
       { url: "https://youtube.com/watch?v=...", title: "Launch Trailer", duration: "4:32" }
     ],
     description: "Full game description text...",
     size: "45.2 GB",
     region: "US",
     version: "v1.00",
     date: "2026-03-12",
     downloads: [
       {
         type: "Base Game",
         size: "45.2 GB",
         mirrors: [
           { host: "MediaFire", url: "https://mediafire.com/file/..." },
           { host: "Viking File", url: "https://vikingfile.com/..." },
           { host: "Akiabox", url: "https://akiabox.com/..." }
         ]
       },
       {
         type: "Update v1.05",
         size: "2.1 GB",
         mirrors: [
           { host: "MediaFire", url: "https://mediafire.com/file/..." }
         ]
       }
     ]
   }
   ```

**Testing**: Run via CLI → `ps4dl info "bff-or-die-ps4-pkg"` → should show full game details

### Step 4: Integrate yt-dlp (Resolve Direct Download URLs)

**File**: `src/main/scraper/mirror-resolver.js`

**What it does**:
1. Accept a file host URL (e.g., `https://mediafire.com/file/abc123/game.pkg`)
2. Call yt-dlp as a child process:
   ```bash
   yt-dlp --get-url <file-host-url>
   ```
3. Parse yt-dlp output to get the direct download URL
4. Return the resolved URL:
   ```javascript
   {
     success: true,
     directUrl: "https://download.mediafire.com/.../game.pkg?token=...",
     filename: "game.pkg",
     filesize: 48500000000  // bytes
   }
   ```
5. Handle errors:
   - yt-dlp not installed → return error with install instructions
   - Host not supported by yt-dlp → flag for Puppeteer fallback
   - Network error / timeout → retry with configurable attempts
   - URL expired / invalid → return error

**Puppeteer Fallback** (if yt-dlp doesn't support a host):
1. Visit the file host page with Puppeteer (with stealth plugin to avoid bot detection)
2. Wait for download button to appear
3. Extract the actual download link (may involve clicking through wait timers, captchas)
4. Return the resolved URL

**Testing**: Run via CLI → `ps4dl resolve <mediafire-url>` → should return direct download URL

### Step 5: Build Download Engine (Queue, Pause, Resume, Progress)

**Files**: 
- `src/main/downloader/engine.js` — wraps node-downloader-helper
- `src/main/downloader/manager.js` — queue management, concurrent downloads

**What `engine.js` does**:
1. Accept a direct download URL, destination path, and options
2. Use `node-downloader-helper` to start download
3. Emit events:
   - `progress`: { percent, speed, bytesDownloaded, totalBytes, eta }
   - `complete`: { path, filename, size }
   - `error`: { message, retryable }
   - `paused`: {}
   - `resumed`: {}
4. Provide methods:
   - `start()` — begin download
   - `pause()` — pause download (resumeable)
   - `resume()` — resume paused download
   - `cancel()` — cancel and delete partial file
   - `retry()` — restart download from beginning

**What `manager.js` does**:
1. Maintain a queue of downloads items
2. Enforce max concurrent downloads setting (1-5, default 2)
3. When a download completes/fails, pull next item from queue
4. Track state of all downloads (active, queued, completed, failed)
5. Provide methods:
   - `add(url, destination, options)` — add to queue
   - `pause(id)` — pause specific download
   - `resume(id)` — resume specific download
   - `cancel(id)` — cancel specific download
   - `getStatus(id)` — get current status of a download
   - `getAll()` — get all downloads with state
   - `clearCompleted()` — remove completed downloads from list
   - `retryFailed()` — retry all failed downloads

**Testing**: Run via CLI → `ps4dl download "bff-or-die-ps4-pkg" --mirror mediafire` → should show progress in terminal

### Step 6: Build Auto-Extract Module

**File**: `src/main/extractor/extractor.js`

**What it does**:
1. Watch the download directory for completed files
2. Detect archive files by extension: `.zip`, `.rar`, `.7z`, `.part1.rar`, `.part01.rar`, etc.
3. For multi-part archives:
   - Detect all parts exist (e.g., `game.part1.rar`, `game.part2.rar`, `game.part3.rar`)
   - Only extract when ALL parts are present
   - Use the first part as the entry point for 7z
4. Extract to configurable destination:
   - Subfolder: `./Game Name/Game Name.pkg` (default)
   - Same directory: `./Game Name.pkg`
   - Custom directory: user-specified path
5. Options:
   - Delete archive after successful extraction (default: off)
   - Supported formats: `.zip`, `.rar`, `.7z` (configurable)
6. Handle errors:
   - Corrupt archive → log error, notify
   - Password-protected → log error, notify (PS4 PKGs shouldn't be password-protected, but some sites do it)
   - Incomplete parts → wait, don't extract
   - Disk space insufficient → log error, notify
7. Emit events:
   - `extracting`: { archive, destination }
   - `complete`: { archive, extractedFiles[], destination }
   - `error`: { archive, message }

**Testing**: Run via CLI → `ps4dl extract "game.pkg.zip"` → should extract to `./game.pkg/` or similar

### Step 7: Create CLI Interface

**File**: `src/cli/index.js`

**Commands**:

#### `ps4dl search <query>`
- Scrape dlpsgame.com category page
- Filter results by query (case-insensitive match on title)
- Display results in terminal table:
  ```
  #  Title                    Size       Date
  ─────────────────────────────────────────────────────
  1  God of War (PS4)         45.2 GB    Mar 12, 2026
  2  God of War Ragnarok      60.1 GB    Apr 1, 2026
  3  Spider-Man PS4           42.8 GB    Feb 20, 2026
  ```

#### `ps4dl info <slug>`
- Scrape individual game page
- Display full details:
  ```
  Title: God of War (PS4)
  Size: 45.2 GB
  Region: US
  Version: v1.00
  Date: Mar 12, 2026
  
  Gallery: 8 images
  Videos: 2 videos
  
  Download Options:
    Base Game (45.2 GB)
      - MediaFire: https://mediafire.com/file/...
      - Viking File: https://vikingfile.com/...
      - Akiabox: https://akiabox.com/...
    
    Update v1.05 (2.1 GB)
      - MediaFire: https://mediafire.com/file/...
  ```

#### `ps4dl download <slug> --mirror <host> [--part <type>]`
- Resolve download URL from specified mirror using yt-dlp
- Add to download queue
- Show progress in terminal:
  ```
  Downloading: God of War - Base Game.pkg
  ████████████░░░░░░░░░░░░░░ 45% | 12.4 MB/s | ETA: 18 min
  ```
- `--part` flag: specify which part to download (base/update/dlc), defaults to base
- `--all` flag: download all parts

#### `ps4dl status`
- Show all active downloads:
  ```
  Active Downloads:
    1. God of War - Base Game.pkg     45%  12.4 MB/s  ETA: 18 min  [pause] [cancel]
    2. Update v1.05.pkg               12%  4.2 MB/s   ETA: 8 min   [pause] [cancel]
  
  Completed:
    3. DLC Pack.pkg                   ✓  Extracted to ./DLC Pack/
  ```

#### `ps4dl extract <file>`
- Extract specified archive file
- Show progress:
  ```
  Extracting: game.pkg.zip → ./game.pkg/
  ████████████████████████ 100%
  Extracted 3 files to ./game.pkg/
  ```

#### `ps4dl resolve <url>`
- Resolve a file host URL to direct download link using yt-dlp
- Show result:
  ```
  Resolved: https://download.mediafire.com/.../game.pkg?token=...
  Filename: game.pkg
  Size: 45.2 GB
  ```

### Step 8: Logger System

**File**: `src/main/logger.js`

**What it does**:
1. Write logs to `~/.ps4-pkg-dl/logs/app.log`
2. Log levels: `debug`, `info`, `warn`, `error`
3. Format: `[2026-04-14 10:30:45] [INFO] Download started: game.pkg`
4. Console output for CLI: colored log lines
5. Log file rotation: max 10MB per file, keep last 5 files

### Step 9: Settings Manager

**File**: `src/main/settings.js`

**What it does**:
1. Load/save settings from JSON file: `~/.ps4-pkg-dl/settings.json`
2. Default settings:
   ```json
   {
     "downloadDir": "~/Downloads/PS4-PKGs",
     "createSubfolder": true,
     "maxConcurrentDownloads": 2,
     "speedLimit": null,
     "retryCount": 3,
     "retryDelay": 30,
     "ytdlpPath": "yt-dlp",
     "autoExtract": true,
     "extractFormats": [".zip", ".rar", ".7z"],
     "extractTo": "subfolder",
     "deleteArchiveAfterExtract": false,
     "downloadTimeout": 300,
     "connectionTimeout": 30,
     "useProxy": false,
     "proxyUrl": "",
     "notifyOnComplete": true,
     "notifyOnFailed": true,
     "notifyOnExtractComplete": true,
     "soundAlert": false,
     "desktopNotification": true
   }
   ```
3. Auto-detect yt-dlp path on first launch
4. Validate settings on load (use defaults if invalid)

### Step 10: Test Full Pipeline End-to-End

**Manual testing steps**:
1. Run `ps4dl search "god of war"` → verify results show PS4 games only
2. Run `ps4dl info "god-of-war-ps4-pkg"` (actual slug) → verify details, images, videos, download links
3. Run `ps4dl download "god-of-war-ps4-pkg" --mirror mediafire` → verify download starts and progresses
4. Pause/resume mid-download → verify it works
5. Wait for download to complete → verify auto-extract triggers
6. Run `ps4dl status` → verify all states shown correctly
7. Run `ps4dl extract "some-archive.zip"` → verify extraction works

**Success criteria**:
- ✅ Can search and find PS4 games from dlpsgame.com
- ✅ Can view full game details (images, videos, download links)
- ✅ Can resolve a direct download URL from at least one file host (MediaFire)
- ✅ Can download a file with visible progress, pause/resume works
- ✅ Can extract a completed archive automatically

---

## What Happens After Phase 1

### If Phase 1 succeeds:
- Move to **Phase 2: Backend Core** (error handling, SQLite database, caching, robust scraping)
- Then **Phase 3: Frontend UI** (React UI per UI_SPECIFICATION.md, connected to working backend via IPC)

### If Phase 1 fails at any point:
- **Scraping fails** (anti-bot, Cloudflare): Try Puppeteer with stealth plugin, or cache-based approach
- **yt-dlp fails** (host not supported): Build manual Puppeteer scraper for that specific host
- **Download fails** (expired links, captchas): Investigate alternative approach, possibly browser integration
- **Extraction fails** (corrupt files, passwords): Adjust extraction logic, add error handling

---

## Files to Create (in order)

1. `src/main/scraper/dlpsgame.js` — category + game page scraper
2. `src/main/scraper/mirror-resolver.js` — yt-dlp + Puppeteer link resolver
3. `src/main/downloader/engine.js` — download engine (node-downloader-helper wrapper)
4. `src/main/downloader/manager.js` — download queue manager
5. `src/main/extractor/extractor.js` — archive extraction (node-7z wrapper)
6. `src/main/logger.js` — logging system
7. `src/main/settings.js` — settings manager
8. `src/cli/index.js` — CLI entry point (commander.js)
9. `src/main/index.js` — already created (Electron main process placeholder)
10. `package.json` — already created

---

*Last Updated: April 14, 2026*
