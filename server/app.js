const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const API_DOCS = {
  'GET /api/health': 'liveness check',
  'GET /api/system': 'version, platform, catalog + db stats',
  'GET /api/catalog/status': 'catalog source, game count, freshness',
  'POST /api/catalog/load {url}': 'validate + load a user-supplied games.json URL',
  'POST /api/catalog/refresh': 'force re-fetch games.json',
  'GET /api/regions': 'distinct regions',
  'GET /api/games?q=&region=&genre=&page=&limit=&sort=&order=': 'search/browse catalog (sort: title|size|version|region|added)',
  'GET /api/games/:titleId': 'all PKG variants for a CUSA id',
  'GET /api/pkg?url=': 'single catalog entry by PKG url',
  'GET /api/downloads': 'download queue',
  'POST /api/downloads {pkgUrl|titleId|id, force?}': 'queue a direct PKG download',
  'POST /api/downloads/:id/pause|resume|cancel|retry': 'control a download',
  'DELETE /api/downloads/:id': 'remove a download',
  'GET /api/history?status=&limit=': 'download history',
  'GET /api/settings': 'all settings',
  'PUT /api/settings': 'update settings (downloadDir, catalogUrl, ...)',
  'POST /api/metadata/enrich {titleId}': 'enrich one game now',
  'GET /api/metadata/candidates?titleId=': 'RAWG candidate pool for manual matching',
  'POST /api/metadata/override {titleId, slugOrId}': 'pin a manual match (persisted)',
  'GET /api/metadata/ignored': 'titles excluded from enrichment',
  'POST /api/metadata/ignore {titleId}': 'exclude a title from enrichment',
  'DELETE /api/metadata/ignore/:titleId': 're-include a title',
  'GET /api/metadata/status': 'enrichment coverage',
  'POST /api/jobs/backfill {scope}': 'start backfill (missing|refresh)',
  'GET /api/jobs/backfill': 'backfill progress (poll for progress bar)',
  'POST /api/jobs/backfill/cancel': 'cancel running backfill',
};

