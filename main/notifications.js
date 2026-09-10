const notifier = require('node-notifier');
const fs = require('fs');
const path = require('path');

let cachedIconPath = null;

/**
 * Real filesystem path for the app icon. The repo/assets icon can't be
 * referenced directly: inside the asar it isn't a real file, and the
 * relative path differs between dev and packaged layouts. Copy once to
 * the config dir and reference that instead.
 */
function appIconPath() {
  if (cachedIconPath) return cachedIconPath;
  try {
    let configDir = null;
    try {
      configDir = require('./settings').getConfigDir();
    } catch (_) {}
    if (!configDir) return undefined;
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const dest = path.join(configDir, 'app-icon.png');
    if (!fs.existsSync(dest)) {
      const src = path.join(__dirname, '..', 'assets', 'icon.png');
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }
    if (fs.existsSync(dest)) cachedIconPath = dest;
  } catch (_) {}
  return cachedIconPath;
}

class NotificationManager {
  constructor() {
    this.enabled = {
      desktopNotification: true,
      downloadComplete: true,
      downloadFailed: true,
      extractComplete: true,
      soundAlert: false,
    };
  }

  /**
   * Set notification preferences
   */
  setPreferences(prefs) {
    if (!prefs) return;
    if (prefs.desktopNotification !== undefined) this.enabled.desktopNotification = !!prefs.desktopNotification;
    if (prefs.downloadComplete !== undefined) this.enabled.downloadComplete = !!prefs.downloadComplete;
    if (prefs.downloadFailed !== undefined) this.enabled.downloadFailed = !!prefs.downloadFailed;
    if (prefs.extractComplete !== undefined) this.enabled.extractComplete = !!prefs.extractComplete;
    if (prefs.soundAlert !== undefined) this.enabled.soundAlert = !!prefs.soundAlert;
  }

  /**
   * Send download complete notification
   */
  sendDownloadComplete(filename, filepath) {
    if (!this.enabled.desktopNotification || !this.enabled.downloadComplete) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Download complete: ${filename}`,
        subtitle: 'Download Finished',
        icon: appIconPath(),
        sound: this.enabled.soundAlert ? true : false,
        wait: false,
      },
      (error) => {
        if (error) {
          console.error('[notifications] Failed to send notification:', error.message);
        }
      }
    );
  }

  /**
   * Send download failed notification
   */
  sendDownloadFailed(filename, error) {
    if (!this.enabled.desktopNotification || !this.enabled.downloadFailed) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Download failed: ${filename}`,
        subtitle: error ? error.substring(0, 100) : 'Unknown error',
        icon: appIconPath(),
        sound: this.enabled.soundAlert ? true : false,
        wait: false,
      },
      (error) => {
        if (error) {
          console.error('[notifications] Failed to send notification:', error.message);
        }
      }
    );
  }

  /**
   * Send extraction complete notification
   */
  sendExtractComplete(archiveName, destination) {
    if (!this.enabled.desktopNotification || !this.enabled.extractComplete) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Extracted: ${archiveName}`,
        subtitle: `Saved to: ${destination}`,
        icon: appIconPath(),
        sound: this.enabled.soundAlert ? true : false,
        wait: false,
      },
      (error) => {
        if (error) {
          console.error('[notifications] Failed to send notification:', error.message);
        }
      }
    );
  }

  /**
   * Send extraction failed notification
   */
  sendExtractFailed(archiveName, error) {
    if (!this.enabled.desktopNotification || !this.enabled.extractComplete) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Extraction failed: ${archiveName}`,
        subtitle: error ? error.substring(0, 100) : 'Unknown error',
        icon: appIconPath(),
        sound: this.enabled.soundAlert ? true : false,
        wait: false,
      },
      (error) => {
        if (error) {
          console.error('[notifications] Failed to send notification:', error.message);
        }
      }
    );
  }

  /**
   * Send a generic notification
   */
  send(title, message, options = {}) {
    if (!this.enabled.desktopNotification && !options.force) return;
    notifier.notify(
      {
        title: title || 'PS4 PKG Downloader',
        message: message || '',
        subtitle: options.subtitle || null,
        icon: options.icon || appIconPath(),
        sound: options.sound || this.enabled.soundAlert,
        wait: options.wait || false,
      },
      (error) => {
        if (error) {
          console.error('[notifications] Failed to send notification:', error.message);
        }
      }
    );
  }
}

module.exports = { NotificationManager };
