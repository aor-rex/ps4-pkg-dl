// Phase 2 additions to CLI — import and integrate these into src/cli/index.js

const { dbManager } = require('../main/database/db');
const { DownloadHistory } = require('../main/database/downloads');
const { GameCache } = require('../main/database/cache');
const { NotificationManager } = require('../main/notifications');

// Initialize Phase 2 components
dbManager.initialize();
const downloadHistory = new DownloadHistory();
const gameCache = new GameCache();
const notifications = new NotificationManager();

// Apply notification preferences from settings
notifications.setPreferences({
  downloadComplete: settings.get('notifyOnComplete'),
  downloadFailed: settings.get('notifyOnFailed'),
  extractComplete: settings.get('notifyOnExtractComplete'),
  soundAlert: settings.get('soundAlert'),
});

// ─────────────────────────────────────────────
// Add these commands to the CLI
// ─────────────────────────────────────────────

// HISTORY COMMAND
program
  .command('history')
  .description('Show download history')
  .option('-s, --status <status>', 'Filter by status (all/downloading/completed/failed)', 'all')
  .option('-l, --limit <number>', 'Max results', '20')
  .action((options) => {
    const status = options.status;
    const limit = parseInt(options.limit);
    const downloads = downloadHistory.getAll(status, limit);

    if (downloads.length === 0) {
      console.log('\n📭 No download history.\n');
      return;
    }

    console.log('\n📥 Download History:\n');
    console.log('─'.repeat(100));
    console.log(`${'ID'.padEnd(6)} ${'Game'.padEnd(30)} ${'Mirror'.padEnd(15)} ${'Status'.padEnd(12)} ${'Progress'.padEnd(10)} ${'Size'}`);
    console.log('─'.repeat(100));

    for (const dl of downloads) {
      const id = String(dl.id).padEnd(6);
      const title = (dl.game_title || 'Unknown').substring(0, 28).padEnd(30);
      const mirror = (dl.mirror_host || 'Unknown').substring(0, 13).padEnd(15);
      const statusStr = dl.status.padEnd(12);
      const progress = `${dl.progress.toFixed(1)}%`.padEnd(10);
      const size = dl.filesize ? formatBytes(dl.filesize) : '—';
      console.log(`${id} ${title} ${mirror} ${statusStr} ${progress} ${size}`);

      if (dl.error_message) {
        console.log(`     Error: ${dl.error_message.substring(0, 80)}`);
      }
    }

    console.log('─'.repeat(100));
    const counts = downloadHistory.getCounts();
    console.log(`\n  Total: ${counts.all} | Completed: ${counts.completed} | Failed: ${counts.failed} | Active: ${counts.downloading}`);
    const totalDownloaded = downloadHistory.getTotalDownloaded();
    if (totalDownloaded > 0) {
      console.log(`  Total Downloaded: ${formatBytes(totalDownloaded)}`);
    }
    console.log();
  });

// CACHE COMMAND
const cacheCmd = program
  .command('cache')
  .description('Manage game data cache');

cacheCmd
  .command('stats')
  .description('Show cache statistics')
  .action(() => {
    const stats = gameCache.getStats();
    console.log('\n📦 Cache Statistics:\n');
    console.log(`  Games cached: ${stats.games}`);
    console.log(`  Mirrors cached: ${stats.mirrors}`);
    console.log(`  Images cached: ${stats.images}`);
    console.log(`  Videos cached: ${stats.videos}`);
    console.log(`  Cache TTL: ${stats.ttlHours} hours`);
    if (stats.oldestCached) {
      console.log(`  Oldest entry: ${stats.oldestCached}`);
    }
    if (stats.newestCached) {
      console.log(`  Newest entry: ${stats.newestCached}`);
    }
    console.log();
  });

cacheCmd
  .command('clear')
  .description('Clear all cached game data')
  .action(() => {
    const deleted = gameCache.clearAll();
    console.log(`\n✓ Cache cleared.\n`);
  });

cacheCmd
  .command('clean')
  .description('Remove expired cache entries')
  .action(() => {
    const cleaned = gameCache.clearExpired();
    console.log(`\n✓ Removed ${cleaned} expired entries.\n`);
  });

