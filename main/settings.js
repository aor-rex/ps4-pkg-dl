const fs = require('fs');
const path = require('path');

// Default settings
const DEFAULT_SETTINGS = {
  // General
  downloadDir: path.join(process.env.HOME || process.cwd(), 'Downloads', 'PS4-PKGs'),
  createSubfolder: true,
  
  // Downloads
  maxConcurrentDownloads: 2,
  speedLimit: null, // null = unlimited, or value in bytes/s
  retryCount: 3,
  retryDelay: 30, // seconds
  ytdlpPath: 'yt-dlp',
  useProxy: false,
  proxyUrl: '',
  
  // Extract
  autoExtract: true,
  extractFormats: ['.zip', '.rar', '.7z'],
  extractTo: 'subfolder', // 'subfolder' | 'same' | 'custom'
  customExtractDir: '',
  deleteArchiveAfterExtract: false,
  
  // Catalog sources (user-supplied games.json — empty by default, Settings → Library).
  // [{id, type:'url'|'file', location, label, enabled}]
  catalogs: [],
  catalogTtlHours: 24,
  apiPort: 3100,
  // archive.org login cookie ("logged-in-user=...; logged-in-sig=...") —
  // required because the FPKG items return 401 without it.
  iaCookie: '',

  // Metadata (RAWG enrichment — dev/operator key only, never shipped)
  rawgApiKey: '',
  metadataTtlDays: 30,

  // Network
  downloadTimeout: 300, // seconds
  connectionTimeout: 30, // seconds
  
  // Notifications
  notifyOnComplete: true,
  notifyOnFailed: true,
  notifyOnExtractComplete: true,
  soundAlert: false,
  desktopNotification: true,
};

/**
 * Config directory: XDG-style under .config (was ~/.ps4-pkg-dl).
 * Respects $XDG_CONFIG_HOME; keeps OS conventions on macOS/Windows.
 */
function getConfigDir() {
  const home = process.env.HOME || process.cwd();
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'ps4-pkg-dl');
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'ps4-pkg-dl');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || home, 'ps4-pkg-dl');
  return path.join(home, '.config', 'ps4-pkg-dl');
}

function legacyConfigDir() {
  return path.join(process.env.HOME || process.cwd(), '.ps4-pkg-dl');
}

/**
 * One-time move from ~/.ps4-pkg-dl to the new location. Moves only when the
 * target is missing/empty so existing new-location data is never overwritten.
 */
function ensureConfigDir() {
  const target = getConfigDir();
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  try {
    const legacy = legacyConfigDir();
    if (target === legacy || !fs.existsSync(legacy)) return;
    if (fs.readdirSync(target).length > 0) return;
    const entries = fs.readdirSync(legacy);
    if (entries.length === 0) return;
    for (const name of entries) {
      fs.renameSync(path.join(legacy, name), path.join(target, name));
    }
    console.error(`[settings] migrated config ${legacy} -> ${target}`);
  } catch (error) {
    console.error(`[settings] config migration failed: ${error.message}`);
  }
  return target;
}
class SettingsManager {
  /**
   * @param {string} [options.configPath] - Custom config file path
   */
  constructor(options = {}) {
    this.configDir = options.configDir || getConfigDir();
    this.configPath = options.configPath || path.join(this.configDir, 'settings.json');
    this.settings = { ...DEFAULT_SETTINGS };

    // Ensure config directory exists (migrates legacy ~/.ps4-pkg-dl once,
    // unless the caller pointed at a custom location e.g. in tests)
    if (!options.configDir && !options.configPath) ensureConfigDir();
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }
  
  /**
   * Load settings from file
   */
  load() {
    if (!fs.existsSync(this.configPath)) {
      this.save(); // Create default settings file
      return this.settings;
    }
    
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      const loaded = JSON.parse(data);
      
      // Merge with defaults (only override known settings)
      this.settings = { ...DEFAULT_SETTINGS, ...loaded };
      
      return this.settings;
    } catch (error) {
      console.error(`[settings] Failed to load settings: ${error.message}`);
      this.settings = { ...DEFAULT_SETTINGS };
      this.save();
      return this.settings;
    }
  }
  
  /**
   * Save settings to file
   */
  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      console.error(`[settings] Failed to save settings: ${error.message}`);
    }
  }
  
  /**
   * Get a setting value
   */
  get(key) {
    if (key.includes('.')) {
      // Nested key not used in current settings, but support for future
      const parts = key.split('.');
      let value = this.settings;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }
    return this.settings[key];
  }
  
  /**
   * Set a setting value
   */
  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) {
      console.warn(`[settings] Unknown setting: ${key}`);
    }
    this.settings[key] = value;
    this.save();
  }
  
  /**
   * Get all settings
   */
  getAll() {
    return { ...this.settings };
  }
  
  /**
   * Reset settings to defaults
   */
  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return this.settings;
  }
  
  /**
   * Get download directory, ensuring it exists
   */
  getDownloadDir() {
    const dir = this.settings.downloadDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
  
  /**
   * Set download directory
   */
  setDownloadDir(dir) {
    this.settings.downloadDir = dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.save();
  }
  
  /**
   * Remove a setting key (used by migrations)
   */
  remove(key) {
    delete this.settings[key];
    this.save();
  }

  /**
   * Get config file path
   */
  getConfigPath() {
    return this.configPath;
  }
  
  /**
   * Get config directory
   */
  getConfigDir() {
    return this.configDir;
  }
}

module.exports = { SettingsManager, DEFAULT_SETTINGS, getConfigDir, ensureConfigDir, legacyConfigDir };
