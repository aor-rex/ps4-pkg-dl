const { dbManager } = require('./db');

// Cache expiration: 24 hours
const CACHE_TTL_HOURS = 24;

class GameCache {
  constructor() {
    this.db = dbManager.getDb();
  }

  /**
   * Save or update a game in the cache
   * @param {Object} game - Game data from scraper
   * @returns {number} game id
   */
  saveGame(game) {
    // Check if game exists
    const existing = this.db.prepare('SELECT id FROM games WHERE slug = ?').get(game.slug);

    if (existing) {
      // Update
      this.db.prepare(`
        UPDATE games 
        SET title = ?, url = ?, cover = ?, size = ?, region = ?, version = ?, 
            description = ?, date_added = ?, last_scraped = datetime('now')
        WHERE slug = ?
      `).run(
        game.title, game.url, game.cover, game.size || null,
        game.region || null, game.version || null,
        game.description || null, game.date || null,
        game.slug
      );
      return existing.id;
    } else {
      // Insert
      const result = this.db.prepare(`
        INSERT INTO games (title, slug, url, cover, size, region, version, description, date_added, last_scraped)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        game.title, game.slug, game.url, game.cover || null,
        game.size || null, game.region || null, game.version || null,
        game.description || null, game.date || null
      );
      return result.lastInsertRowid;
    }
  }

  /**
   * Save game images
   * @param {number} gameId - Game ID
   * @param {string[]} images - Array of image URLs
   */
  saveImages(gameId, images) {
    // Delete existing images
    this.db.prepare('DELETE FROM game_images WHERE game_id = ?').run(gameId);

    // Insert new images
    const stmt = this.db.prepare(`
      INSERT INTO game_images (game_id, image_url, is_cover, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((images) => {
      for (let i = 0; i < images.length; i++) {
        stmt.run(gameId, images[i], i === 0 ? 1 : 0, i);
      }
    });

    insertMany(images);
  }

  /**
   * Save game videos
   * @param {number} gameId - Game ID
   * @param {Object[]} videos - Array of video objects
   */
  saveVideos(gameId, videos) {
    // Delete existing videos
    this.db.prepare('DELETE FROM game_videos WHERE game_id = ?').run(gameId);

    const stmt = this.db.prepare(`
      INSERT INTO game_videos (game_id, video_url, embed_url, title, duration)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((videos) => {
      for (const v of videos) {
        stmt.run(gameId, v.url, v.embedUrl || null, v.title || 'Video', v.duration || null);
      }
    });

    insertMany(videos);
  }

  /**
   * Save mirrors for a game
   * @param {number} gameId - Game ID
   * @param {Object[]} mirrors - Array of mirror objects
   */
  saveMirrors(gameId, mirrors) {
    // Delete existing mirrors
    this.db.prepare('DELETE FROM game_mirrors WHERE game_id = ?').run(gameId);

    const stmt = this.db.prepare(`
      INSERT INTO game_mirrors (game_id, file_type, file_size, mirror_host, mirror_url, original_url, mirror_label)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((mirrors) => {
      for (const m of mirrors) {
        stmt.run(
          gameId,
          m.type || 'Base Game',
          m.size || null,
          m.host || 'Unknown',
          m.url,
          m.originalUrl || null,
          m.label || m.host || 'File'
        );
      }
    });

    insertMany(mirrors);
  }

  /**
   * Save complete game data (game + images + videos + mirrors)
   * @param {Object} game - Full game object from scraper
   * @returns {number} game id
   */
  saveFullGame(game) {
    const gameId = this.saveGame(game);

    if (game.gallery && game.gallery.length > 0) {
      this.saveImages(gameId, game.gallery);
    }

    if (game.videos && game.videos.length > 0) {
      this.saveVideos(gameId, game.videos);
    }

    if (game.downloads && game.downloads.length > 0) {
      // Flatten downloads to mirrors
      const allMirrors = [];
      for (const group of game.downloads) {
        for (const m of group.mirrors) {
          allMirrors.push({
            ...m,
            type: group.type || 'Base Game',
            size: group.size || null,
          });
        }
      }
      if (allMirrors.length > 0) {
        this.saveMirrors(gameId, allMirrors);
      }
    }

    return gameId;
  }

  /**
   * Get a game by slug (from cache)
   * @param {string} slug - Game slug
   * @param {boolean} includeMirrors - Whether to include mirrors
   * @returns {Object|null} Game object or null
   */
  getBySlug(slug, includeMirrors = true) {
    const game = this.db.prepare('SELECT * FROM games WHERE slug = ?').get(slug);
    if (!game) return null;

    return this.enrichGame(game, includeMirrors);
  }

  /**
   * Get a game by ID
   * @param {number} id - Game ID
   * @param {boolean} includeMirrors - Whether to include mirrors
   * @returns {Object|null} Game object or null
   */
  getById(id, includeMirrors = true) {
    const game = this.db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) return null;

    return this.enrichGame(game, includeMirrors);
  }

  /**
   * Enrich a game record with images, videos, and mirrors
   */
  enrichGame(game, includeMirrors) {
    const result = { ...game };

    // Get images
    result.gallery = this.db.prepare(`
      SELECT image_url FROM game_images WHERE game_id = ? ORDER BY sort_order ASC
    `).all(game.id).map(row => row.image_url);

    // Get cover
    result.cover = result.gallery[0] || result.cover;

    // Get videos
    result.videos = this.db.prepare(`
      SELECT video_url as url, embed_url as embedUrl, title, duration 
      FROM game_videos WHERE game_id = ?
    `).all(game.id);

    // Get mirrors if requested
    if (includeMirrors) {
      const mirrors = this.db.prepare(`
        SELECT mirror_host as host, mirror_url as url, original_url as originalUrl,
               file_type as type, file_size as size, mirror_label as label,
               reliability_score, success_count, fail_count
        FROM game_mirrors WHERE game_id = ?
        ORDER BY reliability_score DESC
      `).all(game.id);

      result.downloads = this.groupMirrorsByType(mirrors);
    }

    return result;
  }

  /**
   * Group mirrors by file type (Base Game, Update, DLC)
   */
  groupMirrorsByType(mirrors) {
    const groups = {};
    for (const m of mirrors) {
      const type = m.type || 'Base Game';
      if (!groups[type]) {
        groups[type] = {
          type,
          size: m.size || null,
          mirrors: [],
        };
      }
      groups[type].mirrors.push({
        host: m.host,
        url: m.url,
        originalUrl: m.originalUrl,
        label: m.label,
        reliabilityScore: m.reliability_score,
        successCount: m.success_count,
        failCount: m.fail_count,
      });
    }
    return Object.values(groups);
  }

  /**
   * Search games by title
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Object[]} Array of games
   */
  search(query, limit = 50) {
    const lowerQuery = `%${query.toLowerCase()}%`;
    const games = this.db.prepare(`
      SELECT id, title, slug, url, cover, size, region, version, last_scraped
      FROM games
      WHERE LOWER(title) LIKE ?
      ORDER BY last_scraped DESC
      LIMIT ?
    `).all(lowerQuery, limit);

    return games.map(game => ({
      ...game,
      // Gallery count only (don't load all images)
      galleryCount: this.db.prepare('SELECT COUNT(*) as count FROM game_images WHERE game_id = ?').get(game.id).count,
      mirrorCount: this.db.prepare('SELECT COUNT(*) as count FROM game_mirrors WHERE game_id = ?').get(game.id).count,
    }));
  }

  /**
   * Get all games from cache
   * @param {number} limit - Max results
   * @param {number} offset - Offset for pagination
   * @returns {Object[]}
   */
  getAll(limit = 50, offset = 0) {
    const games = this.db.prepare(`
      SELECT id, title, slug, url, cover, size, region, version, last_scraped
      FROM games
      ORDER BY last_scraped DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return games.map(game => ({
      ...game,
      mirrorCount: this.db.prepare('SELECT COUNT(*) as count FROM game_mirrors WHERE game_id = ?').get(game.id).count,
    }));
  }

  /**
   * Check if a game is cached and still valid (not expired)
   * @param {string} slug - Game slug
   * @returns {boolean}
   */
  isCached(slug) {
    const game = this.db.prepare(`
      SELECT last_scraped FROM games WHERE slug = ?
    `).get(slug);

    if (!game) return false;

    const hoursSinceScrape = this.hoursSince(game.last_scraped);
    return hoursSinceScrape < CACHE_TTL_HOURS;
  }

  /**
   * Calculate hours since a timestamp
   */
  hoursSince(timestamp) {
    if (!timestamp) return Infinity;
    const then = new Date(timestamp + 'Z');
    const now = new Date();
    return (now - then) / (1000 * 60 * 60);
  }

  /**
   * Update mirror reliability score
   * @param {number} mirrorId - Mirror ID
   * @param {boolean} success - Whether the download succeeded
   */
  updateMirrorReliability(mirrorUrl, success) {
    const mirror = this.db.prepare('SELECT id, success_count, fail_count, reliability_score FROM game_mirrors WHERE mirror_url = ?').get(mirrorUrl);
    if (!mirror) return;

    const newSuccess = success ? mirror.success_count + 1 : mirror.success_count;
    const newFail = success ? mirror.fail_count : mirror.fail_count + 1;
    const total = newSuccess + newFail;
    const newScore = total > 0 ? newSuccess / total : 0.5;

    this.db.prepare(`
      UPDATE game_mirrors 
      SET success_count = ?, fail_count = ?, reliability_score = ?, last_resolved = datetime('now')
      WHERE id = ?
    `).run(newSuccess, newFail, newScore, mirror.id);
  }

  /**
   * Delete a game from cache
   * @param {string} slug - Game slug
   */
  delete(slug) {
    const game = this.db.prepare('SELECT id FROM games WHERE slug = ?').get(slug);
    if (!game) return 0;

    return this.db.prepare('DELETE FROM games WHERE id = ?').run(game.id).changes;
  }

  /**
   * Clear all cached games
   */
  clearAll() {
    return this.db.exec(`
      DELETE FROM game_images;
      DELETE FROM game_videos;
      DELETE FROM game_mirrors;
      DELETE FROM games;
    `);
  }

  /**
   * Clear expired cache entries (older than TTL)
   */
  clearExpired() {
    const threshold = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    return this.db.prepare('DELETE FROM games WHERE last_scraped < ?').run(threshold).changes;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const games = this.db.prepare('SELECT COUNT(*) as count FROM games').get();
    const mirrors = this.db.prepare('SELECT COUNT(*) as count FROM game_mirrors').get();
    const images = this.db.prepare('SELECT COUNT(*) as count FROM game_images').get();
    const videos = this.db.prepare('SELECT COUNT(*) as count FROM game_videos').get();

    const oldest = this.db.prepare('SELECT MIN(last_scraped) as oldest FROM games').get();
    const newest = this.db.prepare('SELECT MAX(last_scraped) as newest FROM games').get();

    return {
      games: games.count,
      mirrors: mirrors.count,
      images: images.count,
      videos: videos.count,
      oldestCached: oldest.oldest,
      newestCached: newest.newest,
      ttlHours: CACHE_TTL_HOURS,
    };
  }
}

module.exports = { GameCache, CACHE_TTL_HOURS };
