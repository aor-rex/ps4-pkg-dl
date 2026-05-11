# PS4 Remote Installer - Project Conversation

## Project Context
- User: Computer Engineering student
- Goal: Build a web app for jailbroken PS4 to install fake fpkg games remotely
- Budget: Broke, no PS4 yet (learning project)
- Timeline: Uncertain when they'll get a PS4

## Original Request
User wanted to build a web application that:
1. Scrapes superpsx.com (PS4 section) and dlpsgame.com (PS4 section)
2. User clicks "Install" on web app
3. File downloads and installs to PS4 locally
4. One-click experience
5. Plan to make it a PKG (not very feasible but possible)

## Key Constraint
User explicitly rejected "phone-as-remote" approach - they want the web app to run on the PS4 browser itself.

## Architecture Discussed

### Three-Part Architecture
```
[PS4 Browser] → Web App (search/browse)
       ↓ click "Install"
[Backend] → Resolves link → POST to RPI
       ↓
[PS4 RPI] → Downloads and installs
```

### Problems Identified
1. **PS4 Browser Limitations**: Can't directly download from file hosts (1Fichier, Mediafire)
2. **Switching Issue**: Running web app + RPI simultaneously causes suspension issues
3. **Link Resolution**: Sites use redirect chains (shrinkme.io → 1Fichier → direct .pkg)

### Solutions Proposed
1. **Backend does heavy lifting**: Puppeteer for scraping, link resolution
2. **RPI (Remote PKG Installer)**: By flatz - listens on port 12800
3. **Keep RPI in foreground**: While browsing web app in another tab

### "One-Click" Flow
```
User clicks "Install" on Web App
     ↓
Backend scrapes site → finds direct .pkg URL
     ↓
Backend sends POST to PS4_IP:12800/api/install
     ↓
RPI receives command → starts downloading
```

## Edge Cases Discussed

### 1. Multipart RAR Files
- **Problem**: Games often come as split .rar (part1.rar, part2.rar)
- **PS4 Reality**: Cannot extract RAR files
- **Solution**: Backend downloads all parts → extracts to .pkg → serves to PS4

### 2. Link Protectors (ouo.io, shrinkme.io)
- **Problem**: Sites redirect through ad-filled link shorteners
- **Solution**: Puppeteer handles clicking through automatically

### 3. CAPTCHA / Cloudflare
- **Solution**: puppeteer-extra-plugin-stealth + manual relay fallback

### 4. 1Fichier Wait Times
- **Solution**: Real-Debrid API integration (~$3/month)

## Build Order Recommended

### Phase 1: Basic Relay (Start Here)
- Set up Node.js server
- Create endpoint that accepts .pkg URL
- Forward to RPI: `POST http://PS4_IP:12800/api/install`

### Phase 2: The Scraper
- Puppeteer + stealth plugin
- Navigate SuperPSX/DLPSGame PS4 sections
- Extract game title, cover, download links

### Phase 3: Link Resolver
- Handle redirect chains
- Extract final direct .pkg URL

### Phase 4: Web App UI
- TV-optimized (large buttons, high contrast)
- Search, game cards, install button, settings (PS4 IP)

### Phase 5: RPI Integration
- Send POST requests to RPI
- JSON payload structure

## Testing Without PS4
1. **Mock RPI Responses**: Create Express route that simulates RPI
2. **Postman/cURL**: Manually test install command JSON
3. **Test Scraper Separately**: No PS4 needed

## Existing Project Status (ps4-pkg-dl)
User has an existing project at `/home/aor_rex/Documents/12Projects/ps4-pkg-dl/`:

### Already Built (Phase 1 ✅)
- Site Scrapers: dlpsgame.com, superpsx.com, pkgps4.js
- Link Resolver: Resolves mirrors using yt-dlp + Puppeteer
- Download Engine: Queue-based with pause/resume/retry
- Auto-Extractor: Handles .zip, .rar, .7z
- CLI: `ps4dl search`, `info`, `download`, etc.
- SQLite Database: Caching, download history
- Notifications: Desktop alerts

### Phase 2 In Progress
- Live download testing
- Live extract testing
- Error handling hardening

## User's Current Issue
User says "its not complete" regarding the scraper API. Possible issues:
1. Need REST API server to expose scrapers via HTTP
2. Scrapers for superpsx.com or dlpsgame.com not fully working
3. Missing features in link resolution/download/extraction

## Key Requirements for PS4 Remote Install
1. **Static IP**: Set PS4 to static IP in router
2. **Keep RPI in foreground**: PS4 suspends background apps
3. **Same network**: Backend and PS4 on same network
4. **HTTP (not HTTPS)**: PS4 browser blocks mixed content

## RPI (Remote PKG Installer) Info
- Created by flatz
- Homebrew app for jailbroken PS4
- Opens web listener on port 12800
- Accepts install commands over network
- No USB needed - everything over WiFi/Ethernet

## Future Goal: PKG Homebrew
- Use OpenOrbis PS4 SDK
- C++ wrapper initializes Webkit
- Embed web app URL as homepage
- One app does everything (no switching needed)
- Warning: Cannot run custom app AND RPI simultaneously

---

*Note: User doesn't have a PS4 yet - this is primarily a learning project.*