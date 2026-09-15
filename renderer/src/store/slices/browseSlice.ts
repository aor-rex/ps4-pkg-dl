import type { StateCreator } from 'zustand';
import type { Game } from '../../types';
import type { AppState } from '../appStore';
import { backend, tryLive, httpApi, detectMode, callBackend } from '../../lib/backend';
import type { BackendMode, BackfillState } from '../../lib/backend';
import { entryToGame, variantsToGame } from '../../lib/catalog';
import { startPolling, uiToDownload, defaultSettings } from './shared';
import type { Settings } from '../../types';

export interface BrowseSlice {
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
  currentView: string;
  setCurrentView: (view: string) => void;
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
  selectedGame: Game | null;
  setSelectedGame: (game: Game | null) => void;
}

let backfillTimerRef: ReturnType<typeof setInterval> | null = null;
export function setBackfillTimer(t: ReturnType<typeof setInterval> | null) {
  backfillTimerRef = t;
}
export function getBackfillTimer() {
  return backfillTimerRef;
}

export const createBrowseSlice: StateCreator<AppState, [], [], BrowseSlice> = (set, get) => ({
  liveMode: false,
  backendMode: 'offline' as BackendMode,
  detailLoading: false,
  browseLoading: false,

  initLive: () => {
    void (async () => {
      const mode = await detectMode();
      set({ backendMode: mode, liveMode: mode !== 'offline' });
      if (mode === 'offline') return;
      void get().refreshCatalogStatus();
      // Initial browse load lives here (not in the App boot effect): loadBrowse
      // early-returns while the mode is still unresolved, so firing it before
      // detection completes leaves the grid permanently empty on refresh.
      void get().loadBrowse(1);
      // resume backfill polling if a job is already running server-side
      void (async () => {
        try {
          const s = (await callBackend(
            (api) => api.backfillStatus(),
            () => httpApi.backfillStatus()
          )) as BackfillState | null;
          if (s && (s.status === 'running' || s.status === 'done' || s.status === 'cancelled')) {
            set({ backfill: s });
            if (s.status === 'running' && !getBackfillTimer()) {
              setBackfillTimer(setInterval(() => void get().refreshBackfill(), 2000));
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
        backend.onUpdateEvent((event, payload) => {
          const p = (payload || {}) as {
            version?: string;
            percent?: number;
            transferred?: number;
            total?: number;
            error?: string;
          };
          if (event === 'update:available') {
            set({ updateStatus: 'available', updateVersion: p.version || null });
            get().addToast(
              'info',
              `Update available${p.version ? `: v${p.version}` : ''} — see Settings → About`
            );
          } else if (event === 'update:progress') {
            set({
              updateStatus: 'downloading',
              updateProgress: p.percent ?? 0,
              updateTransferred: Number(p.transferred) || 0,
              updateTotal: Number(p.total) || 0,
            });
          } else if (event === 'update:stalled') {
            if (get().updateStatus !== 'stalled') {
              set({ updateStatus: 'stalled' });
              get().addToast('info', 'Update download stalled — check your connection, retry if it persists');
            }
          } else if (event === 'update:downloaded') {
            set({
              updateStatus: 'downloaded',
              updateVersion: p.version || get().updateVersion,
              updateProgress: 100,
            });
            get().addToast('success', 'Update downloaded — restart to install');
          } else if (event === 'update:error') {
            set({ updateStatus: 'error', updateError: p.error || 'update failed' });
          }
        });
        // hydrate settings
        void tryLive(async (api) => {
          const remote = await api.getSettings();
          if (remote) set({ settings: { ...defaultSettings, ...remote } as Settings });
        });
        // extraction progress -> map to download
        if (backend.onExtractEvent) {
          backend.onExtractEvent((event, payload: unknown) => {
            // Manual runs carry the archive path as id; auto runs carry the download id.
            // Match either so both flows update the right row.
            const matchId = (payload as { id?: string } | null)?.id;
            const matchPath = (payload as { archive?: string } | null)?.archive;
            const target = get().downloads.find(
              (d) => d.id === matchId || (matchPath && d.path === matchPath)
            );
            const tid = target ? target.id : matchId;
            const percent =
              (payload as { percent?: number; progress?: number } | null)?.percent ??
              (payload as { progress?: number } | null)?.progress;
            const errText = (payload as { error?: string } | null)?.error || 'unknown';
            if (event === 'extract:started' && tid) {
              get().updateDownload(tid, { status: 'extracting', extractProgress: 0 });
            } else if (event === 'extract:progress' && tid) {
              get().updateDownload(tid, { status: 'extracting', extractProgress: percent });
            } else if (event === 'extract:complete' && tid) {
              get().updateDownload(tid, { status: 'completed', extractProgress: 100 });
            } else if (event === 'extract:failed' && tid) {
              get().updateDownload(tid, { status: 'failed' });
              get().addToast('error', `Extraction failed: ${errText}`);
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
        const results = await tryLive((api) => api.searchGames(query, { page: 1 }));
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
        items as Parameters<typeof variantsToGame>[1],
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

  currentView: 'home',
  setCurrentView: (view) => set({ currentView: view }),

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
      const filtered = state.games.filter((game) => game.title.toLowerCase().includes(query.toLowerCase()));
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

  selectedGame: null,
  setSelectedGame: (selectedGame) => set({ selectedGame }),
});
