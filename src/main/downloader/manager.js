const { DownloadEngine } = require('./engine');
const path = require('path');
const EventEmitter = require('events');

/**
 * Download queue manager with concurrent download support
 */
class DownloadManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.downloadDir - Default download directory
   * @param {number} [options.maxConcurrent=2] - Max concurrent downloads (1-5)
   * @param {number} [options.retryCount=3] - Default retry count
   * @param {number} [options.retryDelay=30000] - Default retry delay (ms)
   */
  constructor(options = {}) {
    super();
    
    this.downloadDir = options.downloadDir || path.join(process.cwd(), 'downloads');
    this.maxConcurrent = Math.min(5, Math.max(1, options.maxConcurrent || 2));
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 30000;
    
    // Download collections
    this.downloads = new Map(); // id -> DownloadEngine
    this.queue = []; // Array of download configs waiting to start
    this.completed = []; // Array of completed download info
    this.failed = []; // Array of failed download info
    
    // Track active count
    this.activeCount = 0;
  }
  
  /**
   * Add a download to the queue
   * @param {Object} config
   * @param {string} config.url - Direct download URL
   * @param {string} [config.destination] - Custom destination (uses default downloadDir if not set)
   * @param {string} [config.filename] - Custom filename
   * @param {string} [config.label] - Human-readable label (e.g., "God of War - Base Game")
   * @param {string} [config.source] - Source mirror name (e.g., "MediaFire")
   * @param {string} [config.gameTitle] - Associated game title
   * @returns {string} downloadId
   */
  add(config) {
    const destination = config.destination || this.downloadDir;
    
    const engine = new DownloadEngine({
      url: config.url,
      destination,
      filename: config.filename || null,
      retryCount: this.retryCount,
      retryDelay: this.retryDelay,
    });
    
    const downloadInfo = {
      id: engine.id,
      label: config.label || engine.filename || 'Unknown',
      source: config.source || 'Unknown',
      gameTitle: config.gameTitle || null,
      url: config.url,
      destination,
      addedAt: Date.now(),
    };
    
    this.downloads.set(engine.id, engine);
    
    // Bind engine events
    this.bindEngineEvents(engine, downloadInfo);
    
    // If we're under the concurrent limit, start immediately
    if (this.activeCount < this.maxConcurrent) {
      engine.start();
      this.activeCount++;
    } else {
      // Add to queue
      this.queue.push({ engine, info: downloadInfo });
    }
    
    this.emit('added', downloadInfo);
    
    return engine.id;
  }
  
  /**
   * Bind events from a download engine
   */
  bindEngineEvents(engine, info) {
    engine.on('start', (data) => {
      this.emit('download:start', { ...info, ...data });
    });
    
    engine.on('progress', (data) => {
      this.emit('download:progress', { ...info, ...data });
    });
    
    engine.on('complete', (data) => {
      this.activeCount--;
      
      // Move to completed list
      this.completed.push({
        ...info,
        ...data,
        completedAt: Date.now(),
      });
      
      this.emit('download:complete', { ...info, ...data });
      
      // Start next in queue
      this.processQueue();
    });
    
    engine.on('paused', () => {
      this.emit('download:paused', info);
    });
    
    engine.on('resumed', () => {
      this.emit('download:resumed', info);
    });
    
    engine.on('error', (data) => {
      this.emit('download:error', { ...info, ...data });
      
      if (!data.retryable) {
        this.activeCount--;
        
        // Move to failed list
        this.failed.push({
          ...info,
          ...data,
          failedAt: Date.now(),
        });
        
        this.emit('download:failed', { ...info, ...data });
        
        // Start next in queue
        this.processQueue();
      }
    });
    
    engine.on('cancelled', () => {
      this.activeCount--;
      this.emit('download:cancelled', info);
      this.processQueue();
    });
    
    engine.on('retrying', (data) => {
      this.emit('download:retrying', { ...info, ...data });
    });
  }
  
  /**
   * Process the next download in queue
   */
  processQueue() {
    if (this.queue.length === 0) {
      return;
    }
    
    if (this.activeCount >= this.maxConcurrent) {
      return;
    }
    
    const next = this.queue.shift();
    next.engine.start();
    this.activeCount++;
  }
  
  /**
   * Pause a download
   */
  async pause(id) {
    const engine = this.downloads.get(id);
    if (!engine) return false;
    
    return await engine.pause();
  }
  
  /**
   * Resume a download
   */
  async resume(id) {
    const engine = this.downloads.get(id);
    if (!engine) return false;
    
    return await engine.resume();
  }
  
  /**
   * Cancel a download
   */
  async cancel(id, deleteFile = true) {
    const engine = this.downloads.get(id);
    if (!engine) return false;
    
    // Remove from queue if it's queued
    const queueIndex = this.queue.findIndex(item => item.engine.id === id);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }
    
    return await engine.cancel(deleteFile);
  }
  
  /**
   * Retry a failed download
   */
  async retry(id) {
    const engine = this.downloads.get(id);
    if (!engine) return false;
    
    // Remove from failed list
    this.failed = this.failed.filter(d => d.id !== id);
    
    return await engine.retry();
  }
  
  /**
   * Retry all failed downloads
   */
  async retryAllFailed() {
    const results = [];
    for (const failed of this.failed) {
      results.push(await this.retry(failed.id));
    }
    return results;
  }
  
  /**
   * Get status of a specific download
   */
  getStatus(id) {
    const engine = this.downloads.get(id);
    if (!engine) return null;
    
    return engine.getStatus();
  }
  
  /**
   * Get all downloads by state
   */
  getAll(filter = 'all') {
    const results = [];
    
    for (const [id, engine] of this.downloads) {
      const status = engine.getStatus();
      
      if (filter === 'all') {
        results.push(status);
      } else if (filter === 'active' && status.state === 'downloading') {
        results.push(status);
      } else if (filter === 'queued' && status.state === 'idle') {
        results.push(status);
      } else if (filter === 'completed' && status.state === 'completed') {
        results.push(status);
      } else if (filter === 'failed' && (status.state === 'failed' || status.state === 'cancelled')) {
        results.push(status);
      }
    }
    
    // Add completed/failed from history
    if (filter === 'all' || filter === 'completed') {
      results.push(...this.completed);
    }
    if (filter === 'all' || filter === 'failed') {
      results.push(...this.failed);
    }
    
    return results;
  }
  
  /**
   * Get active download count
   */
  getActiveCount() {
    return this.activeCount;
  }
  
  /**
   * Get queue length
   */
  getQueueLength() {
    return this.queue.length;
  }
  
  /**
   * Get completed count
   */
  getCompletedCount() {
    return this.completed.length;
  }
  
  /**
   * Clear completed downloads
   */
  clearCompleted() {
    const count = this.completed.length;
    this.completed = [];
    return count;
  }
  
  /**
   * Clear failed downloads
   */
  clearFailed() {
    const count = this.failed.length;
    this.failed = [];
    return count;
  }
  
  /**
   * Set max concurrent downloads
   */
  setMaxConcurrent(max) {
    this.maxConcurrent = Math.min(5, Math.max(1, max));
    
    // Process queue if we increased the limit
    this.processQueue();
  }
  
  /**
   * Set download directory
   */
  setDownloadDir(dir) {
    this.downloadDir = dir;
  }
  
  /**
   * Pause all active downloads
   */
  async pauseAll() {
    const results = [];
    for (const [id, engine] of this.downloads) {
      if (engine.state === 'downloading') {
        results.push(await engine.pause());
      }
    }
    return results;
  }
  
  /**
   * Resume all paused downloads (up to max concurrent)
   */
  async resumeAll() {
    const results = [];
    let resumed = 0;
    
    for (const [id, engine] of this.downloads) {
      if (engine.state === 'paused' && resumed < this.maxConcurrent) {
        results.push(await engine.resume());
        resumed++;
      }
    }
    return results;
  }
}

module.exports = { DownloadManager };
