import type { Download, Settings } from '../../types';
import type { UiDownload } from '../../lib/backend';
import { formatSpeed, formatEta } from '../../lib/format';

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
  updateChannel: 'stable',
  autoCheckUpdates: true,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
export function startPolling(poll: () => void) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 2000);
}

export function uiToDownload(d: UiDownload): Download {
  return {
    id: d.id,
    gameId: d.gameId ?? '',
    gameTitle: d.gameTitle,
    fileType: d.fileType,
    size: d.size,
    sizeBytes: d.sizeBytes,
    source: d.source,
    progress: d.progress,
    speed: formatSpeed(d.speed),
    eta: formatEta(d.eta),
    status: d.status,
    path: d.path ?? undefined,
    pkgUrl: d.pkgUrl ?? undefined,
    cover: d.cover ?? undefined,
    region: d.region ?? undefined,
    version: d.version ?? undefined,
  };
}

export function mergeSettings(base: Settings, remote: unknown): Settings {
  return { ...base, ...(remote as Partial<Settings>) } as Settings;
}
