# Operator guide — ps4-pkg-dl server

End users set up their own library (Settings → Library). This page is
for whoever runs the API (local Electron app, `node src/server/index.js`,
or `ps4dl server`).

## Library setup (user-owned)

1. User pastes a `games.json` URL → validated (`POST /api/catalog/load`)
   before anything is swapped. No catalog ships with the app.
2. User pastes their own free RAWG key (`rawg.io/apidocs`).
3. User presses **Start backfill** (Fill missing / Refresh all) and watches
   the progress bar. Misses get per-game Retry buttons.
4. Switching catalog URLs keeps metadata (keyed by CUSA) — only newLocked: **multi-catalog first, then full polish across all four areas**, Phase 3 parked. Here's the execution plan.

Phase 1: Multi-catalog + local file
===================================

1. **Settings migration** — `catalogUrl` → `catalogs[]` (`{id, type, location, label, enabled}`); existing URL auto-migrates to one entry. Old key removed after migration.
2. **Provider rework** — per-source load (URL fetch with current validation / file read + same shape check), source-tagged normalization, union merge deduped by PKG URL, same-CUSA-across-sources becomes variants with source labels. Failures isolate per source. Status: per-source + combined.
3. **Local file split** — Electron: picker stores path reference, re-read on launch/refresh, missing-file state. Browser: `POST /api/catalog/file` upload stored as managed source.
4. **Library UI** — source list (add URL / add file / toggle / refresh / remove + counts) replaces single-URL input; variant rows show source labels; backfill/progress/miss-retry operate on merged library unchanged.
5. **CLI** — `catalog add/list/remove/toggle` (replaces `catalog-set`).
6. **Verify** — two sources merged, dupe PKG listed once, disabled source excluded, bad URL + missing file + malformed JSON each fail cleanly, migration preserves existing setups.

Phase 2: Full UI polish (all four areas)
========================================

1. **Library setup UX** — first-run flow states, source-list interactions, backfill progress/miss presentation.
2. **Browse/detail visuals** — cards, detail layout, gallery/Lightbox, trailer presentation.
3. **Download manager** — bottom bar, queue interactions, state clarity.
4. **General cleanup** — spacing, theme consistency, empty states, toasts.

Polish is deliberately scoped after multi-catalog so it covers the new Library UI once instead of twice.

Say **go** and I start Phase 1 (migration + provider, then UI).
   CUSAs need enriching.

## Secrets (never in git)

| Secret | Where it lives | How to set |
|---|---|---|
| `rawgApiKey` | `~/.ps4-pkg-dl/settings.json` (outside the repo) or `RAWG_API_KEY` env (takes precedence) | Settings → Library, or `PUT /api/settings` |
| `iaCookie` | same as above / no env | Settings → Network |

Reads mask secrets as `***set***`; submitting the mask is a no-op.
Metadata snapshots contain game data only — safe to share.

## CLI parity

- `ps4dl catalog-set <url>` — validate + load a catalog URL
- `ps4dl backfill [--refresh]` — bulk enrich with console progress
- `ps4dl enrich <CUSA> [--rawg-id <id>]` — single enrich / override
- `ps4dl metadata stats|export|import`, `ps4dl cusa [--refresh]`
- `ps4dl catalog [--refresh]`, `ps4dl search/browse/info/download`, `ps4dl server`

## Notes

- Direct archive.org PKGs need no resolving. Items returning HTTP 401
  require the `iaCookie` login cookie (Settings → Network).
- Backfill is throttled (~1.2s/game, ~4 RAWG calls each) and resumable;
  job state persists in `~/.ps4-pkg-dl/backfill.json`.
