/**
 * Unified backend bridge.
 *
 * Order of preference:
 *  1. Electron IPC (`window.ps4dl` injected by preload) — full fidelity.
 *  2. HTTP API (`VITE_API_URL` / localStorage `ps4dl_api_url`,
 *     default `http://localhost:3100`) — works in any browser.
 *  3. No backend — offline empty states (never fake data).
 */

export interface Mirror {
  host: string;
  url: string;
  label?: string | null;
  speed: 'Good' | 'Fast' | 'Medium' | 'Slow';
  reliability: 'High' | 'Medium' | 'Good' | 'Low';
}

export interface UiDownload {
  id: string;
  gameId: string | null;
  gameTitle: string;
  fileType: string;
  size: string;
  sizeBytes: number;
  source: string;
  progress: number;
  speed: string | number;
  eta: string | number | null;
  status: 'active' | 'queued' | 'completed' | 'failed' | 'paused' | 'extracting';
  path?: string | null;
  pkgUrl?: string | null;
  cover?: string | null;
  region?: string | null;
  version?: string | null;
  error?: string | null;
  extractProgress?: number;
}

/** Archive catalog entry (mirrors GET /api/games item shape) */
export interface CatalogEntry {
  id: string;
  titleId: string;
  title: string;
  region: string;
  version: string;
  size: string;
  sizeBytes: number;
  pkgUrl: string;
  downloadUrl: string;
  filename: string;
  cover: string;
  coverUrl: string;
  minFw?: string | null;
  genres?: string[];
  hasMetadata?: boolean;
  date?: string;
  source?: string | null;
  sourceId?: string | null;
}

export interface CatalogMetadata {
  titleId: string;
  rawgId: number | null;
  name: string;
  genres: string[];
  description: string | null;
  metacritic: number | null;
  rating: number | null;
  screenshots: string[];
  trailers: { name: string; preview: string | null; url: string }[];
  confidence: string;
}

export interface GameDetailResult {
  titleId: string;
  count: number;
  items: CatalogEntry[];
  metadata: CatalogMetadata | null;
}

export interface BackfillMiss {
  titleId: string;
  title: string;
  reason: string;
  rejected?: { rawgId: number | null; slug: string | null; name: string } | null;
}

export interface MetadataCandidate {
  rawgId: number;
  slug: string | null;
  name: string;
  released: string | null;
  image: string | null;
  rating: number | null;
  ps4: boolean;
}

export interface IgnoredTitle {
  titleId: string;
  title: string;
  ignoredAt: string;
}

