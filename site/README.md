# Marketing site (`site/`)

Static landing page deployed to https://aor-rex.github.io/ps4-pkg-dl/ via
`.github/workflows/site.yml`. Plain HTML+CSS, no frameworks, no trackers.

## Per-release checklist

1. **Release pill** — update the `release-pill` text in `index.html`
   to the new tag (e.g. `v1.1.0`).
2. **Changelog excerpt** — hand-sync the three `changelog-entry` blocks
   in `index.html` from the top three sections of `CHANGELOG.md`
   (1–2 lines each, keep the link to the full log).
3. **Re-run** — commit on `main` touching `site/**`, `install.sh`, or
   `assets/icon.png` triggers the Pages workflow automatically;
   verify with `gh run watch` and a `curl` check.

## Notes

- Screenshots in `assets/` are resized to max width 1280 and compressed.
  Re-capture from the app when the UI changes visibly.
- `install.sh` and the launcher `icon.png` are synced into the Pages
  artifact by the workflow on every deploy — never copy them by hand.
  The one-liner served from this site is the canonical install method.
- Analytics: none shipped. If ever added, document it here and keep it
  opt-in and self-hosted.
