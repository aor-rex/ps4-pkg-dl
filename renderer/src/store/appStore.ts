import { create } from 'zustand';
import type { Game, Download, Settings, Mirror } from '../types';
import { backend, tryLive, httpApi, detectMode } from '../lib/backend';
import type { UiDownload, BackendMode, BackfillState, CatalogStatus } from '../lib/backend';
import { entryToGame, variantsToGame } from '../lib/catalog';

let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling(poll: () => void) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 2000);
}

let backfillTimer: ReturnType<typeof setInterval> | null = null;

function uiToDownload(d: UiDownload): Download {
  return {
    id: d.id,
    gameId: d.gameId ?? '',
    gameTitle: d.gameTitle,
    fileType: d.fileType,
    size: d.size,
    sizeBytes: d.sizeBytes,
    source: d.source,
    progress: d.progress,
    speed: String(d.speed ?? ''),
    eta: String(d.eta ?? ''),
    status: d.status,
    path: d.path ?? undefined,
  };
}

interface AppState {
  // Live backend (Electron/HTTP) vs offline empty states (server unreachable)
  liveMode: boolean;
  backendMode: BackendMode;
  detailLoading: boolean;
  browseLoading: boolean;
  initLive: () => void;
  loadBrowse: (page?: number, sort?: string, order?: string) => Promise<void>;
  fetchLiveSearch: (query: string) => Promise<void>;
  openGameDetail: (game: Game) => Promise<void>;
  availableGenres: { name: string; count: number }[];
  loadGenres: () => Promise<void>;

  // Library setup (user-supplied catalog sources + backfill)
  catalogStatus: CatalogStatus | null;
  refreshCatalogStatus: () => Promise<void>;
  loadCatalog: (url: string) => Promise<boolean>;
  refreshCatalogView: () => Promise<void>;
  addCatalogSource: (type: 'url' | 'file', location: string, label?: string) => Promise<boolean>;
  removeCatalogSource: (id: string) => Promise<boolean>;
  toggleCatalogSource: (id: string, enabled: boolean) => Promise<boolean>;
  refreshCatalogSource: (id: string) => Promise<boolean>;
  uploadCatalogFile: (name: string, data: string) => Promise<boolean>;
  backfill: BackfillState | null;
  backfillScope: 'missing' | 'refresh';
  setBackfillScope: (scope: 'missing' | 'refresh') => void;
  startBackfill: () => Promise<void>;
  refreshBackfill: () => Promise<void>;
  cancelBackfill: () => Promise<void>;
  retryMiss: (titleId: string) => Promise<void>;

  // Navigation
  currentView: string;
  setCurrentView: (view: string) => void;
  
