#!/usr/bin/env node
/** ps4dl CLI — thin wrapper over the archive catalog + download engine + API server. */
const { Command } = require('commander');
const { bootstrapContext } = require('../server/context');
const { createApp } = require('../server/app');

const ctx = bootstrapContext();
const program = new Command();

program.name('ps4dl').description('PS4 PKG Downloader — Internet Archive FPKGi catalog').version('0.1.0');

function printList(items, total, page, pages) {
  console.log('─'.repeat(100));
  console.log(`${'#'.padEnd(4)} ${'Title'.padEnd(45)} ${'CUSA'.padEnd(12)} ${'Region'.padEnd(8)} ${'Size'}`);
  console.log('─'.repeat(100));
  items.forEach((g, i) => {
    const n = String((page - 1) * items.length + i + 1).padEnd(4);
    const t = (g.title.length > 43 ? g.title.slice(0, 40) + '...' : g.title).padEnd(45);
    console.log(`${n} ${t} ${(g.titleId || '').padEnd(12)} ${(g.region || '').padEnd(8)} ${g.size}`);
  });
  console.log('─'.repeat(100));
  console.log(`Page ${page}/${pages} — ${total} total`);
}

program
  .command('search <query>')
  .description('Search the archive catalog')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-l, --limit <n>', 'Results per page', '20')
  .option('-r, --region <r>', 'Filter by region (USA/EUR/...)', '')
  .action(async (query, opts) => {
    const res = await ctx.archive.list({
      q: query,
      region: opts.region,
      page: parseInt(opts.page, 10),
      limit: parseInt(opts.limit, 10),
    });
    if (!res.total) return console.log('No games found.');
    printList(res.items, res.total, res.page, res.pages);
  });

program
  .command('browse')
  .description('Browse the catalog (paginated)')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-l, --limit <n>', 'Results per page', '20')
  .action(async (opts) => {
    const res = await ctx.archive.list({ page: parseInt(opts.page, 10), limit: parseInt(opts.limit, 10) });
    printList(res.items, res.total, res.page, res.pages);
  });

program
  .command('info <titleId>')
  .description('Show all PKG variants for a CUSA id (e.g. CUSA09267)')
  .action(async (titleId) => {
    const variants = await ctx.archive.getVariants(titleId);
    if (!variants.length) return console.log(`No game found for ${titleId}`);
    console.log(`\n${variants[0].title} — ${variants.length} variant(s):\n`);
    variants.forEach((v, i) => {
      console.log(`  ${i + 1}. [${v.region}] v${v.version} — ${v.size}\n     ${v.pkgUrl}`);
    });
    console.log();
  });

