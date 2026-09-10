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
   * @param {Object} [options.defaultHeaders] - Extra HTTP headers for every download
   */
  constructor(options = {}) {
    super();
    
    this.downloadDir = options.downloadDir || path.join(process.cwd(), 'downloads');
    this.maxConcurrent = Math.min(5, Math.max(1, options.maxConcurrent || 2));
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 30000;
    this.defaultHeaders = options.defaultHeaders || null;
    
    // Download collections
    this.downloads = new Map(); // id -> DownloadEngine
    this.queue = []; // Array of download configs waiting to start
    this.completed = []; // Array of completed download info
    this.failed = []; // Array of failed download info
    
    // Track active count (kept in sync with activeIds — the single source of truth)
    this.activeCount = 0;
    this.activeIds = new Set();
  }

  /** Take a concurrency slot for id. Idempotent-safe: false when full or held. */
  _acquire(id) {
    if (!id || this.activeIds.has(id)) return this.activeIds.has(id);
    if (this.activeCount >= this.maxConcurrent) return false;
    this.activeIds.add(id);
    this.activeCount++;
    return true;
  }

  /** Release id's slot. No-op when it holds none (e.g. idle cancel). */
  _release(id) {
    if (!id || !this.activeIds.delete(id)) return false;
    this.activeCount = Math.max(0, this.activeCount - 1);
    return true;
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
      headers: config.headers || this.defaultHeaders || null,
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
    engine.info = downloadInfo;

    // Bind engine events
    this.bindEngineEvents(engine, downloadInfo);

    // If we're under the concurrent limit, start immediately
    if (this._acquire(engine.id)) {
      try {
        engine.start();
      } catch (_) {
        this._release(engine.id);
      }
    } else {
      // Add to queue
      this.queue.push({ engine, info: downloadInfo });
    }

    this.emit('added', downloadInfo);

    return engine.id;
  }
  
  /**
   * Restore an interrupted download as paused (survives restarts).
   * Unlike add(), never starts the engine and never touches the queue —
   * the user resumes explicitly. Engine resumes from partial files on disk.
   */
  restorePaused(config) {
    const destination = config.destination || this.downloadDir;

    const engine = new DownloadEngine({
      url: config.url,
      destination,
      filename: config.filename || null,
      retryCount: this.retryCount,
      retryDelay: this.retryDelay,
      headers: config.headers || this.defaultHeaders || null,
    });

    const downloadInfo = {
      id: engine.id,
      label: config.label || engine.filename || 'Unknown',
      source: config.source || 'Unknown',
      gameTitle: config.gameTitle || null,
      url: config.url,
      destination,
      addedAt: Date.now(),
      restored: true,
    };

    // Paused with unknown progress until the user resumes (live ticks correct it)
    engine.state = 'paused';
    engine.stats = { totalBytes: 0, downloadedBytes: 0, speed: 0, eta: null, percent: 0 };

    this.downloads.set(engine.id, engine);
    engine.info = downloadInfo;
    this.bindEngineEvents(engine, downloadInfo);
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
      this._release(engine.id);

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
      // Free the slot so queued items can start; resume re-acquires it.
      this._release(engine.id);
      this.emit('download:paused', info);
    });
    
    engine.on('resumed', () => {
      this.emit('download:resumed', info);
    });
    
    engine.on('error', (data) => {
      this.emit('download:error', { ...info, ...data });
      // Retryable errors self-heal (bounded by engine.retryCount); the slot
      // is reused, so no accounting change. Terminal errors fall through.
      if (data.retryable) {
        Promise.resolve(engine.retry()).catch(() => {});
        return;
      }
      this._release(engine.id);

      // Move to failed list
      this.failed.push({
        ...info,
        ...data,
        failedAt: Date.now(),
      });

      this.emit('download:failed', { ...info, ...data });

      // Start next in queue
      this.processQueue();
    });

    engine.on('cancelled', () => {
      this._release(engine.id);
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
    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (!this._acquire(next.engine.id)) return;
      this.queue.shift();
      try {
        next.engine.start();
      } catch (_) {
        this._release(next.engine.id);
      }
    }
  }

  /**
   * Pause a download. Frees its concurrency slot so queued items can start.
   * Idle (never-started) engines are marked paused + dequeued; already-paused
   * is a no-op success.
   */
  async pause(id) {
    const engine = this.downloads.get(id);
    if (!engine) return false;
    if (engine.state === 'paused') return true;
    if (engine.state === 'idle' || !engine.downloader) {
      const qi = this.queue.findIndex((item) => item.engine.id === id);
      if (qi !== -1) this.queue.splice(qi, 1);
      engine.state = 'paused';
      this.emit('download:paused', { id });
      return true;
    }

    return await engine.pause();
  }

  /**
   * Resume a download. Takes a slot when free; otherwise the engine waits in
   * the queue and starts automatically (never runs over the limit).
   */
  async resume(id) {
    const engine = this.downloads.get(id);
    if (!engine || engine.state !== 'paused') return false;
    if (!this._acquire(id)) {
      if (!this.queue.some((item) => item.engine.id === id)) {
        this.queue.push({ engine, info: engine.info || { id } });
      }
      return true;
    }
    const ok = await engine.resume();
    if (!ok) this._release(id);
    return ok;
  }

  /**
   * Cancel a download. Idle engines never held a slot; the explicit emit
   * keeps persistence/UI in sync where the engine itself stays silent.
   */
  async cancel(id, deleteFile = true) {
    const engine = this.downloads.get(id);
    if (!engine) return false;

    // Remove from queue if it's queued
    const queueIndex = this.queue.findIndex((item) => item.engine.id === id);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    const hadDownloader = !!engine.downloader;
    const ok = await engine.cancel(deleteFile);
    if (!hadDownloader || engine.state === 'paused') {
      // Engine stayed silent (never started, or stopped-while-paused):
      // force the terminal state + event so persistence and UI agree.
      engine.state = 'cancelled';
      this.emit('download:cancelled', engine.info || { id });
    }
    return ok;
  }

  /**
   * Retry a failed download (slot-gated like resume).
   */
  async retry(id) {
    const engine = this.downloads.get(id);
    if (!engine) return false;

    // Remove from failed list
    this.failed = this.failed.filter((d) => d.id !== id);

    if (!this._acquire(id)) {
      if (!this.queue.some((item) => item.engine.id === id)) {
        this.queue.push({ engine, info: engine.info || { id } });
      }
      return true;
    }
    const ok = await engine.retry();
    if (!ok) this._release(id);
    return ok;
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
   * Live engine currently handling a PKG url (re-download detection)
   */
  findByUrl(pkgUrl) {
    if (!pkgUrl) return null;
    for (const engine of this.downloads.values()) {
      if (engine && engine.url === pkgUrl) return engine;
    }
    return null;
  }

  /**
   * Drop one entry from the completed list (record removal keeps the file)
   */
  removeCompleted(id) {
    const before = this.completed.length;
    this.completed = this.completed.filter((d) => d && d.id !== id);
    return before - this.completed.length;
  }

  /**
   * Merge persisted completed rows back after restart (idempotent)
   */
  restoreCompleted(items) {
    const seen = new Set(this.completed.map((d) => d && d.id));
    let added = 0;
    for (const item of items || []) {
      if (!item || !item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      this.completed.push(item);
      added++;
    }
    return added;
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
   * Set default headers (e.g. archive.org login Cookie)
   */
  setDefaultHeaders(headers) {
    this.defaultHeaders = headers || null;
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
