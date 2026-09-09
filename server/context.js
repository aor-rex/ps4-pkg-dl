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
  try {
    notifications.setPreferences({
      soundAlert: settings.get('soundAlert'),
      desktopNotification: settings.get('desktopNotification'),
    });
  } catch (_) {}

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
    } catch (_) {}
  }

  const { MetadataService } = require('./metadata');
  const metadata = new MetadataService({ settings });
  if (!metadata.rawg.configured) {
    console.error('[metadata] no RAWG key — enrichment disabled (set rawgApiKey or RAWG_API_KEY)');
  }

  const { BackfillJob } = require('./metadata/backfill');
  const backfill = new BackfillJob({ archive, metadata });

  // gameId/title metadata per download id (for history + UI)
  const meta = new Map();

  downloadManager.on('download:complete', (d) => {
    const m = meta.get(d.id) || {};
    try {
      downloadHistory.markCompleted(m.historyId, d.filePath || d.path || null, d.stats?.totalBytes ?? null);
    } catch (_) {}
    try {
      notifications.sendDownloadComplete(d.label || d.gameTitle || 'Download', d.filePath || null);
    } catch (_) {}
    const archivePath = d.filePath || d.path;
    // PKGs from archive.org are not archives for 7z — skip auto-extract for .pkg
    if (settings.get('autoExtract') && archivePath && extractor.isArchive(archivePath)) {
      extractor.extract(archivePath).catch(() => {});
    }
  });

  downloadManager.on('download:failed', (d) => {
    const m = meta.get(d.id) || {};
    const err = friendlyError(d.url || m.pkgUrl, d.error);
    try {
      downloadHistory.markFailed(m.historyId, err);
    } catch (_) {}
    try {
      notifications.sendDownloadFailed(d.label || d.gameTitle || 'Download', err);
    } catch (_) {}
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
    const { pkgUrl, title, titleId, filename, cover, region, version, size } = input;
    if (!pkgUrl) throw new Error('pkgUrl is required');
    let destination = settings.getDownloadDir();
    if (settings.get('createSubfolder') && title) {
      const safe = String(title).replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'Game';
      destination = path.join(destination, safe);
      if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
    }
    const label = title ? `${title}${titleId ? ` [${titleId}]` : ''}` : filename || 'Download';
    const id = downloadManager.add({
      url: pkgUrl,
      destination,
      filename: filename || null,
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
    } catch (_) {}
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
      title: m.title || s.gameTitle || s.label || 'Download',
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

  return {
    settings,
    logger,
    downloadHistory,
    notifications,
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
  };
}

module.exports = { bootstrapContext };
