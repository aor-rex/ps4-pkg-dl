export interface Game {
  id: string;
  title: string;
  slug: string;
  url: string;
  cover: string;
  size: string;
  sizeBytes: number;
  region: string;
  version: string;
  date: string;
  genres: string[];
  description: string;
  gallery: string[];
  videos: Video[];
  downloads: DownloadGroup[];
  metacritic?: number | null;
  rating?: number | null;
  hasMetadata?: boolean;
}

export interface Video {
  url: string;
  title: string;
  duration: string;
  thumbnail: string;
}

export interface DownloadGroup {
  type: string;
  size: string;
  mirrors: Mirror[];
}

export interface Mirror {
  host: string;
  url: string;
  speed: 'Good' | 'Fast' | 'Medium' | 'Slow';
  reliability: 'High' | 'Medium' | 'Good' | 'Low';
}

export interface Download {
  id: string;
  gameId: string;
  gameTitle: string;
  fileType: string;
  size: string;
  sizeBytes: number;
  source: string;
  progress: number;
  speed: string;
  eta: string;
  status: 'active' | 'queued' | 'completed' | 'failed' | 'paused' | 'extracting';
  path?: string;
  cover?: string | null;
  region?: string | null;
  version?: string | null;
  extractProgress?: number;
}

export interface Settings {
  downloadDir: string;
  createSubfolder: boolean;
  maxConcurrentDownloads: number;
  speedLimit: string;
  retryCount: number;
  retryDelay: number;
  ytdlpPath: string;
  autoExtract: boolean;
  extractFormats: string[];
  extractTo: 'subfolder' | 'same' | 'custom';
  customExtractDir?: string;
  deleteArchiveAfterExtract: boolean;
  downloadTimeout: number;
  connectionTimeout: number;
  useProxy: boolean;
  proxyUrl: string;
  notifyOnComplete: boolean;
  notifyOnFailed: boolean;
  notifyOnExtractComplete: boolean;
  soundAlert: boolean;
  desktopNotification: boolean;
  iaCookie?: string;
  rawgApiKey?: string;
  metadataTtlDays?: number;
  theme: 'amoled' | 'kinetic-vault' | 'light';
  cardSize: 'small' | 'medium' | 'large';
  showSizeOnCards: boolean;
  compactMode: boolean;
}