function createApp(ctx) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));

  app.use((req, _res, next) => {
    console.error(`[api] ${req.method} ${req.path}`);
    next();
  });

  // ── Health / system ──────────────────────────────────────────────
  app.get('/api', (_req, res) => {
    res.json({ name: 'ps4-pkg-dl API', version: '0.1.0', health: '/api/health', docs: API_DOCS });
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.1.0' }));

  app.get(
    '/api/system',
    asyncHandler(async (_req, res) => {
      res.json({
        version: '0.1.0',
        platform: process.platform,
        catalog: ctx.archive.status(),
        db: ctx.downloadHistory ? safeDbStats() : null,
        downloadDir: ctx.settings.getDownloadDir(),
      });
      function safeDbStats() {
        try {
          return require('../main/database/db').dbManager.getStats();
        } catch {
          return null;
        }
      }
    })
  );

  // ── Catalog ──────────────────────────────────────────────────────
  app.get(
    '/api/catalog/status',
    asyncHandler(async (_req, res) => {
      await ctx.archive.ensure().catch(() => {});
      res.json(ctx.archive.status());
    })
  );

  // Load a user-supplied games.json URL (validates, then adds to the union)
  app.post(
    '/api/catalog/load',
    asyncHandler(async (req, res) => {
      const { url, label } = req.body || {};
      try {
        const status = await ctx.archive.addSource({ type: 'url', location: url, label });
        ctx.syncSources();
        res.json(status);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  // Add a catalog source explicitly: {type:'url'|'file', location, label?}
  app.post(
    '/api/catalog/sources',
    asyncHandler(async (req, res) => {
      const { type, location, label } = req.body || {};
      try {
        const status = await ctx.archive.addSource({ type, location, label });
        ctx.syncSources();
        res.status(201).json(status);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  // Upload a local games.json file body: {name, data} (base64). Stored server-side.
  app.post(
    '/api/catalog/file',
    asyncHandler(async (req, res) => {
      const { name, data } = req.body || {};
      try {
        if (!name || !data) throw new Error('Provide {name, data} with base64 file content.');
        const safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'catalog.json';
        const dir = path.join(require('../main/settings').getConfigDir(), 'catalog-uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, safeName);
        fs.writeFileSync(filePath, Buffer.from(String(data), 'base64'));
        const status = await ctx.archive.addSource({ type: 'file', location: filePath, label: safeName });
        ctx.syncSources();
        res.status(201).json(status);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  app.delete(
    '/api/catalog/sources/:id',
    asyncHandler(async (req, res) => {
      try {
        const status = await ctx.archive.removeSource(req.params.id);
        ctx.syncSources();
        res.json(status);
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    })
  );

  app.patch(
    '/api/catalog/sources/:id',
    asyncHandler(async (req, res) => {
      const { enabled, label } = req.body || {};
      try {
        let status = ctx.archive.status();
        if (enabled !== undefined) status = await ctx.archive.toggleSource(req.params.id, enabled !== false);
        if (label !== undefined) {
          const s = ctx.archive.sources.find((x) => x.id === req.params.id);
          if (!s) throw new Error(`Unknown source: ${req.params.id}`);
          s.label = String(label).slice(0, 80) || s.label;
          status = ctx.archive.status();
        }
        ctx.syncSources();
        res.json(status);
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    })
  );

  app.post(
    '/api/catalog/sources/:id/refresh',
    asyncHandler(async (req, res) => {
      try {
        res.json(await ctx.archive.refreshSource(req.params.id));
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  app.post(
    '/api/catalog/refresh',
    asyncHandler(async (_req, res) => {
      res.json(await ctx.archive.refresh(true));
    })
  );

  app.get(
    '/api/regions',
    asyncHandler(async (_req, res) => {
      res.json({ regions: await ctx.archive.regions() });
    })
  );

  // ── Games ────────────────────────────────────────────────────────
  const { attachMeta, titleIdsForGenre, genreCounts, sightingsMap, attachAdded } = require('./metaView');

  // Integer query params with finite fallback (page=abc must not poison math).
  const numQuery = (v, fallback) => {
    const n = typeof v === 'string' || typeof v === 'number' ? parseInt(String(v), 10) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };

  // GET /api/games?q=&region=&genre=&page=&limit=&sort=title|size|version|region|added&order=asc|desc
  app.get(
    '/api/games',
    asyncHandler(async (req, res) => {
      const onlyIds = req.query.genre ? titleIdsForGenre(req.query.genre) : null;
      const sort = req.query.sort || 'title';
      const result = await ctx.archive.list({
        q: req.query.q || '',
        region: req.query.region || '',
        page: numQuery(req.query.page, 1),
        limit: Math.min(200, Math.max(1, numQuery(req.query.limit, 50))),
        sort,
        order: req.query.order || 'asc',
        onlyIds,
        addedMap: sort === 'added' ? sightingsMap() : null,
      });
      result.items = attachAdded(attachMeta(result.items));
      res.json(result);
    })
  );

  // GET /api/genres -> distinct genres with game counts (from enriched metadata)
  app.get(
    '/api/genres',
    asyncHandler(async (_req, res) => {
      res.json({ genres: genreCounts() });
    })
  );

  // GET /api/games/:titleId -> all PKG variants for a CUSA id (+ lazy metadata)
  app.get(
    '/api/games/:titleId',
    asyncHandler(async (req, res) => {
      const variants = await ctx.archive.getVariants(req.params.titleId);
      if (!variants.length) return res.status(404).json({ error: `No game found for ${req.params.titleId}` });
      const titleId = req.params.titleId.toUpperCase();
      let metadata = null;
      try {
        metadata = ctx.metadata.getCached(titleId);
      } catch {
        /* ignore */
      }
      if (!metadata) {
        // enrich in background — detail view never blocks on RAWG
        ctx.metadata.get(titleId, variants[0].title).catch(() => {});
      }
      res.json({ titleId, count: variants.length, items: attachAdded(attachMeta(variants)), metadata });
    })
  );

  // GET /api/pkg?url=<pkgUrl> -> single entry (for exact download targeting)
  app.get(
    '/api/pkg',
    asyncHandler(async (req, res) => {
      const entry = await ctx.archive.getByPkgUrl(req.query.url || '');
      if (!entry) return res.status(404).json({ error: 'PKG not found in catalog' });
      res.json(entry);
    })
  );

  // ── Metadata (RAWG enrichment) ───────────────────────────────────
  app.get(
    '/api/metadata/status',
    asyncHandler(async (_req, res) => {
      await ctx.archive.ensure().catch(() => {});
      res.json({ ...ctx.metadata.status(), ...ctx.metadata.stats(ctx.archive.games.length) });
    })
  );

  app.post(
    '/api/metadata/enrich',
    asyncHandler(async (req, res) => {
      const { titleId, rawgId } = req.body || {};
      if (!titleId) return res.status(400).json({ error: 'titleId (CUSA) required' });
      const variants = await ctx.archive.getVariants(titleId).catch(() => []);
      const meta = await ctx.metadata.get(titleId, variants[0]?.title || '', rawgId ? { rawgId } : {});
      if (!meta) return res.status(404).json({ error: `No metadata match for ${titleId}` });
      res.json(meta);
    })
  );

  // RAWG candidate pool for manual matching (pinning an override)
  app.get(
    '/api/metadata/candidates',
    asyncHandler(async (req, res) => {
      const titleId = String(req.query.titleId || '').toUpperCase();
      if (!/^CUSA\d{5}$/.test(titleId)) return res.status(400).json({ error: 'titleId (CUSA) required' });
      const variants = await ctx.archive.getVariants(titleId).catch(() => []);
      if (!variants.length) return res.status(404).json({ error: `No game found for ${titleId}` });
      const title = variants[0].title;
      const pool = await ctx.metadata.rawg.candidates(title).catch(() => []);
      res.json({
        titleId,
        title,
        candidates: pool.map((c) => ({
          rawgId: c.rawgId,
          slug: c.slug,
          name: c.name,
          released: c.released,
          image: c.backgroundImage,
          rating: c.rating,
          ps4: !!c.ps4,
        })),
      });
    })
  );

  // Pin a manual match (persisted override, wins over automation)
  app.post(
    '/api/metadata/override',
    asyncHandler(async (req, res) => {
      const { titleId, slugOrId } = req.body || {};
      if (!titleId || slugOrId === undefined || String(slugOrId).trim() === '') {
        return res.status(400).json({ error: 'Provide {titleId, slugOrId} (RAWG slug or numeric id)' });
      }
      const pinned = ctx.metadata.setOverride(titleId, String(slugOrId).trim());
      const variants = await ctx.archive.getVariants(pinned.titleId).catch(() => []);
      const meta = await ctx.metadata.get(pinned.titleId, variants[0]?.title || '');
      if (!meta) return res.status(404).json({ error: `Override saved, but it resolves to nothing for ${pinned.titleId}` });
      res.status(201).json(meta);
    })
  );

  app.get('/api/metadata/ignored', (_req, res) => {
    res.json({ ignored: ctx.metadata.getIgnored() });
  });

  app.post(
    '/api/metadata/ignore',
    asyncHandler(async (req, res) => {
      const { titleId, title } = req.body || {};
      if (!titleId) return res.status(400).json({ error: 'titleId (CUSA) required' });
      try {
        res.status(201).json(ctx.metadata.ignore(titleId, title || ''));
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  app.delete(
    '/api/metadata/ignore/:titleId',
    asyncHandler(async (req, res) => {
      try {
        res.json(ctx.metadata.unignore(req.params.titleId));
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  // ── Backfill jobs ────────────────────────────────────────────────
  app.post(
    '/api/jobs/backfill',
    asyncHandler(async (req, res) => {
      const { scope } = req.body || {};
      try {
        const state = await ctx.backfill.start(scope || 'missing');
        res.status(202).json(state);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    })
  );
  app.get('/api/jobs/backfill', (_req, res) => {
    res.json(ctx.backfill.snapshot());
  });
  app.post('/api/jobs/backfill/cancel', (_req, res) => {
    res.json(ctx.backfill.cancel());
  });

  // ── Downloads (direct archive.org URLs, no resolving) ────────────
  app.get('/api/downloads', (_req, res) => {
    res.json({ downloads: ctx.listDownloads() });
  });

  app.post(
    '/api/downloads',
    asyncHandler(async (req, res) => {
      let { pkgUrl, titleId, id, force } = req.body || {};
      let entry = null;
      if (pkgUrl) entry = await ctx.archive.getByPkgUrl(pkgUrl);
      else if (titleId) {
        const variants = await ctx.archive.getVariants(titleId);
        if (!variants.length) return res.status(404).json({ error: `No game found for ${titleId}` });
        entry = variants[0]; // first variant; client can specify exact pkgUrl
      } else if (id) entry = await ctx.archive.getById(id);
      if (!entry) return res.status(400).json({ error: 'Provide pkgUrl, titleId, or id from the catalog' });
      const result = ctx.queuePkgDownload({
        pkgUrl: entry.pkgUrl,
        title: entry.title,
        titleId: entry.titleId,
        filename: entry.filename,
        cover: entry.cover || entry.coverUrl,
        region: entry.region,
        version: entry.version,
        size: entry.size,
        force: !!force,
      });
      res.status(201).json({ ...result, entry });
    })
  );

  const control = (action) => (req, res) => {
    const { id } = req.params;
    const mgr = ctx.downloadManager;
    const fn =
      action === 'pause' ? mgr.pause.bind(mgr)
      : action === 'resume' ? mgr.resume.bind(mgr)
      : action === 'cancel' ? (x) => mgr.cancel(x, true)
      : mgr.retry.bind(mgr);
    Promise.resolve(fn(id)).then(
      (ok) => (ok === false ? res.status(404).json({ error: `Download ${id} not found` }) : res.json({ id, action, ok: true })),
      (err) => res.status(500).json({ error: err.message })
    );
  };
  app.post('/api/downloads/:id/pause', control('pause'));
  app.post('/api/downloads/:id/resume', control('resume'));
  app.post('/api/downloads/:id/cancel', control('cancel'));
  app.post('/api/downloads/:id/retry', control('retry'));
  app.delete('/api/downloads/:id', (req, res) => {
    const { id } = req.params;
    // Record removal keeps the game file on disk (cancel with deleteFile=false)
    ctx.removeDownload(id)
      .catch(() => {})
      .finally(() => {
        res.json({ id, removed: true });
      });
  });

  // ── History / settings ───────────────────────────────────────────
  app.get('/api/history', (req, res) => {
    const filter = req.query.status || 'all';
    const limit = Math.min(200, numQuery(req.query.limit, 100));
    res.json({ history: ctx.downloadHistory.getAll(filter, limit) });
  });

  const SECRET_KEYS = ['iaCookie', 'rawgApiKey'];

  function publicSettings() {
    const all = ctx.settings.getAll();
    for (const k of SECRET_KEYS) {
      if (all[k]) all[k] = '***set***';
    }
    return all;
  }

  app.get('/api/settings', (_req, res) => res.json(publicSettings()));
  app.put('/api/settings', (req, res) => {
    const patch = req.body || {};
    const allowed = ['downloadDir', 'createSubfolder', 'maxConcurrentDownloads', 'catalogTtlHours', 'apiPort', 'autoExtract', 'iaCookie', 'rawgApiKey', 'metadataTtlDays', 'notifyOnComplete', 'notifyOnFailed', 'notifyOnExtractComplete', 'soundAlert', 'desktopNotification'];
    for (const [k, v] of Object.entries(patch)) {
      if (!allowed.includes(k)) continue;
      if (SECRET_KEYS.includes(k) && (v === '***set***' || v === undefined)) continue;
      ctx.settings.set(k, v);
    }
    if (patch.catalogTtlHours) ctx.archive.ttlHours = patch.catalogTtlHours;
    if (patch.iaCookie !== undefined && patch.iaCookie !== '***set***') {
      try {
        ctx.downloadManager.setDefaultHeaders(
          patch.iaCookie && String(patch.iaCookie).trim() ? { Cookie: String(patch.iaCookie).trim() } : null
        );
      } catch (_) {}
    }
    if ((patch.rawgApiKey !== undefined && patch.rawgApiKey !== '***set***') || patch.metadataTtlDays) {
      try {
        ctx.metadata.refreshConfig();
      } catch (_) {}
    }
    if (patch.maxConcurrentDownloads) {
      try {
        ctx.downloadManager.setMaxConcurrent(patch.maxConcurrentDownloads);
      } catch (_) {}
    }
    try {
      if (ctx.syncNotificationPrefs) ctx.syncNotificationPrefs();
    } catch (_) {}
    res.json(publicSettings());
  });

  // ── Web UI (built React app, if present) ───────────────────────────
  // Serves renderer/dist at / so the app works in a plain browser.
  // API routes above take precedence; SPA fallback handles client routes.
  const UI_DIR = path.join(__dirname, '..', 'renderer', 'dist');
  if (fs.existsSync(path.join(UI_DIR, 'index.html'))) {
    // Hashed assets cache for an hour; the entry HTML never caches so UI
    // updates reach the browser on plain refresh.
    app.use(express.static(UI_DIR, { maxAge: '1h', index: false }));
    const sendIndex = (_req, res) =>
      res.sendFile(path.join(UI_DIR, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
    app.get('/', sendIndex);
    app.get(/^\/(?!api).*/, sendIndex);
    console.error(`[api] serving web UI from ${UI_DIR}`);
  } else {
    app.get('/', (_req, res) => {
      res.json({ name: 'ps4-pkg-dl API', version: '0.1.0', docs: API_DOCS, ui: 'run the renderer build (npm --prefix renderer run build) to serve the web app here' });
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(`[api] error: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  return app;
}

module.exports = { createApp };
