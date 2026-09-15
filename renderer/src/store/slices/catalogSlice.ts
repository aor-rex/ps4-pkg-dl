import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { httpApi, callBackend } from '../../lib/backend';
import type { CatalogStatus, BackfillState, MetadataCandidate, IgnoredTitle } from '../../lib/backend';
import { setBackfillTimer, getBackfillTimer } from './browseSlice';

export interface CatalogSlice {
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
}

export const createCatalogSlice: StateCreator<AppState, [], [], CatalogSlice> = (set, get) => ({
  catalogStatus: null,
  refreshCatalogStatus: async () => {
    try {
      set({ catalogStatus: await callBackend(
        (api) => api.catalogStatus(),
        () => httpApi.catalogStatus(),
      ) as CatalogStatus });
    } catch {
      /* unreachable */
    }
  },
  loadCatalog: async (url: string) => {
    const { addToast, loadBrowse, loadGenres } = get();
    try {
      const status = (await callBackend(
        (api) => api.catalogLoad(url),
        () => httpApi.catalogLoad(url),
      )) as CatalogStatus;
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
      const status = (await callBackend(
        (api) => api.catalogAdd(type, location, label),
        () => httpApi.catalogAddSource(type, location, label),
      )) as CatalogStatus;
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
      const status = (await callBackend(
        (api) => api.catalogRemove(id),
        () => httpApi.catalogRemoveSource(id),
      )) as CatalogStatus;
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
      const status = (await callBackend(
        (api) => api.catalogToggle(id, enabled),
        () => httpApi.catalogToggleSource(id, enabled),
      )) as CatalogStatus;
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
      const status = (await callBackend(
        (api) => api.catalogRefreshSource(id),
        () => httpApi.catalogRefreshSource(id),
      )) as CatalogStatus;
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
      const status = (await callBackend(
        (api) => api.catalogUpload(name, data),
        () => httpApi.catalogUploadFile(name, data),
      )) as CatalogStatus;
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
    try {
      const state = (await callBackend(
        (api) => api.backfillStart(backfillScope),
        () => httpApi.backfillStart(backfillScope),
      )) as BackfillState;
      set({ backfill: state });
      if (state.status === 'error') {
        addToast('error', state.error || 'Backfill failed to start');
        return;
      }
      const t = getBackfillTimer();
      if (t) clearInterval(t);
      setBackfillTimer(setInterval(() => void get().refreshBackfill(), 2000));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Backfill failed to start');
    }
  },
  refreshBackfill: async () => {
    try {
      const state = (await callBackend(
        (api) => api.backfillStatus(),
        () => httpApi.backfillStatus(),
      )) as BackfillState;
      set({ backfill: state });
      if (state.status !== 'running') {
        const t = getBackfillTimer();
        if (t) {
          clearInterval(t);
          setBackfillTimer(null);
        }
        if (state.status === 'done') {
          get().addToast('success', `Backfill done: ${state.exact + state.high} enriched, ${state.missedTotal ?? state.missed.length} missed`);
          void get().loadGenres();
        }
      }
    } catch {
      /* server went away */
    }
  },
  cancelBackfill: async () => {
    try {
      const state = (await callBackend(
        (api) => api.backfillCancel(),
        () => httpApi.backfillCancel(),
      )) as BackfillState;
      set({ backfill: state });
    } catch {
      /* ignore */
    } finally {
      const t = getBackfillTimer();
      if (t) {
        clearInterval(t);
        setBackfillTimer(null);
      }
    }
  },
  retryMiss: async (titleId: string) => {
    const { addToast } = get();
    try {
      const meta = (await callBackend(
        (api) => api.enrichOne(titleId),
        () => httpApi.enrichOne(titleId),
      )) as { name?: string } | null;
      if (meta) {
        addToast('success', `Enriched ${meta.name || titleId}`);
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
      const res = (await callBackend(
        (api) => api.metadataCandidates(titleId),
        () => httpApi.metadataCandidates(titleId),
      )) as { candidates: MetadataCandidate[] };
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
      const meta = (await callBackend(
        (api) => api.metadataOverride(titleId, slugOrId),
        () => httpApi.metadataOverride(titleId, slugOrId),
      )) as { name?: string };
      addToast('success', `Matched ${meta.name || titleId}`);
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
      await callBackend(
        (api) => api.metadataIgnore(titleId, title),
        () => httpApi.metadataIgnore(titleId, title),
      );
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
      const list = (await callBackend(
        (api) => api.metadataIgnored(),
        () => httpApi.metadataIgnored(),
      )) as IgnoredTitle[] | { ignored: IgnoredTitle[] };
      set({ ignored: Array.isArray(list) ? list : list.ignored ?? [] });
    } catch {
      /* ignore — section stays hidden */
    }
  },
  unignoreMiss: async (titleId) => {
    const { addToast } = get();
    try {
      await callBackend(
        (api) => api.metadataUnignore(titleId),
        () => httpApi.metadataUnignore(titleId),
      );
      await get().loadIgnored();
      addToast('success', `Unignored ${titleId} — back in the next run`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : `Could not unignore ${titleId}`);
    }
  },
});
