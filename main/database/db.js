const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database directory
const DB_DIR = path.join(process.env.HOME || process.cwd(), '.ps4-pkg-dl');
const DB_PATH = path.join(DB_DIR, 'ps4pkg.db');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database connection and create tables if needed
   */
  initialize() {
    // Ensure directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    this.db = new Database(DB_PATH);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.createTables();
    this.initialized = true;

    return this;
  }

  /**
   * Create all database tables
   */
  createTables() {
    this.db.exec(`
      -- Games table
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        cover TEXT,
        size TEXT,
        region TEXT,
        version TEXT,
        description TEXT,
        date_added TEXT,
        last_scraped TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Game images
      CREATE TABLE IF NOT EXISTS game_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        is_cover INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      -- Game videos
      CREATE TABLE IF NOT EXISTS game_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        video_url TEXT NOT NULL,
        embed_url TEXT,
        title TEXT DEFAULT 'Video',
        duration TEXT,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      -- Download links / mirrors (cached)
      CREATE TABLE IF NOT EXISTS game_mirrors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        file_type TEXT DEFAULT 'Base Game',
        file_size TEXT,
        mirror_host TEXT NOT NULL,
        mirror_url TEXT NOT NULL,
        original_url TEXT,
        mirror_label TEXT,
        reliability_score REAL DEFAULT 0.5,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        last_resolved TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      -- Game metadata (RAWG enrichment, keyed by CUSA title id)
      CREATE TABLE IF NOT EXISTS metadata (        title_id TEXT PRIMARY KEY,
        rawg_id INTEGER,
        rawg_slug TEXT,
        name TEXT,
        genres TEXT,
        description TEXT,
        metacritic INTEGER,
        rating REAL,
        screenshots TEXT,
        trailers TEXT,
        match_confidence TEXT,
        fetched_at TEXT DEFAULT (datetime('now'))
      );

      -- Catalog sightings: first-seen date per CUSA (powers "New" view).
      -- Rows are only ever inserted, never updated.
      CREATE TABLE IF NOT EXISTS catalog_sightings (
        title_id TEXT PRIMARY KEY,
        first_seen TEXT DEFAULT (datetime('now'))
      );
    `);

    // Guarded migration for pre-existing databases
    try {
      this.db.exec('ALTER TABLE metadata ADD COLUMN ps4 INTEGER DEFAULT NULL');
    } catch {
      /* column already exists */
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        game_title TEXT,
        file_type TEXT DEFAULT 'Base Game',
        mirror_host TEXT,
        mirror_url TEXT,
        direct_url TEXT,
        status TEXT DEFAULT 'queued',
        progress REAL DEFAULT 0,
        speed REAL DEFAULT 0,
        filepath TEXT,
        filesize INTEGER,
        downloaded_bytes INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
      );

      -- Settings
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Cache metadata
      CREATE TABLE IF NOT EXISTS cache_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Create indexes for faster queries
      CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);
      CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
      CREATE INDEX IF NOT EXISTS idx_game_images_game_id ON game_images(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_videos_game_id ON game_videos(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_mirrors_game_id ON game_mirrors(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_mirrors_host ON game_mirrors(mirror_host);
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_downloads_game_id ON downloads(game_id);
      CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cache_meta_expires ON cache_meta(expires_at);
    `);
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Get the database instance
   */
  getDb() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.db;
  }

  /**
   * Get database file path
   */
  getDbPath() {
    return DB_PATH;
  }

  /**
   * Get database directory path
   */
  getDbDir() {
    return DB_DIR;
  }

  /**
   * Get database file size in bytes
   */
  getDbSize() {
    if (!fs.existsSync(DB_PATH)) return 0;
    return fs.statSync(DB_PATH).size;
  }

  /**
   * Format bytes to human-readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  }

  /**
   * Vacuum the database (reclaim space)
   */
  vacuum() {
    this.db.exec('VACUUM');
  }

  /**
   * Get database statistics
   */
  getStats() {
    const games = this.db.prepare('SELECT COUNT(*) as count FROM games').get();
    const mirrors = this.db.prepare('SELECT COUNT(*) as count FROM game_mirrors').get();
    const downloads = this.db.prepare('SELECT COUNT(*) as count FROM downloads').get();
    const images = this.db.prepare('SELECT COUNT(*) as count FROM game_images').get();
    const videos = this.db.prepare('SELECT COUNT(*) as count FROM game_videos').get();
    const cacheEntries = this.db.prepare('SELECT COUNT(*) as count FROM cache_meta').get();

    return {
      games: games.count,
      mirrors: mirrors.count,
      downloads: downloads.count,
      images: images.count,
      videos: videos.count,
      cacheEntries: cacheEntries.count,
      dbSize: this.formatBytes(this.getDbSize()),
      dbPath: DB_PATH,
    };
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = { DatabaseManager, dbManager, DB_DIR, DB_PATH };
