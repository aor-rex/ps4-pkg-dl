<div align="center">

# PS4 PKG Downloader

Browse your own PS4 PKG catalog, enrich it with artwork and metadata, and download packages with pause/resume and history — as a desktop app for Linux.

[![release](https://img.shields.io/github/v/release/aor-rex/ps4-pkg-dl)](https://github.com/aor-rex/ps4-pkg-dl/releases)
[![platform](https://img.shields.io/badge/platform-linux-lightgrey)](https://github.com/aor-rex/ps4-pkg-dl/releases)
[![license](https://img.shields.io/github/license/aor-rex/ps4-pkg-dl)](./LICENSE)

</div>

> **v1.0.** If something misbehaves, please report it on the [Issues page](../../issues) with the app version (Settings → About) and what you were doing.

## Install

Easiest (installs a launcher entry; re-run to update):

```sh
curl -fsSL https://cdn.jsdelivr.net/gh/aor-rex/ps4-pkg-dl@main/install.sh | bash
```

If that fails (CDN hiccup), the same script from the alternate host:

```sh
curl -fsSL https://raw.githubusercontent.com/aor-rex/ps4-pkg-dl/main/install.sh | bash
```

Or grab the `.AppImage` from the [Releases page](../../releases) manually, make it executable, and run it:

```sh
chmod +x PS4-PKG-Downloader-*.AppImage
./PS4-PKG-Downloader-*.AppImage
```

## Features

- **Multi-catalog library** — add several `games.json` URLs or local files, enable/disable per source, refresh individually.
- **RAWG enrichment** — descriptions, genres, screenshots and trailers cached locally, with Fill-missing / Refresh-all scopes.
- **Manual match resolution** — games the matcher can't place land in a “Needs attention” list with RAWG candidates; pin the right match or ignore them persistently.
- **Download manager** — queue, pause/resume, cancel/retry, progress and ETA, plus login-gated archive.org items via your own cookie.
- **In-app updates** — automatic check on launch with prompt, download progress and restart-to-install; Pre-release/Stable channel choice in Settings → About.
- **First-run changelog** — a “What's new” dialog on every update, re-openable from Settings → About.

## How to use

1. **Add your catalog.** Settings → Library → paste a `games.json` URL (FPKGi format) or add a local file. The app ships with no catalog. Maintained sources (mirror + curated extras) live in the companion [ps4-pkg-catalog](https://gitlab.com/aor-rex/ps4-pkg-catalog) repo — grab the raw file URLs there.
2. **Enrich (optional).** Paste a free RAWG key from [rawg.io/apidocs](https://rawg.io/apidocs) and press **Start backfill**.
3. **Download.** Open a game, pick a region/version, and download with progress, pause/resume, cancel and retry. Finished files land in your download folder.

Some hosts (e.g. login-gated archive.org items) need your own login cookie: Settings → Library → archive.org login.

## Updating

- **Inside the app** (desktop): it checks on launch and offers updates from Settings → About. The **Stable** channel tracks tested releases; **Pre-release** gets every beta as it lands.
- **Via script**: re-run the install command above; it replaces the AppImage in place.

## Data & config

Everything lives under `~/.config/ps4-pkg-dl/` (XDG-aware; OS conventions kept on macOS/Windows):

| File | Contents |
|---|---|
| `settings.json` | Preferences: download dir, RAWG key, archive.org cookie, catalog sources, update channel |
| `ps4pkg.db` | Enriched metadata cache, download history, queue |
| `metadata-overrides.json` | Your pinned manual RAWG matches |
| `metadata-ignored.json` | Titles you ignored during enrichment |
| `catalog-uploads/` | Local `games.json` files you added |
| `logs/` | App logs (Settings → About → Open Config Folder) |

Secrets (RAWG key, archive.org cookie) are stored in plaintext — don't share the folder.

## Advanced use

Running the API + web UI separately, the CLI, and operator notes: see [docs/OPERATOR.md](docs/OPERATOR.md).

## Disclaimer — please read

**This software hosts no files.** All download links come from a catalog file *you* provide; the app only reads, matches, and downloads from URLs you supply. Game content belongs to its respective publishers — use this tool for personal, educational, and preservation purposes in accordance with the laws of your country. Not affiliated with Sony/PlayStation, the Internet Archive, or RAWG. Game metadata, artwork and trailers are provided by [RAWG](https://rawg.io) under their API terms.

## Contributing

Bug reports and feature requests: [open an issue](../../issues). Pull requests welcome — please keep the `feat:` / `fix:` commit-prefix convention so release notes generate correctly.

## License

MIT — see [LICENSE](./LICENSE).