export interface BackfillState {
  status: 'idle' | 'running' | 'cancelled' | 'done' | 'error';
  scope: string;
  total: number;
  done: number;
  exact: number;
  high: number;
  manual: number;
  review?: number;
  missed: BackfillMiss[];
  missedTotal?: number;
  current: { titleId: string; title: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  enrichedTotal: number;
  catalogTotal: number;
}

export interface CatalogSource {
  id: string;
  type: 'url' | 'file';
  location: string;
  label: string;
  enabled: boolean;
  count?: number;
  fetchedAt?: number | null;
  error?: string | null;
}

export interface CatalogStatus {
  configured: boolean;
  catalogUrl: string | null;
  count: number;
  fetchedAt: string | null;
  stale: boolean;
  loaded: boolean;
  sources: CatalogSource[];
}

interface Ps4DlApi {
  browseGames(page?: number, limit?: number, genre?: string): Promise<unknown[]>;
  searchGames(query: string, opts?: { page?: number; limit?: number; genre?: string; region?: string }): Promise<unknown[]>;
  getGameDetail(slug: string): Promise<unknown>;
  getGenres(): Promise<{ name: string; count: number }[]>;
  catalogStatus(): Promise<unknown>;
  catalogLoad(url: string): Promise<unknown>;
  catalogAdd(type: string, location: string, label?: string): Promise<unknown>;
  catalogRemove(id: string): Promise<unknown>;
  catalogToggle(id: string, enabled: boolean): Promise<unknown>;
  catalogRefreshSource(id: string): Promise<unknown>;
  catalogUpload(name: string, data: string): Promise<unknown>;
  chooseCatalogFile(): Promise<string | null>;
  backfillStart(scope: string): Promise<unknown>;
  backfillStatus(): Promise<unknown>;
  backfillCancel(): Promise<unknown>;
  enrichOne(titleId: string): Promise<unknown>;
  metadataCandidates(titleId: string): Promise<unknown>;
  metadataOverride(titleId: string, slugOrId: string): Promise<unknown>;
  metadataIgnored(): Promise<unknown>;
  metadataIgnore(titleId: string, title?: string): Promise<unknown>;
  metadataUnignore(titleId: string): Promise<unknown>;
  addDownload(p: {
    url?: string;
    pkgUrl?: string;
    titleId?: string;
    label?: string;
    source?: string;
    gameTitle?: string;
    fileType?: string;
    size?: string;
    region?: string;
    version?: string;
    cover?: string;
    gameId?: string | null;
    direct?: boolean;
    force?: boolean;
  }): Promise<{ id: string; alreadyQueued?: boolean; alreadyCompleted?: boolean; title?: string | null }>;
  listDownloads(): Promise<UiDownload[]>;
  pauseDownload(id: string): Promise<unknown>;
  resumeDownload(id: string): Promise<unknown>;
  cancelDownload(id: string): Promise<unknown>;
  retryDownload(id: string): Promise<unknown>;
  removeDownload(id: string): Promise<unknown>;
  openFolder(path?: string): Promise<boolean>;
  openConfigFolder(): Promise<unknown>;
  updateCheck(): Promise<unknown>;
  updateDownload(): Promise<unknown>;
  updateQuit(): Promise<unknown>;
  onUpdateEvent(cb: (event: string, payload: unknown) => void): () => void;
  onDownloadEvent(cb: (e: { type: string; download: { id: string; url: string } | null }) => void): () => void;
  onDownloadsSnapshot(cb: (list: UiDownload[]) => void): () => void;
  getSettings(): Promise<Record<string, unknown>>;
  updateSettings(partial: Record<string, unknown>): Promise<Record<string, unknown>>;
  chooseDirectory(): Promise<string | null>;
  systemCheck(): Promise<any>;
  cacheStats(): Promise<Record<string, unknown>>;
  clearCache(): Promise<boolean>;
  listHistory(filter?: string): Promise<unknown[]>;
  extractArchive(archivePath: string): Promise<unknown>;
  onExtractEvent(cb: (event: string, payload: unknown) => void): () => void;
}

const electronApi = (window as unknown as { ps4dl?: Ps4DlApi }).ps4dl;

// ── HTTP API client ──────────────────────────────────────────────────
function apiBase(): string {
  try {
    const stored = localStorage.getItem('ps4dl_api_url');
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  return (env || 'http://localhost:3100').replace(/\/$/, '');
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function fmtSpeed(bps: number): string {
  if (!bps) return '';
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}
function fmtEta(s: number | null): string {
  if (s == null || !isFinite(s)) return '';
  const n = Math.round(s);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function displayTitleHttp(d: Record<string, unknown>): string {
  for (const c of [d.title, d.label]) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  const src = String((d.filename as string) || (d.pkgUrl as string) || '');
  const base = src.split('?')[0].split('/').pop() || '';
  const stem = base.replace(/\.(pkg|zip|rar|7z)$/i, '').replace(/[._-]+/g, ' ').trim();
  return stem || 'Download';
}

function mapServerDownload(d: Record<string, unknown>): UiDownload {
  const state = String(d.status ?? 'queued');
  const status =
    state === 'active' ? 'active'
    : state === 'paused' ? 'paused'
    : state === 'completed' ? 'completed'
    : state === 'failed' ? 'failed'
    : 'queued';
  return {
    id: String(d.id),
    gameId: (d.titleId as string) ?? null,
    gameTitle: displayTitleHttp(d),
    fileType: 'PKG',
    size: String((d as { size?: unknown }).size ?? ''),
    sizeBytes: Number(d.totalBytes ?? 0),
    source: 'Internet Archive',
    progress: Number(d.progress ?? 0),
    speed: typeof d.speed === 'number' ? fmtSpeed(d.speed) : String(d.speed ?? ''),
    eta: typeof d.eta === 'number' ? fmtEta(d.eta) : String(d.eta ?? ''),
    status,
    path: (d.path as string) ?? null,
    pkgUrl: (d.pkgUrl as string) ?? null,
    cover: (d.cover as string) ?? null,
    region: (d.region as string) ?? null,
    version: (d.version as string) ?? null,
    error: (d.error as string) ?? null,
  };
}

const httpApi = {
  async ping(): Promise<boolean> {
    try {
      const r = await http<{ ok: boolean }>('/api/health');
      return r.ok === true;
    } catch {
      return false;
    }
  },
  browseGames: (page = 1, limit = 48, genre = '', sort = 'title', order = 'asc') =>
    http<{ items: CatalogEntry[] }>(
      `/api/games?page=${page}&limit=${limit}&sort=${sort}&order=${order}${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`
    ).then((r) => r.items),
  searchGames: (query: string, limit = 48, genre = '') =>
    http<{ items: CatalogEntry[] }>(
      `/api/games?q=${encodeURIComponent(query)}&limit=${limit}${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`
    ).then((r) => r.items),
  getVariants: (titleId: string) =>
    http<{ items: CatalogEntry[] }>(`/api/games/${encodeURIComponent(titleId)}`).then((r) => r.items),
  getDetail: (titleId: string) => http<GameDetailResult>(`/api/games/${encodeURIComponent(titleId)}`),
  getGenres: () => http<{ genres: { name: string; count: number }[] }>('/api/genres').then((r) => r.genres),
  catalogStatus: () => http<CatalogStatus>('/api/catalog/status'),
  catalogLoad: (url: string) =>
    http<CatalogStatus>('/api/catalog/load', { method: 'POST', body: JSON.stringify({ url }) }),
  catalogAddSource: (type: string, location: string, label?: string) =>
    http<CatalogStatus>('/api/catalog/sources', { method: 'POST', body: JSON.stringify({ type, location, label }) }),
  catalogRemoveSource: (id: string) =>
    http<CatalogStatus>(`/api/catalog/sources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  catalogToggleSource: (id: string, enabled: boolean) =>
    http<CatalogStatus>(`/api/catalog/sources/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  catalogRefreshSource: (id: string) =>
    http<CatalogStatus>(`/api/catalog/sources/${encodeURIComponent(id)}/refresh`, { method: 'POST' }),
  catalogUploadFile: (name: string, data: string) =>
    http<CatalogStatus>('/api/catalog/file', { method: 'POST', body: JSON.stringify({ name, data }) }),
  backfillStart: (scope: string) =>
    http<BackfillState>('/api/jobs/backfill', { method: 'POST', body: JSON.stringify({ scope }) }),
  backfillStatus: () => http<BackfillState>('/api/jobs/backfill'),
  backfillCancel: () => http<BackfillState>('/api/jobs/backfill/cancel', { method: 'POST' }),
  enrichOne: (titleId: string) =>
    http<CatalogMetadata>('/api/metadata/enrich', { method: 'POST', body: JSON.stringify({ titleId }) }),
  metadataCandidates: (titleId: string) =>
    http<{ titleId: string; title: string; candidates: MetadataCandidate[] }>(
      `/api/metadata/candidates?titleId=${encodeURIComponent(titleId)}`
    ),
  metadataOverride: (titleId: string, slugOrId: string) =>
    http<CatalogMetadata>('/api/metadata/override', { method: 'POST', body: JSON.stringify({ titleId, slugOrId }) }),
  metadataIgnored: () => http<{ ignored: IgnoredTitle[] }>('/api/metadata/ignored').then((r) => r.ignored),
  metadataIgnore: (titleId: string, title?: string) =>
    http('/api/metadata/ignore', { method: 'POST', body: JSON.stringify({ titleId, title: title || '' }) }),
  metadataUnignore: (titleId: string) =>
    http(`/api/metadata/ignore/${encodeURIComponent(titleId)}`, { method: 'DELETE' }),
  queueDownload: (entry: { pkgUrl?: string; titleId?: string; id?: string; force?: boolean }) =>
    http<{ id: string; alreadyQueued?: boolean; alreadyCompleted?: boolean; title?: string | null }>('/api/downloads', { method: 'POST', body: JSON.stringify(entry) }),
  listDownloads: () =>
    http<{ downloads: Record<string, unknown>[] }>('/api/downloads').then((r) =>
      r.downloads.map(mapServerDownload)
    ),
  pauseDownload: (id: string) => http(`/api/downloads/${id}/pause`, { method: 'POST' }),
  resumeDownload: (id: string) => http(`/api/downloads/${id}/resume`, { method: 'POST' }),
  cancelDownload: (id: string) => http(`/api/downloads/${id}/cancel`, { method: 'POST' }),
  retryDownload: (id: string) => http(`/api/downloads/${id}/retry`, { method: 'POST' }),
  removeDownload: (id: string) => http(`/api/downloads/${id}`, { method: 'DELETE' }),
  getSettings: () => http<Record<string, unknown>>('/api/settings'),
  updateSettings: (partial: Record<string, unknown>) =>
    http<Record<string, unknown>>('/api/settings', { method: 'PUT', body: JSON.stringify(partial) }),
  getApiBase: apiBase,
  setApiBase: (url: string) => {
    try {
      localStorage.setItem('ps4dl_api_url', url);
    } catch {
      /* ignore */
    }
  },
};

export type BackendMode = 'electron' | 'http' | 'offline';

export const backend: Ps4DlApi | undefined = electronApi;
export const isElectron = !!electronApi;
export const isLive = !!electronApi; // legacy flag (Electron only)
export { httpApi };

/** Resolve which backend is usable right now (Electron wins, else HTTP probe). */
export async function detectMode(): Promise<BackendMode> {
  if (electronApi) return 'electron';
  return (await httpApi.ping()) ? 'http' : 'offline';
}

/** Never throws — live failures resolve to null so UI can show empty states */
export async function tryLive<T>(fn: (api: Ps4DlApi) => Promise<T>): Promise<T | null> {
  if (!electronApi) return null;
  try {
    return await fn(electronApi);
  } catch (err) {
    console.error('[backend]', err);
    return null;
  }
}
