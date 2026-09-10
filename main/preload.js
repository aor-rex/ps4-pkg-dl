const { contextBridge, ipcRenderer } = require('electron');

/**
 * Typed-ish bridge exposed to the renderer as window.ps4dl.
 * The UI feature-detects this object; when absent (plain browser dev),
 * it falls back to mock data.
 */
contextBridge.exposeInMainWorld('ps4dl', {
  // Games (archive catalog + metadata)
  browseGames: (page = 1, limit = 50, genre = '') => ipcRenderer.invoke('games:browse', { page, limit, genre }),
  searchGames: (query, opts = {}) => ipcRenderer.invoke('games:search', { query, ...opts }),
  getGameDetail: (titleId) => ipcRenderer.invoke('games:detail', { titleId }),
  getGenres: () => ipcRenderer.invoke('games:genres'),
  catalogStatus: () => ipcRenderer.invoke('catalog:status'),
  catalogLoad: (url) => ipcRenderer.invoke('catalog:load', { url }),
  refreshCatalog: () => ipcRenderer.invoke('catalog:refresh'),
  catalogAdd: (type, location, label) => ipcRenderer.invoke('catalog:add', { type, location, label }),
  catalogRemove: (id) => ipcRenderer.invoke('catalog:remove', { id }),
  catalogToggle: (id, enabled) => ipcRenderer.invoke('catalog:toggle', { id, enabled }),
  catalogRefreshSource: (id) => ipcRenderer.invoke('catalog:refreshSource', { id }),
  catalogUpload: (name, data) => ipcRenderer.invoke('catalog:upload', { name, data }),
  chooseCatalogFile: () => ipcRenderer.invoke('dialog:chooseFile'),
  backfillStart: (scope) => ipcRenderer.invoke('backfill:start', { scope }),
  backfillStatus: () => ipcRenderer.invoke('backfill:status'),
  backfillCancel: () => ipcRenderer.invoke('backfill:cancel'),
  enrichOne: (titleId) => ipcRenderer.invoke('metadata:enrich', { titleId }),
  metadataCandidates: (titleId) => ipcRenderer.invoke('metadata:candidates', { titleId }),
  metadataOverride: (titleId, slugOrId) => ipcRenderer.invoke('metadata:override', { titleId, slugOrId }),
  metadataIgnored: () => ipcRenderer.invoke('metadata:ignored'),
  metadataIgnore: (titleId, title) => ipcRenderer.invoke('metadata:ignore', { titleId, title }),
  metadataUnignore: (titleId) => ipcRenderer.invoke('metadata:unignore', { titleId }),

  // Downloads
  addDownload: (payload) => ipcRenderer.invoke('downloads:add', payload),
  listDownloads: () => ipcRenderer.invoke('downloads:list'),
  pauseDownload: (id) => ipcRenderer.invoke('downloads:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('downloads:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('downloads:cancel', id),
  retryDownload: (id) => ipcRenderer.invoke('downloads:retry', id),
  removeDownload: (id) => ipcRenderer.invoke('downloads:remove', id),
  openFolder: (path) => ipcRenderer.invoke('downloads:openFolder', path),
  openConfigFolder: () => ipcRenderer.invoke('settings:openConfigFolder'),

  // Live download events: cb receives ({type, download})
  onDownloadEvent: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('download:event', listener);
    return () => ipcRenderer.removeListener('download:event', listener);
  },

  // Full authoritative snapshot of all downloads after each event
  onDownloadsSnapshot: (cb) => {
    const listener = (_e, list) => cb(list);
    ipcRenderer.on('downloads:snapshot', listener);
    return () => ipcRenderer.removeListener('downloads:snapshot', listener);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  chooseDirectory: () => ipcRenderer.invoke('settings:chooseDirectory'),

  // System / history
  systemCheck: () => ipcRenderer.invoke('system:check'),
  listHistory: (filter) => ipcRenderer.invoke('history:list', filter),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateQuit: () => ipcRenderer.invoke('update:quit'),
  onUpdateEvent: (cb) => {
    const events = ['update:available', 'update:progress', 'update:downloaded', 'update:error', 'update:stalled'];
    const listeners = events.map((ev) => {
      const l = (_e, payload) => cb(ev, payload);
      ipcRenderer.on(ev, l);
      return [ev, l];
    });
    // Main multiplexes updater events over the download channel — route those too
    const mux = (_e, payload) => {
      if (payload && typeof payload.type === 'string' && payload.type.startsWith('update:')) {
        cb(payload.type, payload);
      }
    };
    ipcRenderer.on('download:event', mux);
    return () => {
      listeners.forEach(([ev, l]) => ipcRenderer.removeListener(ev, l));
      ipcRenderer.removeListener('download:event', mux);
    };
  },

  // Extraction
  extractArchive: (archivePath) => ipcRenderer.invoke('extract:run', archivePath),
  cacheStats: () => ipcRenderer.invoke('cache:stats'),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  onExtractEvent: (cb) => {
    const events = ['extract:started','extract:progress','extract:complete','extract:failed'];
    const listeners = events.map(ev => {
      const l = (_e, payload) => cb(ev, payload);
      ipcRenderer.on(ev, l);
      return [ev, l];
    });
    return () => listeners.forEach(([ev,l]) => ipcRenderer.removeListener(ev, l));
  },
});
