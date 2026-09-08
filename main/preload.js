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
  catalogLoad: (url: string) => ipcRenderer.invoke('catalog:load', { url }),
  refreshCatalog: () => ipcRenderer.invoke('catalog:refresh'),
  catalogAdd: (type: string, location: string, label?: string) => ipcRenderer.invoke('catalog:add', { type, location, label }),
  catalogRemove: (id: string) => ipcRenderer.invoke('catalog:remove', { id }),
  catalogToggle: (id: string, enabled: boolean) => ipcRenderer.invoke('catalog:toggle', { id, enabled }),
  catalogRefreshSource: (id: string) => ipcRenderer.invoke('catalog:refreshSource', { id }),
  catalogUpload: (name: string, data: string) => ipcRenderer.invoke('catalog:upload', { name, data }),
  chooseCatalogFile: () => ipcRenderer.invoke('dialog:chooseFile'),
  backfillStart: (scope: string) => ipcRenderer.invoke('backfill:start', { scope }),
  backfillStatus: () => ipcRenderer.invoke('backfill:status'),
  backfillCancel: () => ipcRenderer.invoke('backfill:cancel'),
  enrichOne: (titleId: string) => ipcRenderer.invoke('metadata:enrich', { titleId }),
  metadataCandidates: (titleId: string) => ipcRenderer.invoke('metadata:candidates', { titleId }),
  metadataOverride: (titleId: string, slugOrId: string) => ipcRenderer.invoke('metadata:override', { titleId, slugOrId }),
  metadataIgnored: () => ipcRenderer.invoke('metadata:ignored'),
  metadataIgnore: (titleId: string, title?: string) => ipcRenderer.invoke('metadata:ignore', { titleId, title }),
  metadataUnignore: (titleId: string) => ipcRenderer.invoke('metadata:unignore', { titleId }),

  // Downloads
  addDownload: (payload) => ipcRenderer.invoke('downloads:add', payload),
  listDownloads: () => ipcRenderer.invoke('downloads:list'),
  pauseDownload: (id) => ipcRenderer.invoke('downloads:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('downloads:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('downloads:cancel', id),
  retryDownload: (id) => ipcRenderer.invoke('downloads:retry', id),
  removeDownload: (id) => ipcRenderer.invoke('downloads:remove', id),
  openFolder: (path) => ipcRenderer.invoke('downloads:openFolder', path),

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

  // Extraction
  extractArchive: (archivePath) => ipcRenderer.invoke('extract:run', archivePath),
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
