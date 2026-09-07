# PS4 PKG Downloader (`ps4-pkg-dl`)

Desktop app (Electron + React) for browsing a user-supplied PS4 PKG catalog
and downloading packages with queue management, pause/resume, and history.

## How it works

1. **You supply a catalog.** Settings → Library → paste a `games.json` URL
   (FPKGi format: `{DATA: {pkgUrl: {title_id, name, version, size, cover_url}}}`).
   The app never ships with a catalog and hosts no files.
2. **Enrich (optional).** Paste a free RAWG key (`rawg.io/apidocs`) and press
   **Start backfill** — descriptions, genres, screenshots and trailers are
   matched per CUSA id and cached locally in SQLite.
3. **Download.** Pick a region/version → direct download with progress,
   pause/resume/cancel/retry, history in SQLite.

Some hosts (e.g. login-gated archive.org items) need your own login cookie:
Settings → Library → archive.org login.

## Run

- API + web UI: `npm run server` → http://localhost:3100
- CLI: `node src/cli/index.js --help` (`search`, `info`, `download`, `backfill`, …)
- Desktop: `npm run app` (Electron; UI in `../ps4-pkg-ui`)
- Operator notes: `docs/OPERATOR.md`

## Disclaimer — please read

**This software hosts no files.** All download links come from a catalog file
*you* provide; the app only reads, matches, and downloads from URLs you
supply. Game content belongs to its respective publishers — use this tool
for personal, educational, and preservation purposes in accordance with the
laws of your country. Not affiliated with Sony/PlayStation, the Internet
Archive, or RAWG. Game metadata, artwork and trailers are provided by
[RAWG](https://rawg.io) under their API terms.