// DB COMMAND
program
  .command('db')
  .description('Show database information')
  .action(() => {
    const dbStats = dbManager.getStats();
    const cacheStats = gameCache.getStats();
    const dlCounts = downloadHistory.getCounts();

    console.log('\n🗄️  Database Info:\n');
    console.log(`  Database: ${dbStats.dbPath}`);
    console.log(`  Size: ${dbStats.dbSize}`);
    console.log();
    console.log(`  Games: ${dbStats.games}`);
    console.log(`  Images: ${dbStats.images}`);
    console.log(`  Videos: ${dbStats.videos}`);
    console.log(`  Mirrors: ${dbStats.mirrors}`);
    console.log(`  Downloads: ${dbStats.downloads}`);
    console.log();
    console.log(`  Download Counts:`);
    console.log(`    Completed: ${dlCounts.completed}`);
    console.log(`    Failed: ${dlCounts.failed}`);
    console.log(`    Active: ${dlCounts.downloading + dlCounts.paused + dlCounts.queued}`);
    const totalDownloaded = downloadHistory.getTotalDownloaded();
    if (totalDownloaded > 0) {
      console.log(`    Total Downloaded: ${formatBytes(totalDownloaded)}`);
    }
    console.log();
  });

// PAUSE / RESUME / CANCEL COMMANDS
program
  .command('pause <id>')
  .description('Pause a download by ID')
  .action(async (id) => {
    const dl = downloadHistory.getById(parseInt(id));
    if (!dl) {
      console.error(`\n✗ Download #${id} not found.\n`);
      process.exit(1);
    }

    downloadHistory.markPaused(parseInt(id));
    await downloadManager.pause(dl.id);
    console.log(`\n⏸ Paused download #${id}\n`);
  });

program
  .command('resume <id>')
  .description('Resume a paused download by ID')
  .action(async (id) => {
    const dl = downloadHistory.getById(parseInt(id));
    if (!dl) {
      console.error(`\n✗ Download #${id} not found.\n`);
      process.exit(1);
    }

    downloadHistory.markStarted(parseInt(id));
    await downloadManager.resume(dl.id);
    console.log(`\n▶ Resumed download #${id}\n`);
  });

program
  .command('cancel <id>')
  .description('Cancel a download by ID')
  .option('--delete', 'Delete partial file', true)
  .option('--keep', 'Keep partial file')
  .action(async (id, options) => {
    const dl = downloadHistory.getById(parseInt(id));
    if (!dl) {
      console.error(`\n✗ Download #${id} not found.\n`);
      process.exit(1);
    }

    const deleteFile = options.delete && !options.keep;
    downloadHistory.markCancelled(parseInt(id));
    await downloadManager.cancel(dl.id, deleteFile);
    console.log(`\n⛔ Cancelled download #${id}\n`);
  });

program
  .command('retry <id>')
  .description('Retry a failed download by ID')
  .action(async (id) => {
    const dl = downloadHistory.getById(parseInt(id));
    if (!dl) {
      console.error(`\n✗ Download #${id} not found.\n`);
      process.exit(1);
    }

    if (!['failed', 'cancelled'].includes(dl.status)) {
      console.error(`\n✗ Download #${id} is not failed/cancelled (status: ${dl.status}).\n`);
      process.exit(1);
    }

    downloadHistory.retry(parseInt(id));
    // Re-add to download manager
    downloadManager.add({
      url: dl.direct_url || dl.mirror_url,
      destination: path.dirname(dl.filepath) || settings.getDownloadDir(),
      label: dl.game_title || 'Retry',
      source: dl.mirror_host || 'Unknown',
    });
    console.log(`\n🔄 Retrying download #${id}\n`);
  });

// RETRY ALL FAILED
program
  .command('retry-all')
  .description('Retry all failed downloads')
  .action(async () => {
    const count = downloadHistory.retryAllFailed();
    console.log(`\n🔄 Queued ${count} failed downloads for retry.\n`);
  });

// CLEAR DOWNLOAD HISTORY
program
  .command('clear-history')
  .description('Clear download history')
  .option('--completed', 'Clear only completed downloads')
  .option('--failed', 'Clear only failed downloads')
  .option('--all', 'Clear all history')
  .action((options) => {
    if (options.completed) {
      const count = downloadHistory.clearCompleted();
      console.log(`\n✓ Cleared ${count} completed downloads.\n`);
    } else if (options.failed) {
      const count = downloadHistory.clearFailed();
      console.log(`\n✓ Cleared ${count} failed downloads.\n`);
    } else if (options.all) {
      const count = downloadHistory.clearAll();
      console.log(`\n✓ Cleared all download history (${count} entries).\n`);
    } else {
      console.log('\nSpecify --completed, --failed, or --all\n');
    }
  });
