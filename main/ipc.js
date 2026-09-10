/**
 * Electron IPC — thin layer over the shared server context
 * (archive catalog + direct PKG downloads). No scrapers.
 */
const { ipcMain, dialog, shell, app } = require('electron');
const { bootstrapContext } = require('../server/context');
const { attachMeta, titleIdsForGenre, genreCounts, attachAdded } = require('../server/metaView');

let broadcaster = () => {};
let mainWindowRef = null;

function sendToWindow(channel, payload) {
  try {
    const win = mainWindowRef;
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  } catch (_) {}
}

function registerIpcHandlers(ctx) {
  ctx.downloadManager.on('download:progress', (d) => broadcaster('progress', d));
  ctx.downloadManager.on('download:complete', (d) => broadcaster('complete', d));
  ctx.downloadManager.on('download:failed', (d) => broadcaster('failed', d));

  ipcMain.handle('games:browse', async (_e, { page = 1, limit = 50, genre = '' } = {}) => {
    const onlyIds = genre ? titleIdsForGenre(genre) : null;
    const r = await ctx.archive.list({ page, limit, onlyIds });
    return attachAdded(attachMeta(r.items));
  });
  ipcMain.handle('games:search', async (_e, { query = '', region = '', genre = '', page = 1, limit = 50 } = {}) => {
    const onlyIds = genre ? titleIdsForGenre(genre) : null;
    const r = await ctx.archive.list({ q: query, region, page, limit, onlyIds });
    return attachAdded(attachMeta(r.items));
  });
  ipcMain.handle('games:detail', async (_e, { titleId }) => {
    const variants = await ctx.archive.getVariants(titleId);
    if (!variants.length) throw new Error(`No game found for ${titleId}`);
    let metadata = null;
    try {
      metadata = ctx.metadata.getCached(titleId.toUpperCase());
    } catch {
      /* ignore */
    }
    if (!metadata) ctx.metadata.get(titleId.toUpperCase(), variants[0].title).catch(() => {});
    return { titleId: titleId.toUpperCase(), count: variants.length, items: attachAdded(attachMeta(variants)), metadata };
  });
  ipcMain.handle('games:genres', async () => genreCounts());
  ipcMain.handle('catalog:status', async () => {
    await ctx.archive.ensure().catch(() => {});
    return ctx.archive.status();
  });
  ipcMain.handle('catalog:load', async (_e, { url }) => {
    const status = await ctx.archive.loadUrl(url);
    ctx.settings.set('catalogUrl', status.catalogUrl);
    return status;
  });
  ipcMain.handle('backfill:start', async (_e, { scope }) => ctx.backfill.start(scope || 'missing'));
  ipcMain.handle('backfill:status', async () => ctx.backfill.snapshot());
  ipcMain.handle('backfill:cancel', async () => ctx.backfill.cancel());
  ipcMain.handle('metadata:enrich', async (_e, { titleId }) => {
    const variants = await ctx.archive.getVariants(titleId).catch(() => []);
    const meta = await ctx.metadata.get(titleId, variants[0]?.title || '');
    if (!meta) throw new Error(`No metadata match for ${titleId}`);
    return meta;
  });
  ipcMain.handle('metadata:candidates', async (_e, { titleId } = {}) => {
    const id = String(titleId || '').toUpperCase();
    if (!/^CUSA\d{5}$/.test(id)) throw new Error('titleId (CUSA) required');
    const variants = await ctx.archive.getVariants(id).catch(() => []);
    if (!variants.length) throw new Error(`No game found for ${id}`);
    const pool = await ctx.metadata.rawg.candidates(variants[0].title).catch(() => []);
    return {
      titleId: id,
      title: variants[0].title,
      candidates: pool.map((c) => ({
        rawgId: c.rawgId, slug: c.slug, name: c.name,
        released: c.released, image: c.backgroundImage, rating: c.rating, ps4: !!c.ps4,
      })),
    };
  });
  ipcMain.handle('metadata:override', async (_e, { titleId, slugOrId } = {}) => {
    if (!titleId || slugOrId === undefined || String(slugOrId).trim() === '') {
      throw new Error('Provide {titleId, slugOrId} (RAWG slug or numeric id)');
    }
    const pinned = ctx.metadata.setOverride(titleId, String(slugOrId).trim());
    const variants = await ctx.archive.getVariants(pinned.titleId).catch(() => []);
    const meta = await ctx.metadata.get(pinned.titleId, variants[0]?.title || '');
    if (!meta) throw new Error(`Override saved, but it resolves to nothing for ${pinned.titleId}`);
    return meta;
  });
  ipcMain.handle('metadata:ignored', async () => ({ ignored: ctx.metadata.getIgnored() }));
  ipcMain.handle('metadata:ignore', async (_e, { titleId, title } = {}) => {
    if (!titleId) throw new Error('titleId (CUSA) required');
    return ctx.metadata.ignore(titleId, title || '');
  });
  ipcMain.handle('metadata:unignore', async (_e, { titleId } = {}) => {
    if (!titleId) throw new Error('titleId (CUSA) required');
    return ctx.metadata.unignore(titleId);
  });
  ipcMain.handle('catalog:refresh', async () => ctx.archive.refresh(true));
  ipcMain.handle('catalog:add', async (_e, { type, location, label } = {}) => {
    const status = await ctx.archive.addSource({ type, location, label });
    ctx.syncSources();
    return status;
  });
  ipcMain.handle('catalog:remove', async (_e, { id } = {}) => {
    const status = await ctx.archive.removeSource(id);
    ctx.syncSources();
    return status;
  });
  ipcMain.handle('catalog:toggle', async (_e, { id, enabled } = {}) => {
    const status = await ctx.archive.toggleSource(id, enabled !== false);
    ctx.syncSources();
    return status;
  });
  ipcMain.handle('catalog:refreshSource', async (_e, { id } = {}) => ctx.archive.refreshSource(id));
  ipcMain.handle('catalog:upload', async (_e, { name, data } = {}) => {
    if (!name || !data) throw new Error('Provide {name, data} with file content.');
    const fs = require('fs');
    const path = require('path');
    const safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'catalog.json';
    const dir = path.join(require('./settings').getConfigDir(), 'catalog-uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, safeName);
    fs.writeFileSync(filePath, Buffer.from(String(data), 'base64'));
    const status = await ctx.archive.addSource({ type: 'file', location: filePath, label: safeName });
    ctx.syncSources();
    return status;
  });
  ipcMain.handle('dialog:chooseFile', async (_e, { filters } = {}) => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'Catalog JSON', extensions: ['json'] }],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('downloads:add', async (_e, { pkgUrl, url, titleId, id, force, label, source, gameTitle, fileType, size, region, version, cover, gameId } = {}) => {
    const resolvedUrl = pkgUrl || url;
    let entry = null;
    if (resolvedUrl) entry = await ctx.archive.getByPkgUrl(resolvedUrl);
    else if (titleId) entry = (await ctx.archive.getVariants(titleId))[0] || null;
    else if (id) entry = await ctx.archive.getById(id);
    if (!entry) throw new Error('Provide pkgUrl, titleId, or id from the catalog');
    // Catalog entry wins where present; renderer-supplied metadata fills gaps.
    // `force` bypasses already-downloaded detection (explicit re-download).
    return ctx.queuePkgDownload({
      ...entry,
      title: entry.title || gameTitle || label || null,
      label: label || entry.label || null,
      source: source || entry.source || null,
      gameTitle: gameTitle || entry.title || null,
      fileType: fileType || entry.fileType || null,
      size: size || entry.size || null,
      region: region ?? entry.region ?? null,
      version: version ?? entry.version ?? null,
      cover: cover ?? entry.cover ?? null,
      gameId: gameId ?? entry.gameId ?? null,
      force: !!force,
    });
  });
  ipcMain.handle('downloads:list', async () => ctx.listDownloads());
  ipcMain.handle('downloads:pause', async (_e, id) => ctx.downloadManager.pause(id));
  ipcMain.handle('downloads:resume', async (_e, id) => ctx.downloadManager.resume(id));
  ipcMain.handle('downloads:cancel', async (_e, id) => ctx.downloadManager.cancel(id));
  ipcMain.handle('downloads:retry', async (_e, id) => ctx.downloadManager.retry(id));
  ipcMain.handle('downloads:remove', async (_e, id) => ctx.removeDownload(id));
  ipcMain.handle('downloads:openFolder', async (_e, dlPath) => {
    const fs = require('fs');
    if (dlPath && typeof dlPath === 'string' && fs.existsSync(dlPath)) shell.showItemInFolder(dlPath);
    else shell.openPath(ctx.settings.getDownloadDir());
    return true;
  });
  ipcMain.handle('settings:openConfigFolder', async () => {
    shell.openPath(require('./settings').getConfigDir());
    return true;
  });

  // Secrets never leave the main process in readable form: mask on read,
  // skip masked/undefined values on write (empty string still clears).
  const SECRET_KEYS = ['iaCookie', 'rawgApiKey'];
  const maskSecrets = (all) => {
    const out = { ...(all || {}) };
    for (const k of SECRET_KEYS) {
      if (out[k]) out[k] = '***set***';
    }
    return out;
  };

  ipcMain.handle('settings:get', async () => maskSecrets(ctx.settings.getAll()));
  ipcMain.handle('settings:set', async (_e, partial) => {
    for (const [k, v] of Object.entries(partial || {})) {
      if (SECRET_KEYS.includes(k) && (v === undefined || v === '***set***')) continue;
      ctx.settings.set(k, v);
    }
    if (partial?.catalogUrl) ctx.archive.setCatalogUrl(partial.catalogUrl);
    try {
      if (ctx.syncNotificationPrefs) ctx.syncNotificationPrefs();
    } catch (_) {}
    return maskSecrets(ctx.settings.getAll());
  });
  ipcMain.handle('settings:chooseDirectory', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('system:check', async () => ({
    version: app.getVersion(),
    platform: process.platform,
    catalog: ctx.archive.status(),
  }));

  // One-line messages only — never stacks, headers or cookies to the UI
  const shortError = (error) => {
    const msg = String((error && error.message) || error || 'unknown error');
    const first = msg.split('\n')[0].trim();
    return first.length > 220 ? `${first.slice(0, 220)}…` : first;
  };

  // Channel-aware friendly mapping for update failures (one line, no stacks)
  const friendlyUpdateError = (error, channel) => {
    const raw = String((error && error.message) || error || '');
    const code = String((error && (error.code || error.errno)) || '');
    const hay = `${code} ${raw}`;
    if (/production release|status code 406|\b406\b/.test(hay)) {
      return channel === 'stable'
        ? 'No stable releases published yet — switch to Pre-release to keep getting betas.'
        : 'Update feed unreachable right now — try again shortly.';
    }
    if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed|network|ERR_INTERNET|offline/i.test(hay)) {
      return 'Update server unreachable — check your connection and retry.';
    }
    if (/403|rate limit|rate-limit|rate_limit/i.test(hay)) {
      return 'GitHub rate-limited the check — try again in a few minutes.';
    }
    return shortError(error);
  };

  const updateChannel = () => {
    try {
      return ctx.settings.get('updateChannel') === 'stable' ? 'stable' : 'prerelease';
    } catch (_) {
      return 'prerelease';
    }
  };

  ipcMain.handle('update:check', async () => {
    if (!ctx.appUpdater) return { status: 'unavailable' };
    const channel = updateChannel();
    try {
      ctx.appUpdater.allowPrerelease = channel !== 'stable';
    } catch (_) {}
    try {
      // NOTE: checkForUpdates() resolves non-null even when up-to-date —
      // the real signal is res.isUpdateAvailable, not res truthiness.
      const res = await ctx.appUpdater.checkForUpdates();
      const info = (res && res.updateInfo) || {};
      return {
        status: 'checked',
        available: res?.isUpdateAvailable === true,
        version: info.version || null,
        current: app.getVersion(),
      };
    } catch (error) {
      return { status: 'error', error: friendlyUpdateError(error, channel) };
    }
  });
  ipcMain.handle('update:download', async () => {
    if (!ctx.appUpdater) return { status: 'unavailable' };
    // Timestamp (not boolean): doubles as the watchdog's grace-period start
    try {
      ctx.updateDownloadActive = Date.now();
    } catch (_) {}
    try {
      await ctx.appUpdater.downloadUpdate();
      return { status: 'downloading' };
    } catch (error) {
      const msg = shortError(error);
      return {
        status: 'error',
        error: /check update first/i.test(msg)
          ? 'No update staged — check for updates first'
          : msg,
      };
    }
  });
  ipcMain.handle('update:quit', async () => {
    if (!ctx.appUpdater) return { status: 'unavailable' };
    ctx.appUpdater.quitAndInstall(false, true);
    return { status: 'restarting' };
  });
  ipcMain.handle('extract:run', async (_e, archivePath) => {
    if (!archivePath || typeof archivePath !== 'string') throw new Error('Provide an archive path');
    // Forward extractor lifecycle to the renderer's extract:* channels.
    // Payloads carry the archive path as id (manual runs have no download id).
    const fwd = (channel) => (payload) => {
      const p = { id: archivePath, archive: archivePath, ...(payload || {}) };
      sendToWindow(channel, p);
    };
    ctx.extractor.once('extracting', fwd('extract:started'));
    ctx.extractor.once('complete', fwd('extract:complete'));
    ctx.extractor.once('error', fwd('extract:failed'));
    const onProgress = fwd('extract:progress');
    ctx.extractor.on('progress', onProgress);
    try {
      return await ctx.extractor.extract(archivePath);
    } finally {
      try {
        ctx.extractor.removeListener('progress', onProgress);
      } catch (_) {}
    }
  });
  ipcMain.handle('cache:stats', async () => ctx.cacheStats());
  ipcMain.handle('cache:clear', async () => {
    const cleared = ctx.clearCache();
    return !!cleared;
  });
  ipcMain.handle('history:list', async (_e, filter = 'all') => ctx.downloadHistory.getAll(filter, 100));
}

module.exports = {
  bootstrap: bootstrapContext,
  registerIpcHandlers,
  setBroadcaster: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('setBroadcaster expects a function');
    broadcaster = fn;
  },
  setMainWindow: (win) => {
    mainWindowRef = win;
  },
  broadcast: (type, payload) => broadcaster(type, payload),
  listDownloads: (ctx) => ctx.listDownloads(),
};
