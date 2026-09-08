# PS4 PKG Downloader — UI (`ps4-pkg-ui`)

React + TypeScript + Vite + Tailwind frontend for `ps4-pkg-dl`.
Works two ways:

- **Inside Electron** — via the `window.ps4dl` IPC bridge (preloaded).
- **In any browser** — via the HTTP API (default `http://localhost:3100`,
  override with `VITE_API_URL` or `localStorage.ps4dl_api_url`).

With no backend reachable it renders empty states (no mock data).

## Develop

- `npm run dev` — Vite dev server (needs the API running: `npm --prefix ../ps4-pkg-dl run server`)
- `npm run build` — type-check + production bundle to `dist/` (served by the API at `/`)

## Disclaimer — please read

**This app hosts no files.** All download links come from a catalog file
*you* supply in Settings → Library; the app only reads, matches, and
downloads from URLs you provide. Game content belongs to its respective
publishers — personal, educational, and preservation use only, in accordance
with the laws of your country. Not affiliated with Sony/PlayStation, the
Internet Archive, or RAWG. Metadata, artwork and trailers by
[RAWG](https://rawg.io) under their API terms.