program
  .command('download <titleIdOrUrl>')
  .description('Queue a direct PKG download (CUSA id uses first variant; pass full URL for exact)')
  .action(async (titleIdOrUrl) => {
    let entry;
    if (/^https?:\/\//i.test(titleIdOrUrl)) entry = await ctx.archive.getByPkgUrl(titleIdOrUrl);
    else {
      const variants = await ctx.archive.getVariants(titleIdOrUrl);
      if (!variants.length) {
        console.error(`No game found for ${titleIdOrUrl}`);
        process.exit(1);
      }
      entry = variants[0];
      if (variants.length > 1) console.log(`Note: ${variants.length} variants; downloading first (${entry.region} v${entry.version}). Pass full PKG URL for exact.`);
    }
    if (!entry) {
      console.error('PKG not found in catalog.');
      process.exit(1);
    }
    const { id } = ctx.queuePkgDownload(entry);
    console.log(`Queued: ${entry.title} (${entry.size}) — id ${id}`);
  });

program
  .command('status')
  .description('Show download queue')
  .action(() => {
    const all = ctx.listDownloads();
    if (!all.length) return console.log('\nNo downloads in queue.\n');
    for (const d of all) console.log(`  ${d.status.padEnd(10)} ${d.progress}%  ${d.label}`);
  });

program
  .command('catalog')
  .description('Show catalog status / refresh')
  .option('--refresh', 'Force re-fetch games.json from the archive')
  .action(async (opts) => {
    if (opts.refresh) await ctx.archive.refresh(true);
    else await ctx.archive.ensure().catch(() => {});
    console.log(ctx.archive.status());
  });

program
  .command('catalog-set <url>')
  .description('Validate + load a user-supplied games.json URL')
  .action(async (url) => {
    try {
      const status = await ctx.archive.loadUrl(url);
      ctx.settings.set('catalogUrl', status.catalogUrl);
      console.log(`Catalog loaded: ${status.count} games`);
    } catch (err) {
      console.error(`Failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('backfill')
  .description('Enrich the whole catalog into the metadata DB (throttled, resumable)')
  .option('--refresh', 'Re-enrich even fresh entries (default: fill missing only)')
  .action(async (opts) => {
    const state = await ctx.backfill.start(opts.refresh ? 'refresh' : 'missing');
    if (state.status === 'error') {
      console.error(`Cannot start: ${state.error}`);
      process.exit(1);
    }
    console.log(`Backfill running (${state.total} targets) — polling progress…`);
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = ctx.backfill.snapshot();
      const pct = s.total ? Math.round((s.done / s.total) * 100) : 100;
      process.stdout.write(`\r  ${s.done}/${s.total} (${pct}%) exact:${s.exact} high:${s.high} missed:${s.missed.length} ${s.current ? s.current.titleId : ''}   `);
      if (s.status !== 'running') {
        console.log(`\n${s.status}: ${s.done}/${s.total} — exact ${s.exact}, high ${s.high}, missed ${s.missed.length}`);
        if (s.missed.length) {
          console.log('Missed:');
          for (const m of s.missed.slice(0, 30)) console.log(`  ${m.titleId}  ${m.title}  (${m.reason})`);
          if (s.missed.length > 30) console.log(`  …and ${s.missed.length - 30} more`);
        }
        break;
      }
    }
  });

program
  .command('server')
  .description('Start the Express API server')
  .option('-p, --port <n>', 'Port', String(ctx.settings.get('apiPort') || 3100))
  .action((opts) => {
    const port = parseInt(opts.port, 10);
    ctx.archive.ensure().catch((e) => console.error(`catalog warmup failed: ${e.message}`));
    createApp(ctx).listen(port, () => console.log(`API listening on http://localhost:${port}`));
  });

program
  .command('db')
  .description('Show database stats')
  .action(() => {
    console.log(require('../main/database/db').dbManager.getStats());
  });

// ── Metadata (RAWG enrichment) ───────────────────────────────────────
program
  .command('enrich <titleId>')
  .description('Enrich one CUSA with RAWG metadata (CUSA table → exact match → fallback)')
  .option('--rawg-id <n>', 'Force a specific RAWG game id (manual override)')
  .action(async (titleId, opts) => {
    const variants = await ctx.archive.getVariants(titleId).catch(() => []);
    const meta = await ctx.metadata.get(
      titleId,
      variants[0]?.title || '',
      opts.rawgId ? { rawgId: parseInt(opts.rawgId, 10) } : {}
    );
    if (!meta) {
      console.log(`No metadata match for ${titleId}. Try --rawg-id <id> from rawg.io.`);
      process.exit(1);
    }
    console.log(`${meta.name} [${meta.titleId}] (${meta.confidence})`);
    console.log(`  genres: ${(meta.genres || []).join(', ') || '—'}`);
    console.log(`  metacritic: ${meta.metacritic ?? '—'}  rating: ${meta.rating ?? '—'}`);
    console.log(`  screenshots: ${(meta.screenshots || []).length}  trailers: ${(meta.trailers || []).length}`);
    if (meta.description) console.log(`  ${meta.description.slice(0, 200)}…`);
  });

const metadataCmd = program.command('metadata').description('Metadata cache management');

metadataCmd
  .command('stats')
  .description('Show enrichment coverage')
  .action(async () => {
    await ctx.archive.ensure().catch(() => {});
    console.log(JSON.stringify({ ...ctx.metadata.status(), ...ctx.metadata.stats(ctx.archive.games.length) }, null, 2));
  });

metadataCmd
  .command('export [file]')
  .description('Export metadata snapshot (ships with the app so users run keyless)')
  .action((file) => {
    const fs = require('fs');
    const out = file || require('path').join(process.cwd(), 'metadata-snapshot.json');
    const rows = ctx.metadata.exportAll();
    fs.writeFileSync(out, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), metadata: rows }, null, 1));
    console.log(`Exported ${rows.length} entries → ${out}`);
  });

