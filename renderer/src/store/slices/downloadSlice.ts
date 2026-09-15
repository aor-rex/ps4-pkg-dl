import type { StateCreator } from 'zustand';
import type { Game, Download, Mirror } from '../../types';
import type { AppState } from '../appStore';
import { backend, tryLive, httpApi, detectMode } from '../../lib/backend';
import type { UiDownload } from '../../lib/backend';
import { uiToDownload } from './shared';

export interface DownloadSlice {
  downloads: Download[];
  downloadManagerOpen: boolean;
  setDownloadManagerOpen: (open: boolean) => void;
  downloadFilter: string;
  setDownloadFilter: (filter: string) => void;
  addDownload: (download: Download) => void;
  updateDownload: (id: string, updates: Partial<Download>) => void;
  removeDownload: (id: string) => void;
  startDownload: (mirror: Mirror, game: Game | null, fileType?: string, force?: boolean) => Promise<void>;
  redownload: (id: string) => Promise<void>;
  pauseDl: (id: string) => Promise<void>;
  resumeDl: (id: string) => Promise<void>;
  cancelDl: (id: string) => Promise<void>;
  retryDl: (id: string) => Promise<void>;
  removeDl: (id: string) => void;
}

export const createDownloadSlice: StateCreator<AppState, [], [], DownloadSlice> = (set, get) => ({
  downloads: [],
  downloadManagerOpen: false,
  setDownloadManagerOpen: (downloadManagerOpen) => set({ downloadManagerOpen }),
  downloadFilter: 'all',
  setDownloadFilter: (downloadFilter) => set({ downloadFilter }),
  addDownload: (download) => set((state) => ({ downloads: [...state.downloads, download] })),
  updateDownload: (id, updates) => set((state) => ({
    downloads: state.downloads.map((d) => (d.id === id ? { ...d, ...updates } : d)),
  })),
  removeDownload: (id) => set((state) => ({
    downloads: state.downloads.filter((d) => d.id !== id),
  })),

  startDownload: async (mirror, game, fileType = 'PKG', force = false) => {
    const { addToast, backendMode } = get();
    const showCompleted = () => {
      get().setDownloadManagerOpen(true);
      get().setDownloadFilter('completed');
    };
    // mirror.url IS the direct PKG url in archive mode — queue it server-side.
    if (backendMode === 'http' || (!backend && (await detectMode()) === 'http')) {
      set({ backendMode: 'http', liveMode: true });
      addToast('info', `Queueing ${game?.title || 'game'} (${mirror.host})...`);
      try {
        const res = await httpApi.queueDownload({ pkgUrl: mirror.url, force });
        if (res?.alreadyCompleted) {
          addToast('success', `Already downloaded${res.title ? ` — ${res.title}` : ''}`);
          showCompleted();
          return;
        }
        if (res?.alreadyQueued) {
          addToast('info', 'Already in your downloads — watch the bottom bar');
          get().setDownloadManagerOpen(true);
          return;
        }
        addToast('success', `Download queued (${(res.id || '').slice(0, 8)}...) — watch the bottom bar`);
        const list = await httpApi.listDownloads();
        set({ downloads: list.map(uiToDownload) });
      } catch (err) {
        addToast('error', `Download failed: ${err instanceof Error ? err.message : 'server unreachable'}`);
      }
      return;
    }
    if (!backend) {
      // No server — never fake a download, surface the real state
      addToast('error', 'Server unreachable — start the API server to download');
      return;
    }
    addToast('info', `Queueing ${mirror.host} download...`);
    const res = await tryLive((api) => api.addDownload({
      pkgUrl: mirror.url,
      titleId: game?.slug,
      label: `${game?.title || 'Game'} - ${fileType}`,
      source: mirror.host,
      gameTitle: game?.title,
      fileType,
      size: game?.size,
      region: game?.region,
      version: game?.version,
      cover: game?.cover,
      gameId: game?.id ?? null,
      force,
    }));
    if (res?.alreadyCompleted) {
      addToast('success', `Already downloaded${res.title ? ` — ${res.title}` : ''}`);
      showCompleted();
      return;
    }
    if (res?.alreadyQueued) {
      addToast('info', 'Already in your downloads — watch the bottom bar');
      get().setDownloadManagerOpen(true);
      return;
    }
    if (res?.id) {
      addToast('success', `Download started from ${mirror.host}`);
    } else {
      addToast('error', `Failed to queue download from ${mirror.host}`);
    }
  },

  redownload: async (id) => {
    const { addToast } = get();
    const dl = get().downloads.find((d) => d.id === id);
    if (!dl?.pkgUrl) {
      addToast('error', 'Cannot re-download: original URL is unknown for this entry');
      return;
    }
    await get().startDownload(
      { host: dl.source || 'Internet Archive', url: dl.pkgUrl, speed: 'Good', reliability: 'High' },
      { title: dl.gameTitle, cover: dl.cover, region: dl.region, version: dl.version, size: dl.size } as Game,
      'PKG',
      true
    );
  },

  pauseDl: async (id) => {
    const { addToast } = get();
    try {
      const ok =
        get().backendMode === 'http'
          ? await httpApi.pauseDownload(id).then(() => true)
          : (await tryLive((api) => api.pauseDownload(id))) ?? false;
      if (!ok) throw new Error('pause rejected');
      get().updateDownload(id, { status: 'paused' });
    } catch (err) {
      addToast('error', err instanceof Error ? `Pause failed: ${err.message}` : 'Pause failed');
    }
  },
  resumeDl: async (id) => {
    const { addToast } = get();
    try {
      const ok =
        get().backendMode === 'http'
          ? await httpApi.resumeDownload(id).then(() => true)
          : (await tryLive((api) => api.resumeDownload(id))) ?? false;
      if (!ok) throw new Error('resume rejected');
      get().updateDownload(id, { status: 'active' });
    } catch (err) {
      addToast('error', err instanceof Error ? `Resume failed: ${err.message}` : 'Resume failed');
    }
  },
  cancelDl: async (id) => {
    const { addToast } = get();
    try {
      if (get().backendMode === 'http') await httpApi.cancelDownload(id);
      else await tryLive((api) => api.cancelDownload(id));
    } catch (err) {
      addToast('error', err instanceof Error ? `Cancel failed: ${err.message}` : 'Cancel failed');
    }
  },
  retryDl: async (id) => {
    const { addToast } = get();
    try {
      if (get().backendMode === 'http') await httpApi.retryDownload(id);
      else await tryLive((api) => api.retryDownload(id));
    } catch (err) {
      addToast('error', err instanceof Error ? `Retry failed: ${err.message}` : 'Retry failed');
    }
  },
  removeDl: (id) => {
    if (get().backendMode === 'http') {
      void httpApi.removeDownload(id).then(async () => {
        try {
          const list = await httpApi.listDownloads();
          set({ downloads: list.map(uiToDownload) });
        } catch { /* ignore */ }
      });
    } else if (!backend) get().removeDownload(id);
    else {
      void (async () => {
        await tryLive((api) => api.removeDownload(id));
        try {
          const list = await tryLive((api) => api.listDownloads());
          if (list) set({ downloads: (list as UiDownload[]).map(uiToDownload) });
          else get().removeDownload(id);
        } catch {
          get().removeDownload(id);
        }
      })();
    }
  },
});