  // Games
  games: Game[];
  filteredGames: Game[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedGenre: string | null;
  setSelectedGenre: (genre: string | null) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  gamesPerPage: number;
  
  // Selected Game
  selectedGame: Game | null;
  setSelectedGame: (game: Game | null) => void;
  
  // Downloads
  downloads: Download[];
  downloadManagerOpen: boolean;
  setDownloadManagerOpen: (open: boolean) => void;
  downloadFilter: string;
  setDownloadFilter: (filter: string) => void;
  addDownload: (download: Download) => void;
  updateDownload: (id: string, updates: Partial<Download>) => void;
  removeDownload: (id: string) => void;

  // Live-backed download actions (route to Electron backend when present)
  startDownload: (mirror: Mirror, game: Game | null, fileType?: string) => Promise<void>;
  pauseDl: (id: string) => void;
  resumeDl: (id: string) => void;
  cancelDl: (id: string) => void;
  retryDl: (id: string) => void;
  removeDl: (id: string) => void;
  
  // Settings
  settings: Settings;
  setSettings: (settings: Partial<Settings>) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsCategory: string;
  setSettingsCategory: (category: string) => void;
  
  // Modals
  mirrorModalOpen: boolean;
  setMirrorModalOpen: (open: boolean) => void;
  selectedMirrors: Mirror[];
  setSelectedMirrors: (mirrors: Mirror[]) => void;
  lightboxOpen: boolean;
  setLightboxOpen: (open: boolean) => void;
  lightboxImages: string[];
  setLightboxImages: (images: string[]) => void;
  lightboxIndex: number;
  setLightboxIndex: (index: number) => void;
  videoModalOpen: boolean;
  setVideoModalOpen: (open: boolean) => void;
  selectedVideo: { url: string; title: string } | null;
  setSelectedVideo: (video: { url: string; title: string } | null) => void;
  confirmDialogOpen: boolean;
  setConfirmDialogOpen: (open: boolean) => void;
  confirmDialogMessage: string;
  setConfirmDialogMessage: (message: string) => void;
  confirmDialogOnConfirm: (() => void) | null;
  setConfirmDialogOnConfirm: (fn: (() => void) | null) => void;
  
  // Toasts
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
}

export const defaultSettings: Settings = {
  downloadDir: '~/Downloads/PS4-PKGs',
  createSubfolder: true,
  maxConcurrentDownloads: 2,
  speedLimit: 'None',
  retryCount: 3,
  retryDelay: 30,
  ytdlpPath: 'yt-dlp',
  autoExtract: true,
  extractFormats: ['.zip', '.rar', '.7z'],
  extractTo: 'subfolder',
  deleteArchiveAfterExtract: false,
  downloadTimeout: 300,
  connectionTimeout: 30,
  useProxy: false,
  proxyUrl: '',
  notifyOnComplete: true,
  notifyOnFailed: true,
  notifyOnExtractComplete: true,
  soundAlert: false,
  desktopNotification: true,
  theme: 'kinetic-vault',
  cardSize: 'medium',
  showSizeOnCards: true,
  compactMode: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  // ── Live backend integration ───────────────────────────────────────────
  liveMode: false,
  detailLoading: false,
  browseLoading: false,
  backendMode: 'offline' as BackendMode,

  initLive: () => {
    void (async () => {
      const mode = await detectMode();
      set({ backendMode: mode, liveMode: mode !== 'offline' });
      if (mode === 'offline') return;
      void get().refreshCatalogStatus();
      // resume backfill polling if a job is already running server-side
      void (async () => {
        try {
          const s = backend
            ? ((await tryLive((api) =>
                (api as unknown as { backfillStatus: () => Promise<BackfillState> }).backfillStatus()
              )) as BackfillState | null) ?? (await httpApi.backfillStatus())
            : await httpApi.backfillStatus();
          if (s && (s.status === 'running' || s.status === 'done' || s.status === 'cancelled')) {
            set({ backfill: s });
            if (s.status === 'running' && !backfillTimer) {
              backfillTimer = setInterval(() => void get().refreshBackfill(), 2000);
            }
          }
        } catch {
          /* ignore */
        }
      })();
      void get().loadGenres();
      if (mode === 'electron' && backend) {
        set({ liveMode: true });
        backend.onDownloadsSnapshot((list) => {
          set({ downloads: list.map(uiToDownload) });
        });
        // hydrate settings
        void tryLive(async (api) => {
          const remote = await api.getSettings();
          if (remote) set({ settings: { ...defaultSettings, ...remote } as Settings });
        });
        // extraction progress -> map to download
        if (backend.onExtractEvent) {
          backend.onExtractEvent((event, payload: any) => {
            if (event === 'extract:started' && payload?.id) {
              get().updateDownload(payload.id, { status: 'extracting', extractProgress: 0 } as Partial<Download>);
            } else if (event === 'extract:progress' && payload?.id) {
              get().updateDownload(payload.id, { status: 'extracting', extractProgress: payload.percent ?? payload.progress } as Partial<Download>);
            } else if (event === 'extract:complete' && payload?.id) {
              get().updateDownload(payload.id, { status: 'completed', extractProgress: 100 } as Partial<Download>);
            } else if (event === 'extract:failed' && payload?.id) {
              get().updateDownload(payload.id, { status: 'failed' } as Partial<Download>);
              get().addToast('error', `Extraction failed: ${payload.error || 'unknown'}`);
            }
          });
        }
        tryLive((api) => api.listDownloads()).then((list) => {
          if (list) set({ downloads: list.map(uiToDownload) });
        });
        return;
      }
      // HTTP API mode (plain browser) — poll for progress
      try {
        const remote = await httpApi.getSettings();
        if (remote) set({ settings: { ...defaultSettings, ...remote } as Settings });
      } catch {
        /* ignore */
      }
      const poll = async () => {
        try {
          const list = await httpApi.listDownloads();
          set({ downloads: list.map(uiToDownload) });
        } catch {
          /* server went away — keep last state */
        }
      };
      void poll();
      startPolling(poll);
    })();
  },

  availableGenres: [],
  loadGenres: async () => {
    const { backendMode } = get();
    try {
      if (backend) {
        const list = await tryLive((api) => api.getGenres());
        if (list) {
          set({ availableGenres: list });
          return;
        }
      }
      if (backendMode === 'http' || !backend) set({ availableGenres: await httpApi.getGenres() });
    } catch {
      /* genres stay empty until server has enriched games */
    }
  },

  // ── Library setup ────────────────────────────────────────────────
  catalogStatus: null,
  refreshCatalogStatus: async () => {
    try {
      if (backend) {
        const s = await tryLive((api) => (api as unknown as { catalogStatus: () => Promise<CatalogStatus> }).catalogStatus());
        if (s) {
          set({ catalogStatus: s });
          return;
        }
      }
      set({ catalogStatus: await httpApi.catalogStatus() });
    } catch {
      /* unreachable */
    }
  },
  loadCatalog: async (url: string) => {
    const { addToast, loadBrowse, loadGenres } = get();
    try {
      const status = backend
        ? ((await tryLive((api) =>
            (api as unknown as { catalogLoad: (u: string) => Promise<CatalogStatus> }).catalogLoad(url)
          )) as CatalogStatus | null) ?? (await httpApi.catalogLoad(url))
        : await httpApi.catalogLoad(url);
      set({ catalogStatus: status });
      addToast('success', `Catalog loaded: ${status.count} games`);
      set({ selectedGenre: null, searchQuery: '', currentPage: 1 });
      await loadBrowse(1);
      await loadGenres();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not load catalog URL');
      return false;
    }
  },
  refreshCatalogView: async () => {
    const { loadBrowse, loadGenres } = get();
    set({ selectedGenre: null, searchQuery: '', currentPage: 1 });
    await loadBrowse(1);
    await loadGenres();
  },
  addCatalogSource: async (type: 'url' | 'file', location: string, label?: string) => {
    const { addToast, refreshCatalogView } = get();
    try {
      const status = backend
        ? ((await tryLive((api) =>
            (api as unknown as { catalogAdd: (t: string, l: string, lb?: string) => Promise<CatalogStatus> }).catalogAdd(type, location, label)
          )) as CatalogStatus | null) ?? (await httpApi.catalogAddSource(type, location, label))
        : await httpApi.catalogAddSource(type, location, label);
      set({ catalogStatus: status });
      addToast('success', `Source added: ${status.count} games`);
      await refreshCatalogView();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not add catalog source');
      return false;
    }
  },
  removeCatalogSource: async (id: string) => {
    const { addToast, refreshCatalogView } = get();
    try {
      const status = backend
        ? ((await tryLive((api) =>
            (api as unknown as { catalogRemove: (x: string) => Promise<CatalogStatus> }).catalogRemove(id)
          )) as CatalogStatus | null) ?? (await httpApi.catalogRemoveSource(id))
        : await httpApi.catalogRemoveSource(id);
      set({ catalogStatus: status });
      addToast('success', 'Source removed');
      await refreshCatalogView();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not remove source');
      return false;
    }
  },
  toggleCatalogSource: async (id: string, enabled: boolean) => {
    const { addToast, refreshCatalogView } = get();
    try {
      const status = backend
        ? ((await tryLive((api) =>
            (api as unknown as { catalogToggle: (x: string, e: boolean) => Promise<CatalogStatus> }).catalogToggle(id, enabled)
          )) as CatalogStatus | null) ?? (await httpApi.catalogToggleSource(id, enabled))
        : await httpApi.catalogToggleSource(id, enabled);
      set({ catalogStatus: status });
      await refreshCatalogView();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not toggle source');
      return false;
    }
  },
  refreshCatalogSource: async (id: string) => {
    const { addToast, refreshCatalogView } = get();
    try {
      const status = backend
        ? ((await tryLive((api) =>
            (api as unknown as { catalogRefreshSource: (x: string) => Promise<CatalogStatus> }).catalogRefreshSource(id)
          )) as CatalogStatus | null) ?? (await httpApi.catalogRefreshSource(id))
        : await httpApi.catalogRefreshSource(id);
      set({ catalogStatus: status });
      addToast('success', `Source refreshed: ${status.count} games`);
      await refreshCatalogView();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not refresh source');
      return false;
    }
  },
  uploadCatalogFile: async (name: string, data: string) => {
    const { addToast, refreshCatalogView } = get();
    try {
      const status = backend
        ? ((await tryLive((api) =>
            (api as unknown as { catalogUpload: (n: string, d: string) => Promise<CatalogStatus> }).catalogUpload(name, data)
          )) as CatalogStatus | null) ?? (await httpApi.catalogUploadFile(name, data))
        : await httpApi.catalogUploadFile(name, data);
      set({ catalogStatus: status });
      addToast('success', `File catalog added: ${status.count} games`);
      await refreshCatalogView();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not add file catalog');
      return false;
    }
  },
  backfill: null,
  backfillScope: 'missing',
  setBackfillScope: (scope) => set({ backfillScope: scope }),
  startBackfill: async () => {
    const { addToast, backfillScope } = get();
    const call = async () =>
      backend
        ? ((await tryLive((api) =>
            (api as unknown as { backfillStart: (s: string) => Promise<BackfillState> }).backfillStart(backfillScope)
          )) as BackfillState | null) ?? (await httpApi.backfillStart(backfillScope))
        : httpApi.backfillStart(backfillScope);
    try {
      const state = await call();
      set({ backfill: state });
      if (state.status === 'error') {
        addToast('error', state.error || 'Backfill failed to start');
        return;
      }
      if (backfillTimer) clearInterval(backfillTimer);
      backfillTimer = setInterval(() => void get().refreshBackfill(), 2000);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Backfill failed to start');
    }
  },
  refreshBackfill: async () => {
    try {
      const state = backend
        ? ((await tryLive((api) =>
            (api as unknown as { backfillStatus: () => Promise<BackfillState> }).backfillStatus()
          )) as BackfillState | null) ?? (await httpApi.backfillStatus())
        : await httpApi.backfillStatus();
      set({ backfill: state });
      if (state.status !== 'running' && backfillTimer) {
        clearInterval(backfillTimer);
        backfillTimer = null;
        if (state.status === 'done') {
          get().addToast('success', `Backfill done: ${state.exact + state.high} enriched, ${state.missed.length} missed`);
          void get().loadGenres();
        }
      }
    } catch {
      /* server went away */
    }
  },
  cancelBackfill: async () => {    try {
      const state = backend
        ? ((await tryLive((api) =>
            (api as unknown as { backfillCancel: () => Promise<BackfillState> }).backfillCancel()
          )) as BackfillState | null) ?? (await httpApi.backfillCancel())
        : await httpApi.backfillCancel();
      set({ backfill: state });
    } catch {
      /* ignore */
    } finally {
      if (backfillTimer) {
        clearInterval(backfillTimer);
        backfillTimer = null;
      }
    }
  },
  retryMiss: async (titleId: string) => {
    const { addToast } = get();
    try {
      const meta = backend
        ? ((await tryLive((api) =>
            (api as unknown as { enrichOne: (t: string) => Promise<unknown> }).enrichOne(titleId)
          )) as unknown) ?? (await httpApi.enrichOne(titleId))
        : await httpApi.enrichOne(titleId);
      if (meta) {
        addToast('success', `Enriched ${(meta as { name?: string }).name || titleId}`);
        set((s) => ({
          backfill: s.backfill
            ? { ...s.backfill, missed: s.backfill.missed.filter((m) => m.titleId !== titleId) }
            : s.backfill,
        }));
        void get().loadGenres();
      }
    } catch {
      addToast('error', `Still no match for ${titleId} — try a RAWG id via CLI: ps4dl enrich ${titleId} --rawg-id <id>`);
    }
  },

  loadBrowse: async (page = 1, sort = 'title', order = 'asc') => {
    const { backendMode, selectedGenre } = get();
    if (backendMode === 'offline' && !backend) return;
    set({ browseLoading: true });
    try {
      if (backend) {
        const games = await tryLive((api) => api.browseGames(page));
        if (games && games.length) {
          const mapped = (games as unknown[]).map((g, i) =>
            'titleId' in (g as object) ? entryToGame(g as never, i) : (g as Game)
          );
          set({ games: mapped, filteredGames: mapped, browseLoading: false });
          return;
        }
      }
      const entries = await httpApi.browseGames(page, 48, selectedGenre || '', sort, order);
      const games = entries.map((e, i) => entryToGame(e, i));
      set({ games, filteredGames: games, browseLoading: false });
    } catch {
      set({ browseLoading: false });
    }
  },

  fetchLiveSearch: async (query) => {
    if (!query.trim()) return;
    const { backendMode, selectedGenre } = get();
    if (backendMode === 'offline' && !backend) return;
    try {
      if (backend) {
        const results = await tryLive((api) => api.searchGames(query, 1));
        if (results && results.length) {
          set({ filteredGames: results as Game[] });
          return;
        }
      }
      const entries = await httpApi.searchGames(query, 48, selectedGenre || '');
      set({ filteredGames: entries.map((e, i) => entryToGame(e, i)) });
    } catch {
      /* ignore */
    }
  },

  openGameDetail: async (game) => {
    set({ selectedGame: game, currentView: 'detail', settingsOpen: false });
    if (!game.slug) return;
    const { backendMode } = get();
    if (backendMode === 'offline' && !backend) return;
    set({ detailLoading: true });
    const applyDetail = (items: unknown[], meta: unknown) =>
      variantsToGame(
        game.slug,
        (items as Parameters<typeof variantsToGame>[1]),
        (meta as Parameters<typeof variantsToGame>[2]) ?? null
      );
    try {
      if (backend) {
        const full = await tryLive((api) => api.getGameDetail(game.slug));
        if (full && typeof full === 'object' && 'items' in (full as object)) {
          const d = full as unknown as { items: never[]; metadata: never };
          set({ selectedGame: applyDetail(d.items, d.metadata), detailLoading: false });
          return;
        }
        if (full) {
          const merged = { ...game, ...(full as object) } as Game;
          set({ selectedGame: merged, detailLoading: false });
          return;
        }
      }
      // Archive catalog: expand all PKG variants (region/version picker)
      const detail = await httpApi.getDetail(game.slug);
      set({ selectedGame: applyDetail(detail.items, detail.metadata) });
      if (!detail.metadata) {
        // server enriches in background — pick it up once it lands
        setTimeout(async () => {
          try {
            const again = await httpApi.getDetail(game.slug);
            if (again.metadata && get().selectedGame?.slug === game.slug) {
              set({ selectedGame: applyDetail(again.items, again.metadata) });
            }
          } catch {
            /* still enriching */
          }
        }, 12000);
      }
    } catch {
      /* keep grid-level game */
    } finally {
      set({ detailLoading: false });
    }
  },

  // Navigation
  currentView: 'home',
  setCurrentView: (view) => set({ currentView: view }),
  
  // Games (live catalog; empty until the API responds)
  games: [],
  filteredGames: [],
  searchQuery: '',
  setSearchQuery: (query) => {
    // Live mode: TopNavBar debounces into fetchLiveSearch (server-side);
    // local filtering would wipe server results, so only set the query text.
    if (get().liveMode) {
      set({ searchQuery: query, currentPage: 1 });
      if (!query.trim()) void get().loadBrowse(1);
      return;
    }
    set((state) => {
      const filtered = state.games.filter((game) =>
        game.title.toLowerCase().includes(query.toLowerCase())
      );
      return { searchQuery: query, filteredGames: filtered, currentPage: 1 };
    });
  },
  selectedGenre: null,
  setSelectedGenre: (genre) => {
    // Live mode: server-side genre filter (needs enriched metadata)
    if (get().liveMode) {
      set({ selectedGenre: genre, currentPage: 1, browseLoading: true });
      void (async () => {
        try {
          if (backend) {
            const games = await tryLive((api) => api.browseGames(1, 48, genre || ''));
            if (games && games.length) {
              const mapped = (games as unknown[]).map((g, i) =>
                'titleId' in (g as object) ? entryToGame(g as never, i) : (g as Game)
              );
              set({ games: mapped, filteredGames: mapped, browseLoading: false });
              return;
            }
          }
          const entries = await httpApi.browseGames(1, 48, genre || '');
          const mapped = entries.map((e, i) => entryToGame(e, i));
          set({ games: mapped, filteredGames: mapped, browseLoading: false });
        } catch {
          set({ browseLoading: false });
        }
      })();
      return;
    }
    set((state) => {
      let filtered = state.games;
      if (genre) {
        filtered = state.games.filter((game) => game.genres.includes(genre));
      }
      return { selectedGenre: genre, filteredGames: filtered, currentPage: 1 };
    });
  },
  sortBy: 'newest',
  setSortBy: (sortBy) => set({ sortBy }),
  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),
  currentPage: 1,
  setCurrentPage: (currentPage) => set({ currentPage }),
  gamesPerPage: 24,
  