metadataCmd
  .command('import <file>')
  .description('Import a metadata snapshot (adds missing entries only)')
  .action((file) => {
    const fs = require('fs');
    const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
    const n = ctx.metadata.importAll(snap.metadata || snap);
    console.log(`Imported ${n} entries from ${file}`);
  });

metadataCmd
  .command('audit')
  .description('Review matches for the current catalog (flags suspects for manual override)')
  .action(async () => {
    await ctx.archive.ensure().catch(() => {});
    const seen = new Map();
    for (const g of ctx.archive.games) {
      const id = String(g.titleId || '').toUpperCase();
      if (/^CUSA\d{5}$/.test(id) && !seen.has(id)) seen.set(id, g.title);
    }
    const db = require('../main/database/db').dbManager.getDb();
    let ok = 0;
    let missing = 0;
    const suspects = [];
    for (const [id, title] of seen) {
      let row = null;
      try {
        row = db.prepare('SELECT name, match_confidence, ps4 FROM metadata WHERE title_id = ?').get(id);
      } catch {
        /* ignore */
      }
      if (!row) {
        missing++;
        console.log(`  ? ${id}  ${title}  (no metadata)`);
        continue;
      }
      ok++;
      // Names agreeing => fine even when RAWG forgot the PS4 tag (common).
      // Suspect = low confidence, or PS4-untagged AND names disagreeing.
      const namesAgree = similarEnough(title, row.name);
      const suspect =
        row.match_confidence === 'low' ||
        !namesAgree;
      const flag = suspect ? '  <-- CHECK' : '';
      console.log(`  ${row.match_confidence === 'exact' ? '✓' : '~'} ${id}  ${title}  →  ${row.name}${row.ps4 === 0 ? ' [not tagged PS4]' : ''}${flag}`);
      if (suspect) suspects.push({ id, title, rawgName: row.name, confidence: row.match_confidence });
    }
    console.log(`\n${ok}/${seen.size} enriched, ${missing} missing, ${suspects.length} suspects`);
    if (suspects.length) console.log('Fix with: ps4dl metadata override <CUSA> <rawg-slug|id>');
    function similarEnough(a, b) {
      const norm = (s) =>
        String(s || '').toLowerCase().replace(/[™®©]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '');
      const x = norm(a);
      const y = norm(b);
      if (!x || !y) return false;
      if (x === y || x.includes(y) || y.includes(x)) return true;
      const words = String(a).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      if (!words.length) return false;
      const hit = words.filter((w) => norm(b).includes(w.replace(/[^a-z0-9]/g, ''))).length;
      return hit / words.length >= 0.5;
    }
  });

metadataCmd
  .command('override <cusa> <slugOrId>')
  .description('Pin a manual RAWG match (slug or numeric id), stored in metadata-overrides.json')
  .action(async (cusa, slugOrId) => {
    const saved = ctx.metadata.setOverride(cusa, /^\d+$/.test(slugOrId) ? parseInt(slugOrId, 10) : slugOrId);
    console.log(`Override saved: ${saved.titleId} → ${saved.override}`);
    const variants = await ctx.archive.getVariants(saved.titleId).catch(() => []);
    const meta = await ctx.metadata.get(saved.titleId, variants[0]?.title || '');
    if (meta) console.log(`Verified: ${meta.name} (${meta.confidence})`);
    else console.log('Override saved but could not resolve yet — check the slug/id.');
  });

program
  .command('cusa')
  .description('CUSA table status / refresh')
  .option('--refresh', 'Force re-download the PlayStation-Titles snapshot')
  .action(async (opts) => {
    if (opts.refresh) await ctx.metadata.cusa.sync(true);
    else await ctx.metadata.cusa.ensure().catch((e) => console.error(e.message));
    console.log(ctx.metadata.cusa.status());
  });

program.parse(process.argv);
