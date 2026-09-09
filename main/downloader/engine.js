const { DownloaderHelper } = require('node-downloader-helper');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * Single download engine instance wrapping node-downloader-helper
 */
class DownloadEngine extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.url - Direct download URL
   * @param {string} options.destination - Directory to save the file
   * @param {string} [options.filename] - Custom filename (auto-detected if not provided)
   * @param {number} [options.retryCount=3] - Number of retries on failure
   * @param {number} [options.retryDelay=30000] - Delay between retries (ms)
   * @param {number} [options.timeout=300000] - Download timeout (ms)
   * @param {number|null} [options.speedLimit=null] - Speed limit in bytes/s (null = unlimited)
   * @param {Object} [options.headers] - Extra HTTP headers (e.g. archive.org login Cookie)
   */
  constructor(options) {
    super();
    
    this.id = this.generateId();
    this.url = options.url;
    this.destination = options.destination;
    this.filename = options.filename || null;
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 30000;
    this.timeout = options.timeout || 300000;
    this.speedLimit = options.speedLimit || null;
    this.headers = options.headers || null;
    
    this.downloader = null;
    this.state = 'idle'; // idle, downloading, paused, resumed, completed, failed, cancelled, retrying
    this.retries = 0;
    this.error = null;
    
    this.stats = {
      totalBytes: 0,
      downloadedBytes: 0,
      speed: 0,
      eta: Infinity,
      percent: 0,
    };
    
    this.startTime = null;
    this.endTime = null;
  }
  
  /**
   * Start the download
   */
  start() {
    if (this.state === 'downloading') {
      return;
    }
    
    this.state = 'downloading';
    this.startTime = Date.now();
    this.error = null;
    
    const dlOptions = {
      method: 'GET',
      override: false, // Don't override existing files
      fileName: this.filename,
      timeout: this.timeout,
      headers: this.headers || {},
      httpsRequestOptions: {},
      resume: true, // Enable resume support
      removeOnStop: false, // Keep partial files on pause
      removeOnFail: false, // Keep partial files on failure
    };
    
    // Ensure destination directory exists
    if (!fs.existsSync(this.destination)) {
      fs.mkdirSync(this.destination, { recursive: true });
    }
    
    this.downloader = new DownloaderHelper(this.url, this.destination, dlOptions);
    
    // Apply speed limit if set
    if (this.speedLimit) {
      this.downloader.setMaxSpeed(this.speedLimit);
    }
    
    // Event: Download started
    this.downloader.on('start', () => {
      this.state = 'downloading';
      this.emit('start', {
        id: this.id,
        url: this.url,
        filename: this.downloader.getDownloadPath(),
      });
    });
    
    // Event: Progress
    this.downloader.on('progress', (stats) => {
      this.stats = {
        totalBytes: stats.total || 0,
        downloadedBytes: stats.downloaded || 0,
        speed: stats.speed || 0,
        eta: stats.eta ?? null,
        percent: stats.progress || 0,
      };

      this.emit('progress', {
        id: this.id,
        ...this.stats,
      });
    });
    
    // Event: Download completed
    this.downloader.on('end', (downloadStats) => {
      this.state = 'completed';
      this.endTime = Date.now();
      this.stats.percent = 100;
      
      const filePath = path.join(this.destination, this.downloader.getDownloadPath());
      
      this.emit('complete', {
        id: this.id,
        path: filePath,
        filename: this.downloader.getDownloadPath(),
        size: downloadStats.totalSize,
        duration: this.endTime - this.startTime,
      });
    });
    
    // Event: Download paused
    this.downloader.on('pause', () => {
      this.state = 'paused';
      this.emit('paused', { id: this.id });
    });
    
    // Event: Download resumed
    this.downloader.on('resume', () => {
      this.state = 'downloading';
      this.emit('resumed', { id: this.id });
    });
    
    // Event: Error
    this.downloader.on('error', (error) => {
      this.error = error.message;
      
      // Don't emit error if we're retrying
      if (this.state === 'retrying') {
        return;
      }
      
      this.state = 'failed';
      this.emit('error', {
        id: this.id,
        error: error.message,
        retryable: this.retries < this.retryCount,
      });
    });
    
    // Event: Download stopped (for cancel)
    this.downloader.on('stop', () => {
      // Only set to cancelled if explicitly cancelled, not on pause
      if (this.state !== 'paused') {
        this.state = 'cancelled';
        this.emit('cancelled', { id: this.id });
      }
    });
    
    // Start the download
    this.downloader.start().catch((err) => {
      this.state = 'failed';
      this.error = err.message;
      this.emit('error', {
        id: this.id,
        error: err.message,
        retryable: this.retries < this.retryCount,
      });
    });
  }
  
  /**
   * Pause the download
   */
  async pause() {
    if (!this.downloader || this.state !== 'downloading') {
      return false;
    }
    
    try {
      await this.downloader.pause();
      return true;
    } catch (error) {
      this.error = error.message;
      return false;
    }
  }
  
  /**
   * Resume the download
   */
  async resume() {
    if (!this.downloader || this.state !== 'paused') {
      return false;
    }
    
    try {
      await this.downloader.resume();
      return true;
    } catch (error) {
      this.error = error.message;
      return false;
    }
  }
  
  /**
   * Cancel and delete the partial download
   */
  async cancel(deleteFile = true) {
    if (!this.downloader) {
      this.state = 'cancelled';
      return true;
    }
    
    try {
      await this.downloader.stop();
      
      if (deleteFile) {
        const filePath = path.join(this.destination, this.downloader.getDownloadPath());
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      this.state = 'cancelled';
      return true;
    } catch (error) {
      this.error = error.message;
      return false;
    }
  }
  
  /**
   * Retry the download
   */
  async retry() {
    if (this.retries >= this.retryCount) {
      return false;
    }
    
    this.retries++;
    this.state = 'retrying';
    this.error = null;
    
    this.emit('retrying', { id: this.id, attempt: this.retries });
    
    // Wait before retrying
    await this.sleep(this.retryDelay);
    
    // Create a new downloader instance
    this.downloader = null;
    this.start();
    
    return true;
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      id: this.id,
      url: this.url,
      state: this.state,
      filename: this.downloader ? this.downloader.getDownloadPath() : this.filename,
      stats: this.stats,
      retries: this.retries,
      error: this.error,
      startTime: this.startTime,
      endTime: this.endTime,
    };
  }
  
  /**
   * Generate a unique ID
   */
  generateId() {
    return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { DownloadEngine };
