/**
 * Electron IPC — thin layer over the shared server context
 * (archive catalog + direct PKG downloads). No scrapers.
 */
const { ipcMain, dialog, shell, app } = require('electron');
const { bootstrapContext } = require('../server/context');
const { attachMeta, titleIdsForGenre, genreCounts, attachAdded } = require('../server/metaView');

let broadcaster = () => {};

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
  ipcMain.handle('catalog:refresh', async () => ctx.archive.refresh(true));

  ipcMain.handle('downloads:add', async (_e, { pkgUrl, titleId, id } = {}) => {
    let entry = null;
    if (pkgUrl) entry = await ctx.archive.getByPkgUrl(pkgUrl);
    else if (titleId) entry = (await ctx.archive.getVariants(titleId))[0] || null;
    else if (id) entry = await ctx.archive.getById(id);
    if (!entry) throw new Error('Provide pkgUrl, titleId, or id from the catalog');
    return ctx.queuePkgDownload(entry);
  });
  ipcMain.handle('downloads:list', async () => ctx.listDownloads());
  ipcMain.handle('downloads:pause', async (_e, id) => ctx.downloadManager.pause(id));
  ipcMain.handle('downloads:resume', async (_e, id) => ctx.downloadManager.resume(id));
  ipcMain.handle('downloads:cancel', async (_e, id) => ctx.downloadManager.cancel(id));
  ipcMain.handle('downloads:retry', async (_e, id) => ctx.downloadManager.retry(id));
  ipcMain.handle('downloads:openFolder', async (_e, dlPath) => {
    const fs = require('fs');
    if (dlPath && typeof dlPath === 'string' && fs.existsSync(dlPath)) shell.showItemInFolder(dlPath);
    else shell.openPath(ctx.settings.getDownloadDir());
    return true;
  });

  ipcMain.handle('settings:get', async () => ctx.settings.getAll());
  ipcMain.handle('settings:set', async (_e, partial) => {
    for (const [k, v] of Object.entries(partial || {})) ctx.settings.set(k, v);
    if (partial?.catalogUrl) ctx.archive.setCatalogUrl(partial.catalogUrl);
    return ctx.settings.getAll();
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
  ipcMain.handle('history:list', async (_e, filter = 'all') => ctx.downloadHistory.getAll(filter, 100));
}

module.exports = {
  bootstrap: bootstrapContext,
  registerIpcHandlers,
  setBroadcaster: (fn) => {
    broadcaster = fn;
  },
  listDownloads: (ctx) => ctx.listDownloads(),
};
