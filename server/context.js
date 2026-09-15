/**
 * Shared backend context: singletons + event wiring.
 * Used by the Express server, the CLI, and Electron IPC alike.
 */
const fs = require('fs');
const path = require('path');

const { SettingsManager } = require('../main/settings');
const { Logger } = require('../main/logger');
const { dbManager } = require('../main/database/db');
const { DownloadHistory } = require('../main/database/downloads');
const { DownloadManager } = require('../main/downloader/manager');
const { Extractor } = require('../main/extractor/extractor');
const { NotificationManager } = require('../main/notifications');
const { ArchiveProvider } = require('./archiveProvider');

function bootstrapContext() {
  dbManager.initialize();
  const settings = new SettingsManager();
  settings.load();

  // Catalog sources migration: legacy single `catalogUrl` → `catalogs[]`.
  // Fresh installs get an empty list — the user adds their own (Settings → Library).
  if (!Array.isArray(settings.get('catalogs'))) {
    const legacy = settings.get('catalogUrl');
    settings.set(
      'catalogs',
      legacy && String(legacy).trim() ? [{ type: 'url', location: String(legacy).trim() }] : []
    );
  }
  if (settings.get('catalogUrl') !== undefined) settings.remove('catalogUrl');
  if (settings.get('catalogTtlHours') === undefined) settings.set('catalogTtlHours', 24);
  if (settings.get('apiPort') === undefined) settings.set('apiPort', 3100);

  const logger = new Logger({ level: 'info' });
  const downloadHistory = new DownloadHistory();
  const notifications = new NotificationManager();
  const syncNotificationPrefs = () => {
    try {
      notifications.setPreferences({
        desktopNotification: settings.get('desktopNotification'),
        downloadComplete: settings.get('notifyOnComplete'),
        downloadFailed: settings.get('notifyOnFailed'),
        extractComplete: settings.get('notifyOnExtractComplete'),
        soundAlert: settings.get('soundAlert'),
      });
    } catch (error) {
      logIgnored('syncNotificationPrefs', error);
    }
  };
  syncNotificationPrefs();

  const downloadDir = settings.getDownloadDir();
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  const downloadManager = new DownloadManager({
    downloadDir,
    maxConcurrent: settings.get('maxConcurrentDownloads'),
    retryCount: settings.get('retryCount'),
    retryDelay: settings.get('retryDelay') * 1000,
    defaultHeaders: iaHeaders(settings.get('iaCookie')),
  });

  function iaHeaders(cookie) {
    if (cookie && String(cookie).trim()) return { Cookie: String(cookie).trim() };
    return null;
  }

  /** Rewrite low-level failures into actionable messages */
  function friendlyError(url, message) {
    const msg = message || 'Unknown error';
    if (/401/.test(msg) && /archive\.org/.test(url || '')) {
      return 'archive.org requires login (HTTP 401). Paste your archive.org login cookie into Settings → Internet Archive (iaCookie) and retry.';
    }
    return msg;
  }

  /** Best-effort diagnostic for intentionally non-fatal failures. */
  function logIgnored(where, error) {
    try {
      logger.warn(`[context] ignored failure in ${where}: ${String((error && error.message) || error || 'unknown')}`);
    } catch {
      /* logger unavailable — nothing left to report to */
    }
  }

  const extractor = new Extractor({
    extractTo: settings.get('extractTo'),
    customDir: settings.get('customExtractDir') || null,
    deleteAfterExtract: settings.get('deleteArchiveAfterExtract'),
    formats: settings.get('extractFormats'),
  });

  const archive = new ArchiveProvider({
    catalogs: settings.get('catalogs'),
    ttlHours: settings.get('catalogTtlHours'),
  });

  /** Persist provider sources back to settings (single source of truth). */
  function syncSources() {
    try {
      settings.set(
        'catalogs',
        archive.sources.map((s) => ({ id: s.id, type: s.type, location: s.location, label: s.label, enabled: s.enabled }))
      );
    } catch (error) {
      logIgnored('syncSources', error);
    }
  }

  const { MetadataService } = require('./metadata');
  const metadata = new MetadataService({ settings });
  if (!metadata.rawg.configured) {
    console.error('[metadata] no RAWG key — enrichment disabled (set rawgApiKey or RAWG_API_KEY)');
  }

  const { BackfillJob } = require('./metadata/backfill');
  const backfill = new BackfillJob({ archive, metadata });

  // Joins a download subfolder without ever escaping the base dir:
  // strips separators, rejects dot-only names (".." traversal), and
  // asserts containment as a final guard.
  function safeSubdir(base, title) {
    const safe = String(title || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'Game';
    if (/^\.+$/.test(safe)) return base;
    const dest = path.join(base, safe);
    const rel = path.relative(base, dest);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return base;
    return dest;
  }

  // gameId/title metadata per download id (for history + UI)
  const meta = new Map();

  // Rebuild paused/interrupted downloads after restart. Rows stuck in
  // queued/downloading/paused come back as paused engines (never auto-start);
  // cancelled/failed/completed are left alone (completed has its own path).
  async function hydrateInterrupted() {
    let rows = [];
    try {
      rows = downloadHistory.getActive() || [];
    } catch (error) {
      logIgnored('hydrateInterrupted getActive', error);
      return 0;
    }
    let restored = 0;
    for (const row of rows) {
      try {
        const url = row.direct_url || row.mirror_url || null;
        if (!url) continue;
        const title = row.game_title || 'Download';
        let destination = settings.getDownloadDir();
        if (settings.get('createSubfolder') && title && title !== 'Download') {
          destination = safeSubdir(destination, title);
          if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
        }
        let cover = null;
        let titleId = null;
        let region = null;
        let version = null;
        let size = null;
        try {
          const entry = await archive.getByPkgUrl(url);
          if (entry) {
            cover = entry.cover || entry.coverUrl || null;
            titleId = entry.titleId || null;
            region = entry.region || null;
            version = entry.version || null;
            size = entry.size || null;
            if (title === 'Download' && entry.title) {
              // keep row title below in sync via meta below
            }
          }
        } catch (error) {
          logIgnored('hydrateInterrupted catalog lookup', error);
        }
        const id = downloadManager.restorePaused({
          url,
          destination,
          filename: null,
          label: title,
          source: 'archive-fpkgi',
          gameTitle: title,
        });
        meta.set(id, { historyId: row.id, titleId, title, pkgUrl: url, cover, region, version, size });
        restored++;
      } catch (error) {
        logIgnored('hydrateInterrupted row restore', error);
      }
    }
    return restored;
  }

  // Rebuild the Completed tab from history after restart (files verified,
  // covers re-resolved from the catalog; never throws, never duplicates).
  async function hydrateCompleted() {
    let rows = [];
    try {
      rows = downloadHistory.getCompleted(200) || [];
    } catch (error) {
      logIgnored('hydrateCompleted getCompleted', error);
      return 0;
    }
    const items = [];
    for (const row of rows) {
      try {
        if (!row || !row.filepath || !fs.existsSync(row.filepath)) continue;
        const url = row.direct_url || row.mirror_url || null;
        let title = row.game_title || 'Download';
        let cover = null;
        try {
          const entry = url ? await archive.getByPkgUrl(url) : null;
          if (entry) {
            cover = entry.cover || entry.coverUrl || null;
            if (title === 'Download' && entry.title) title = entry.title;
          }
        } catch (error) {
          logIgnored('hydrateCompleted catalog lookup', error);
        }
        const total = Number(row.filesize) || 0;
        const id = `hist_${row.id}`;
        items.push({
          id,
          label: title,
          gameTitle: title,
          url,
          state: 'completed',
          stats: { percent: 100, totalBytes: total, downloadedBytes: total, speed: 0, eta: null },
          filePath: row.filepath,
          filename: path.basename(row.filepath),
        });
        if (!meta.has(id)) {
          meta.set(id, { historyId: row.id, titleId: null, title, pkgUrl: url, cover, region: null, version: null, size: null });
        }
      } catch (error) {
        logIgnored('hydrateCompleted row restore', error);
      }
    }
    try {
      return downloadManager.restoreCompleted(items);
    } catch (error) {
      logIgnored('hydrateCompleted restoreCompleted', error);
      return 0;
    }
  }

  downloadManager.on('download:complete', (d) => {
    const m = meta.get(d.id) || {};
    try {
      downloadHistory.markCompleted(m.historyId, d.filePath || d.path || null, d.stats?.totalBytes ?? null);
    } catch (error) {
      logIgnored('download:complete markCompleted', error);
    }
    try {
      notifications.sendDownloadComplete(d.label || d.gameTitle || 'Download', d.filePath || null);
    } catch (error) {
      logIgnored('download:complete notify', error);
    }
    const archivePath = d.filePath || d.path;
    // PKGs from archive.org are not archives for 7z — skip auto-extract for .pkg
    if (settings.get('autoExtract') && archivePath && extractor.isArchive(archivePath)) {
      extractor
        .extract(archivePath)
        .then(() => {
          try {
            notifications.sendExtractComplete(path.basename(archivePath), path.dirname(archivePath));
          } catch (error) {
            logIgnored('download:complete extract notify', error);
          }
        })
        .catch((err) => {
          try {
            notifications.sendExtractFailed(path.basename(archivePath), err && err.message);
          } catch (error) {
            logIgnored('download:complete extract-failed notify', error);
          }
        });
    }
  });

  downloadManager.on('download:failed', (d) => {
    const m = meta.get(d.id) || {};
    const err = friendlyError(d.url || m.pkgUrl, d.error);
    try {
      downloadHistory.markFailed(m.historyId, err);
    } catch (error) {
      logIgnored('download:failed markFailed', error);
    }
    try {
      notifications.sendDownloadFailed(d.label || d.gameTitle || 'Download', err);
    } catch (error) {
      logIgnored('download:failed notify', error);
    }
  });
  // Persist pause/cancel/resume so interrupted downloads restore after restart
  downloadManager.on('download:paused', (d) => {
    const m = meta.get(d.id) || {};
    try {
      if (m.historyId) downloadHistory.markPaused(m.historyId);
    } catch (error) {
      logIgnored('download:paused persist', error);
    }
  });
  downloadManager.on('download:cancelled', (d) => {
    const m = meta.get(d.id) || {};
    try {
      if (m.historyId) downloadHistory.markCancelled(m.historyId);
    } catch (error) {
      logIgnored('download:cancelled persist', error);
    }
  });
  downloadManager.on('download:resumed', (d) => {
    const m = meta.get(d.id) || {};
    try {
      if (m.historyId) downloadHistory.markStarted(m.historyId);
    } catch (error) {
      logIgnored('download:resumed persist', error);
    }
  });
  downloadManager.on('download:error', (d) => {
    // engine-level error (retryable) — surfaced via status polling
    logger.warn(`download error ${d.id}: ${d.error || ''}`);
  });

  /**
   * Queue a direct PKG download. No mirror resolving — archive.org URLs are direct.
   * @param {{pkgUrl,titleId,title,filename,sizeBytes}} input
   */
  function queuePkgDownload(input = {}) {
    const { pkgUrl, title, titleId, filename, cover, region, version, size, force } = input;
    if (!pkgUrl) throw new Error('pkgUrl is required');
    // Already live? Return the existing job instead of a duplicate.
    if (!force) {
      try {
        const live = downloadManager.findByUrl(pkgUrl);
        const liveState = live && live.getStatus ? live.getStatus().state : live && live.state;
        if (live && (liveState === 'idle' || liveState === 'downloading' || liveState === 'paused')) {
          return { id: live.id, alreadyQueued: true };
        }
      } catch (error) {
        logIgnored('queuePkgDownload live lookup', error);
      }
      // Already finished on disk? Surface the completed record, don't re-download.
      try {
        const row = downloadHistory.findCompletedByUrl(pkgUrl);
        if (row && row.filepath && fs.existsSync(row.filepath)) {
          return { id: `hist_${row.id}`, alreadyCompleted: true, title: row.game_title || title || null };
        }
      } catch (error) {
        logIgnored('queuePkgDownload completed lookup', error);
      }
    }
    let destination = settings.getDownloadDir();
    if (settings.get('createSubfolder') && title) {
      destination = safeSubdir(destination, title);
      if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
    }
    const label = title ? `${title}${titleId ? ` [${titleId}]` : ''}` : filename || 'Download';
    // Metadata-based filename for new queues: "{Title} [{CUSA}] [{Region}] [v{Version}].pkg".
    // Only when we have a real title and the caller didn't pin an explicit name;
    // existing files and in-flight resume mapping are untouched (URL+path based).
    let resolvedFilename = filename || null;
    if (title && String(title).trim() && !input.explicitFilename) {
      const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();
      const parts = [clean(title)];
      if (String(titleId || '').trim()) parts.push(`[${clean(titleId)}]`);
      if (String(region || '').trim()) parts.push(`[${clean(region)}]`);
      if (String(version || '').trim()) parts.push(`[v${clean(version)}]`);
      const stem = parts.join(' ').slice(0, 120).trim();
      if (stem) resolvedFilename = `${stem}.pkg`;
    }
    const id = downloadManager.add({
      url: pkgUrl,
      destination,
      filename: resolvedFilename,
      label,
      source: 'archive-fpkgi',
      gameTitle: title || null,
    });
    let historyId = null;
    try {
      historyId = downloadHistory.create({
        gameId: null,
        gameTitle: title || label,
        fileType: 'PKG',
        mirrorHost: 'archive-fpkgi',
        mirrorUrl: pkgUrl,
        directUrl: pkgUrl,
        status: 'queued',
      });
    } catch (error) {
      logIgnored('queuePkgDownload history create', error);
    }
    meta.set(id, { historyId, titleId: titleId || null, title: title || null, pkgUrl, cover: cover || null, region: region || null, version: version || null, size: size || null });
    return { id, historyId };
  }

  function mapStatus(s) {
    const stats = s.stats || {};
    const stateMap = {
      idle: 'queued',
      downloading: 'active',
      resumed: 'active',
      retrying: 'active',
      paused: 'paused',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'failed',
    };
    const m = meta.get(s.id) || {};
    const url = m.pkgUrl || s.url || null;
    const rawError = s.error || null;
    return {
      id: s.id,
      label: s.label || s.filename || 'Download',
      title: displayTitle(m, s),
      titleId: m.titleId || null,
      cover: m.cover || null,
      region: m.region || null,
      version: m.version || null,
      size: m.size || null,
      pkgUrl: url,
      path: s.filePath || s.path || s.filename || null,
      progress: Math.min(100, Math.round(stats.percent ?? (s.state === 'completed' ? 100 : 0))),
      speed: stats.speed || 0,
      downloadedBytes: stats.downloadedBytes || 0,
      totalBytes: stats.totalBytes || 0,
      eta: stats.eta ?? null,
      status: stateMap[s.state] || 'queued',
      state: s.state,
      error: rawError ? friendlyError(url, rawError) : null,
    };
  }

  // Titles must never render blank: trim, then fall back through label,
  // then a readable stem derived from the PKG filename/URL, then 'Download'.
  function displayTitle(m, s) {
    const candidates = [m.title, s.gameTitle, s.label];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    const src = s.filename || m.pkgUrl || s.url || '';
    try {
      const base = String(src).split('?')[0].split('/').pop() || '';
      const stem = base.replace(/\.(pkg|zip|rar|7z)$/i, '').replace(/[._-]+/g, ' ').trim();
      if (stem) return stem;
    } catch (error) {
      logIgnored('displayTitle filename fallback', error);
    }
    return 'Download';
  }

  function listDownloads() {
    const seen = new Set();
    const out = [];
    for (const s of downloadManager.getAll('all')) {
      if (!s.id || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(mapStatus(s));
    }
    return out;
  }

  // Clear enrichment cache (metadata rows + backfill state). Catalog sources,
  // downloads, settings, overrides and ignore list are untouched.
  function clearCache() {
    let metadataRows = 0;
    try {
      metadataRows = ctx.metadata.clearCache();
    } catch (error) {
      logIgnored('clearCache metadata', error);
    }
    try {
      ctx.backfill.state = ctx.backfill._freshState();
    } catch (error) {
      logIgnored('clearCache backfill state', error);
    }
    try {
      const p = ctx.backfill.statePath;
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    } catch (error) {
      logIgnored('clearCache state file', error);
    }
    return { metadataRows, backfillReset: true };
  }

  function cacheStats() {
    let metadata = { enriched: 0, lowConfidence: 0, catalogTotal: 0 };
    try {
      metadata = ctx.metadata.stats(ctx.archive.games.length);
    } catch (error) {
      logIgnored('cacheStats metadata', error);
    }
    let backfill = null;
    try {
      backfill = ctx.backfill.snapshot();
    } catch (error) {
      logIgnored('cacheStats backfill', error);
    }
    return { metadata, backfill };
  }

  // Remove a download record but keep the game file on disk.
  async function removeDownload(id) {
    try {
      await downloadManager.cancel(id, false);
    } catch (error) {
      logIgnored('removeDownload cancel', error);
    }
    try {
      downloadManager.downloads.delete(id);
    } catch (error) {
      logIgnored('removeDownload map delete', error);
    }
    try {
      downloadManager.removeCompleted(id);
    } catch (error) {
      logIgnored('removeDownload completed delete', error);
    }
    const m = meta.get(id);
    if (m) {
      try {
        if (m.historyId) downloadHistory.delete(m.historyId);
        else if (String(id).startsWith('hist_')) downloadHistory.delete(Number(String(id).slice(5)));
      } catch (error) {
        logIgnored('removeDownload history delete', error);
      }
      meta.delete(id);
    }
    return { id, removed: true };
  }

  // Rebuild tabs from history (fire-and-forget: sync boot stays fast).
  // Async rejections are logged — try/catch alone cannot catch them.
  void hydrateCompleted().catch((error) => logIgnored('boot hydrateCompleted', error));
  void hydrateInterrupted().catch((error) => logIgnored('boot hydrateInterrupted', error));

  return {
    settings,
    logger,
    downloadHistory,
    notifications,
    syncNotificationPrefs,
    downloadManager,
    extractor,
    archive,
    metadata,
    backfill,
    syncSources,
    meta,
    queuePkgDownload,
    mapStatus,
    listDownloads,
    removeDownload,
    hydrateCompleted,
    hydrateInterrupted,
    clearCache,
    cacheStats,
  };
}

module.exports = { bootstrapContext };
