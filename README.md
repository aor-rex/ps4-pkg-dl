# PS4 PKG Downloader

Browse your own PS4 PKG catalog, enrich it with artwork and metadata, and download packages with pause/resume and history — as a desktop app for Linux.

> **Beta (v0.1.0).** Linux AppImage first. Expect rough edges; please report them on the Issues page.

## Disclaimer — please read

**This software hosts no files.** All download links come from a catalog file *you* provide; the app only reads, matches, and downloads from URLs you supply. Game content belongs to its respective publishers — use this tool for personal, educational, and preservation purposes in accordance with the laws of your country. Not affiliated with Sony/PlayStation, the Internet Archive, or RAWG. Game metadata, artwork and trailers are provided by [RAWG](https://rawg.io) under their API terms.

## Download

Easiest (installs a launcher entry; re-run to update):

```sh
curl -fsSL https://cdn.jsdelivr.net/gh/aor-rex/ps4-pkg-dl@main/install.sh | bash
```

Or grab the `.AppImage` from the [Releases page](../../releases) manually, make it executable, and run it:

```sh
chmod +x PS4-PKG-Downloader-*.AppImage
./PS4-PKG-Downloader-*.AppImage
```

## How to use

1. **Add your catalog.** Settings → Library → paste a `games.json` URL (FPKGi format) or add a local file. The app ships with no catalog.
2. **Enrich (optional).** Paste a free RAWG key from [rawg.io/apidocs](https://rawg.io/apidocs) and press **Start backfill** — descriptions, genres, screenshots and trailers are matched per game and saved locally. Games it can't match show up under “Needs attention”, where you can pin the right match or ignore them.
3. **Download.** Open a game, pick a region/version, and download with progress, pause/resume, cancel and retry. Finished files land in your download folder.

Some hosts (e.g. login-gated archive.org items) need your own login cookie: Settings → Library → archive.org login.

## Advanced use

- Running the API + web UI separately, the CLI, and operator notes: see [docs/OPERATOR.md](docs/OPERATOR.md).
