const notifier = require('node-notifier');
const path = require('path');

class NotificationManager {
  constructor() {
    this.enabled = {
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
    if (prefs.downloadComplete !== undefined) this.enabled.downloadComplete = prefs.downloadComplete;
    if (prefs.downloadFailed !== undefined) this.enabled.downloadFailed = prefs.downloadFailed;
    if (prefs.extractComplete !== undefined) this.enabled.extractComplete = prefs.extractComplete;
    if (prefs.soundAlert !== undefined) this.enabled.soundAlert = prefs.soundAlert;
  }

  /**
   * Send download complete notification
   */
  sendDownloadComplete(filename, filepath) {
    if (!this.enabled.downloadComplete) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Download complete: ${filename}`,
        subtitle: 'Download Finished',
        icon: path.join(__dirname, '../../../assets/icon.png'),
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
    if (!this.enabled.downloadFailed) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Download failed: ${filename}`,
        subtitle: error ? error.substring(0, 100) : 'Unknown error',
        icon: path.join(__dirname, '../../../assets/icon.png'),
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
    if (!this.enabled.extractComplete) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Extracted: ${archiveName}`,
        subtitle: `Saved to: ${destination}`,
        icon: path.join(__dirname, '../../../assets/icon.png'),
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
    if (!this.enabled.extractComplete) return;

    notifier.notify(
      {
        title: 'PS4 PKG Downloader',
        message: `Extraction failed: ${archiveName}`,
        subtitle: error ? error.substring(0, 100) : 'Unknown error',
        icon: path.join(__dirname, '../../../assets/icon.png'),
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
    notifier.notify(
      {
        title: title || 'PS4 PKG Downloader',
        message: message || '',
        subtitle: options.subtitle || null,
        icon: options.icon || path.join(__dirname, '../../../assets/icon.png'),
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
