import { create } from 'zustand';
import type { Game, Download, Settings, Mirror } from '../types';
import { backend, tryLive, httpApi, detectMode } from '../lib/backend';
import type { UiDownload, BackendMode, BackfillState, CatalogStatus, MetadataCandidate, IgnoredTitle } from '../lib/backend';
import { entryToGame, variantsToGame } from '../lib/catalog';

let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling(poll: () => void) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 2000);
}

let backfillTimer: ReturnType<typeof setInterval> | null = null;

function fmtSpeedLocal(v: string | number | null | undefined): string {
  const bps = typeof v === 'number' ? v : Number(v);
  if (!bps || !isFinite(bps)) return '';
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

function fmtEtaLocal(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  const s = typeof v === 'number' ? v : Number(v);
  if (!isFinite(s)) return '';
  const n = Math.round(s);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

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
    speed: fmtSpeedLocal(d.speed),
    eta: fmtEtaLocal(d.eta),
    status: d.status,
    path: d.path ?? undefined,
    pkgUrl: d.pkgUrl ?? undefined,
    cover: d.cover ?? undefined,
    region: d.region ?? undefined,
    version: d.version ?? undefined,
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
  candidates: Record<string, { loading: boolean; items: MetadataCandidate[]; error: string | null }>;
  fetchCandidates: (titleId: string) => Promise<void>;
  pinMatch: (titleId: string, slugOrId: string) => Promise<boolean>;
  ignoreMiss: (titleId: string, title: string) => Promise<void>;
  ignored: IgnoredTitle[];
  loadIgnored: () => Promise<void>;
  unignoreMiss: (titleId: string) => Promise<void>;

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
  startDownload: (mirror: Mirror, game: Game | null, fileType?: string, force?: boolean) => Promise<void>;
  redownload: (id: string) => Promise<void>;
  pauseDl: (id: string) => Promise<void>;
  resumeDl: (id: string) => Promise<void>;
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
  rememberedMirrorHost: string | null;
  setRememberedMirrorHost: (host: string | null) => void;
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

  // What's-new modal (first-run changelog, per version)
  whatsNewOpen: boolean;
  setWhatsNewOpen: (open: boolean) => void;
  maybeShowWhatsNew: () => void;

  // In-app updater (Electron only; no-ops elsewhere)
  updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'stalled' | 'error' | 'unavailable';
  updateVersion: string | null;
  updateProgress: number;
  updateTransferred: number;
  updateTotal: number;
  updateError: string | null;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToUpdate: () => Promise<void>;
  
  // Toasts
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string; at: number }>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
  // Notification history (every toast is recorded; session-only, last 50)
  notificationHistory: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string; at: number }>;
  unreadNotifications: number;
  markNotificationsRead: () => void;
  clearNotificationHistory: () => void;
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
  updateChannel: 'prerelease',
  autoCheckUpdates: true,
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
      // Initial browse load lives here (not in the App boot effect): loadBrowse
      // early-returns while the mode is still unresolved, so firing it before
      // detection completes leaves the grid permanently empty on refresh.
      void get().loadBrowse(1);
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
        backend.onUpdateEvent((event, payload) => {
          const p = (payload || {}) as { version?: string; percent?: number; transferred?: number; total?: number; error?: string };
          if (event === 'update:available') {
            set({ updateStatus: 'available', updateVersion: p.version || null });
            get().addToast('info', `Update available${p.version ? `: v${p.version}` : ''} — see Settings → About`);
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
            set({ updateStatus: 'downloaded', updateVersion: p.version || get().updateVersion, updateProgress: 100 });
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

  candidates: {},
  fetchCandidates: async (titleId) => {
    const { candidates } = get();
    if (candidates[titleId]?.items.length || candidates[titleId]?.loading) return;
    set((s) => ({ candidates: { ...s.candidates, [titleId]: { loading: true, items: [], error: null } } }));
    try {
      const res = backend
        ? ((await tryLive((api) =>
            (api as unknown as { metadataCandidates: (t: string) => Promise<{ candidates: MetadataCandidate[] }> }).metadataCandidates(titleId)
          )) as { candidates: MetadataCandidate[] } | null) ?? (await httpApi.metadataCandidates(titleId))
        : await httpApi.metadataCandidates(titleId);
      set((s) => ({ candidates: { ...s.candidates, [titleId]: { loading: false, items: res.candidates || [], error: null } } }));
    } catch (err) {
      set((s) => ({
        candidates: { ...s.candidates, [titleId]: { loading: false, items: [], error: err instanceof Error ? err.message : 'Search failed' } },
      }));
    }
  },
  pinMatch: async (titleId, slugOrId) => {
    const { addToast } = get();
    try {
      const meta = backend
        ? ((await tryLive((api) =>
            (api as unknown as { metadataOverride: (t: string, s: string) => Promise<{ name?: string }> }).metadataOverride(titleId, slugOrId)
          )) as { name?: string } | null) ?? (await httpApi.metadataOverride(titleId, slugOrId))
        : await httpApi.metadataOverride(titleId, slugOrId);
      addToast('success', `Matched ${(meta as { name?: string }).name || titleId}`);
      set((s) => ({
        backfill: s.backfill ? { ...s.backfill, missed: s.backfill.missed.filter((m) => m.titleId !== titleId) } : s.backfill,
      }));
      void get().loadGenres();
      return true;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : `Could not pin match for ${titleId}`);
      return false;
    }
  },
  ignoreMiss: async (titleId, title) => {
    const { addToast } = get();
    try {
      if (backend) {
        await tryLive((api) =>
          (api as unknown as { metadataIgnore: (t: string, n: string) => Promise<unknown> }).metadataIgnore(titleId, title)
        );
      } else {
        await httpApi.metadataIgnore(titleId, title);
      }
      set((s) => ({
        backfill: s.backfill ? { ...s.backfill, missed: s.backfill.missed.filter((m) => m.titleId !== titleId) } : s.backfill,
      }));
      await get().loadIgnored();
      addToast('success', `Ignored ${titleId} — excluded from future runs`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : `Could not ignore ${titleId}`);
    }
  },
  ignored: [],
  loadIgnored: async () => {
    try {
      const list = backend
        ? ((await tryLive((api) =>
            (api as unknown as { metadataIgnored: () => Promise<{ ignored: IgnoredTitle[] }> }).metadataIgnored()
          )) as { ignored: IgnoredTitle[] } | null) ?? (await httpApi.metadataIgnored())
        : await httpApi.metadataIgnored();
      set({ ignored: Array.isArray(list) ? list : (list as { ignored: IgnoredTitle[] }).ignored ?? [] });
    } catch {
      /* ignore — section stays hidden */
    }
  },
  unignoreMiss: async (titleId) => {
    const { addToast } = get();
    try {
      if (backend) {
        await tryLive((api) =>
          (api as unknown as { metadataUnignore: (t: string) => Promise<unknown> }).metadataUnignore(titleId)
        );
      } else {
        await httpApi.metadataUnignore(titleId);
      }
      await get().loadIgnored();
      addToast('success', `Unignored ${titleId} — back in the next run`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : `Could not unignore ${titleId}`);
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
  rememberedMirrorHost: null,
  setRememberedMirrorHost: (rememberedMirrorHost) => set({ rememberedMirrorHost }),
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

  // What's-new modal (first-run changelog, per version)
  whatsNewOpen: false,
  setWhatsNewOpen: (whatsNewOpen) => set({ whatsNewOpen }),
  maybeShowWhatsNew: () => {
    let version = '';
    try {
      version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
    } catch {
      return;
    }
    if (!version) return;
    const key = `seen-changelog-${version}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    set({ whatsNewOpen: true });
  },

  // In-app updater (Electron only; no-ops elsewhere)
  updateStatus: 'idle',
  updateVersion: null,
  updateProgress: 0,
  updateTransferred: 0,
  updateTotal: 0,
  updateError: null,
  checkForUpdates: async (manual = false) => {
    const { addToast } = get();
    if (!backend) {
      if (manual) addToast('info', 'Auto-update is available in the desktop app (or re-run install.sh)');
      set({ updateStatus: 'unavailable' });
      return;
    }
    set({ updateStatus: 'checking', updateError: null });
    const res = (await tryLive((api) => api.updateCheck())) as { status?: string; available?: boolean; version?: string | null; current?: string | null; error?: string } | null;
    if (!res || res.status === 'unavailable') {
      set({ updateStatus: 'unavailable' });
      if (manual) addToast('info', 'Auto-update is unavailable in this build');
      return;
    }
    if (res.status === 'error') {
      set({ updateStatus: 'error', updateError: res.error || 'check failed' });
      if (manual) addToast('error', `Update check failed: ${res.error || 'unknown'}`);
      return;
    }
    // Belt and braces: only a strictly-newer version counts as an offer.
    // Never offer the running version (or an older one) for download.
    let current = res.current || null;
    try {
      current = current || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null);
    } catch {
      /* ignore */
    }
    const newer = !!(
      res.available &&
      res.version &&
      current &&
      res.version !== current &&
      res.version !== `v${current}`
    );
    if (newer) {
      set({ updateStatus: 'available', updateVersion: res.version || null });
      if (manual) set({ whatsNewOpen: false });
    } else {
      set({ updateStatus: 'idle', updateVersion: null });
      if (manual) addToast('success', 'Already on the latest version');
    }
  },
  downloadUpdate: async () => {
    const { addToast, updateVersion } = get();
    if (!backend) return;
    // Never attempt a download unless a strictly-newer version is staged
    if (!updateVersion) {
      set({ updateStatus: 'idle', updateError: null });
      addToast('info', 'No update available to download — check for updates first');
      return;
    }
    set({ updateStatus: 'downloading', updateProgress: 0 });
    const res = (await tryLive((api) => api.updateDownload())) as { status?: string; error?: string } | null;
    if (!res || res.status === 'error') {
      set({ updateStatus: 'idle', updateVersion: null, updateProgress: 0, updateError: (res && res.error) || 'download failed' });
      addToast('error', `Update download failed: ${(res && res.error) || 'unknown'}`);
    }
  },
  restartToUpdate: async () => {
    if (!backend) return;
    await tryLive((api) => api.updateQuit());
  },
  
  // Toasts
  toasts: [],
  notificationHistory: [],
  unreadNotifications: 0,
  markNotificationsRead: () => set({ unreadNotifications: 0 }),
  clearNotificationHistory: () => set({ notificationHistory: [], unreadNotifications: 0 }),
  addToast: (type, message) => set((state) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = { id, type, message, at: Date.now() };
    const newToasts = [...state.toasts, entry];
    const history = [...state.notificationHistory, entry].slice(-50);
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
    return {
      toasts: newToasts,
      notificationHistory: history,
      unreadNotifications: state.unreadNotifications + 1,
    };
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}));