  // Selected Game
  selectedGame: null,
  setSelectedGame: (selectedGame) => set({ selectedGame }),
  
  // Downloads (live queue; empty until the API responds)
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

  startDownload: async (mirror, game, fileType = 'PKG') => {
    const { addToast, backendMode } = get();
    // mirror.url IS the direct PKG url in archive mode — queue it server-side.
    if (backendMode === 'http' || (!backend && (await detectMode()) === 'http')) {
      set({ backendMode: 'http', liveMode: true });
      addToast('info', `Queueing ${game?.title || 'game'} (${mirror.host})...`);
      try {
        const res = await httpApi.queueDownload({ pkgUrl: mirror.url });
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
      url: mirror.url,
      label: `${game?.title || 'Game'} - ${fileType}`,
      source: mirror.host,
      gameTitle: game?.title,
      fileType,
      size: game?.size,
      gameId: game?.id ?? null,
    }));
    if (res?.id) {
      addToast('success', `Download started from ${mirror.host}`);
    } else {
      addToast('error', `Failed to queue download from ${mirror.host}`);
    }
  },

  pauseDl: (id) => {
    if (get().backendMode === 'http') void httpApi.pauseDownload(id).catch(() => {});
    else void tryLive((api) => api.pauseDownload(id));
    get().updateDownload(id, { status: 'paused' });
  },
  resumeDl: (id) => {
    if (get().backendMode === 'http') void httpApi.resumeDownload(id).catch(() => {});
    else void tryLive((api) => api.resumeDownload(id));
    get().updateDownload(id, { status: 'active' });
  },
  cancelDl: (id) => {
    if (get().backendMode === 'http') void httpApi.cancelDownload(id).catch(() => {});
    else void tryLive((api) => api.cancelDownload(id));
  },
  retryDl: (id) => {
    if (get().backendMode === 'http') void httpApi.retryDownload(id).catch(() => {});
    else void tryLive((api) => api.retryDownload(id));
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
    else void tryLive((api) => api.removeDownload(id));
  },
  
  // Settings
  settings: defaultSettings,
  setSettings: (newSettings) => {
    set((state) => ({ settings: { ...state.settings, ...newSettings } as Settings }));
    if (backend) void tryLive((api) => api.updateSettings(newSettings as Record<string, unknown>));
    else if (get().backendMode === 'http') void httpApi.updateSettings(newSettings as Record<string, unknown>).catch(() => {});
  },
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  settingsCategory: 'general',
  setSettingsCategory: (settingsCategory) => set({ settingsCategory }),
  
  // Modals
  mirrorModalOpen: false,
  setMirrorModalOpen: (mirrorModalOpen) => set({ mirrorModalOpen }),
  selectedMirrors: [],
  setSelectedMirrors: (selectedMirrors) => set({ selectedMirrors }),
  lightboxOpen: false,
  setLightboxOpen: (lightboxOpen) => set({ lightboxOpen }),
  lightboxImages: [],
  setLightboxImages: (lightboxImages) => set({ lightboxImages }),
  lightboxIndex: 0,
  setLightboxIndex: (lightboxIndex) => set({ lightboxIndex }),
  videoModalOpen: false,
  setVideoModalOpen: (videoModalOpen) => set({ videoModalOpen }),
  selectedVideo: null,
  setSelectedVideo: (selectedVideo) => set({ selectedVideo }),
  confirmDialogOpen: false,
  setConfirmDialogOpen: (confirmDialogOpen) => set({ confirmDialogOpen }),
  confirmDialogMessage: '',
  setConfirmDialogMessage: (confirmDialogMessage) => set({ confirmDialogMessage }),
  confirmDialogOnConfirm: null,
  setConfirmDialogOnConfirm: (confirmDialogOnConfirm) => set({ confirmDialogOnConfirm }),
  
  // Toasts
  toasts: [],
  addToast: (type, message) => set((state) => {
    const id = Date.now().toString();
    const newToasts = [...state.toasts, { id, type, message }];
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
    return { toasts: newToasts };
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}));
