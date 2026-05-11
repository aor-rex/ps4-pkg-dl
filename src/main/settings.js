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
 * Settings manager - loads/saves from JSON file
 */
class SettingsManager {
  /**
   * @param {string} [options.configPath] - Custom config file path
   */
  constructor(options = {}) {
    this.configDir = path.join(process.env.HOME || process.cwd(), '.ps4-pkg-dl');
    this.configPath = options.configPath || path.join(this.configDir, 'settings.json');
    this.settings = { ...DEFAULT_SETTINGS };
    
    // Ensure config directory exists
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
   * Check if yt-dlp is available
   */
  async checkYtDlp() {
    const { checkYtDlp } = require('./scraper/mirror-resolver');
    return await checkYtDlp(this.settings.ytdlpPath);
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

module.exports = { SettingsManager, DEFAULT_SETTINGS };
