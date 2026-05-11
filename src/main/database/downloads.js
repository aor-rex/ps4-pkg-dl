const { dbManager } = require('./db');

class DownloadHistory {
  constructor() {
    this.db = dbManager.getDb();
  }

  /**
   * Create a new download record
   */
  create(data) {
    const stmt = this.db.prepare(`
      INSERT INTO downloads (game_id, game_title, file_type, mirror_host, mirror_url, direct_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.gameId || null,
      data.gameTitle || 'Unknown',
      data.fileType || 'Base Game',
      data.mirrorHost || 'Unknown',
      data.mirrorUrl || '',
      data.directUrl || '',
      data.status || 'queued'
    );

    return result.lastInsertRowid;
  }

  /**
   * Update download progress
   */
  updateProgress(id, progress, speed, downloadedBytes) {
    this.db.prepare(`
      UPDATE downloads 
      SET progress = ?, speed = ?, downloaded_bytes = ?, started_at = COALESCE(started_at, datetime('now'))
      WHERE id = ?
    `).run(progress, speed, downloadedBytes, id);
  }

  /**
   * Mark download as started
   */
  markStarted(id) {
    this.db.prepare(`
      UPDATE downloads SET status = 'downloading', started_at = datetime('now') WHERE id = ?
    `).run(id);
  }

  /**
   * Mark download as completed
   */
  markCompleted(id, filepath, filesize) {
    this.db.prepare(`
      UPDATE downloads 
      SET status = 'completed', filepath = ?, filesize = ?, progress = 100, completed_at = datetime('now')
      WHERE id = ?
    `).run(filepath, filesize, id);
  }

  /**
   * Mark download as failed
   */
  markFailed(id, errorMessage) {
    this.db.prepare(`
      UPDATE downloads 
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `).run(errorMessage, id);
  }

  /**
   * Mark download as paused
   */
  markPaused(id) {
    this.db.prepare(`
      UPDATE downloads SET status = 'paused' WHERE id = ?
    `).run(id);
  }

  /**
   * Mark download as cancelled
   */
  markCancelled(id) {
    this.db.prepare(`
      UPDATE downloads SET status = 'cancelled' WHERE id = ?
    `).run(id);
  }

  /**
   * Delete a download record
   */
  delete(id) {
    this.db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
  }

  /**
   * Get a single download by ID
   */
  getById(id) {
    return this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(id);
  }

  /**
   * Get all downloads with optional filter
   */
  getAll(filter = 'all', limit = 50) {
    let query = 'SELECT * FROM downloads';
    const params = [];

    if (filter !== 'all') {
      query += ' WHERE status = ?';
      params.push(filter);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params);
  }

  /**
   * Get active downloads (downloading or paused)
   */
  getActive() {
    return this.db.prepare(`
      SELECT * FROM downloads 
      WHERE status IN ('downloading', 'paused', 'queued')
      ORDER BY created_at ASC
    `).all();
  }

  /**
   * Get completed downloads
   */
  getCompleted(limit = 20) {
    return this.db.prepare(`
      SELECT * FROM downloads 
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get failed downloads
   */
  getFailed(limit = 20) {
    return this.db.prepare(`
      SELECT * FROM downloads 
      WHERE status IN ('failed', 'cancelled')
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get download history for a specific game
   */
  getByGame(gameId, limit = 10) {
    return this.db.prepare(`
      SELECT * FROM downloads 
      WHERE game_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(gameId, limit);
  }

  /**
   * Get download counts by status
   */
  getCounts() {
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM downloads 
      GROUP BY status
    `).all();

    const counts = { all: 0, downloading: 0, paused: 0, queued: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const row of rows) {
      counts[row.status] = row.count;
      counts.all += row.count;
    }
    return counts;
  }

  /**
   * Clear completed downloads
   */
  clearCompleted() {
    return this.db.prepare("DELETE FROM downloads WHERE status = 'completed'").run().changes;
  }

  /**
   * Clear failed downloads
   */
  clearFailed() {
    return this.db.prepare("DELETE FROM downloads WHERE status IN ('failed', 'cancelled')").run().changes;
  }

  /**
   * Clear all download history
   */
  clearAll() {
    return this.db.prepare('DELETE FROM downloads').run().changes;
  }

  /**
   * Get total downloaded bytes
   */
  getTotalDownloaded() {
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(downloaded_bytes), 0) as total FROM downloads WHERE status = 'completed'
    `).get();
    return result.total;
  }

  /**
   * Retry a failed download (reset status to queued)
   */
  retry(id) {
    return this.db.prepare(`
      UPDATE downloads 
      SET status = 'queued', error_message = NULL, progress = 0, started_at = NULL, completed_at = NULL
      WHERE id = ? AND status IN ('failed', 'cancelled')
    `).run(id).changes > 0;
  }

  /**
   * Retry all failed downloads
   */
  retryAllFailed() {
    return this.db.prepare(`
      UPDATE downloads 
      SET status = 'queued', error_message = NULL, progress = 0, started_at = NULL, completed_at = NULL
      WHERE status IN ('failed', 'cancelled')
    `).run().changes;
  }
}

module.exports = { DownloadHistory };
