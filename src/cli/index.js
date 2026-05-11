#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');

// Initialize components
const { scrapeCategoryMulti, scrapeGameDetail, searchGames, BASE_URL: DLPSGAME_URL } = require('../main/scraper/dlpsgame');
const { searchGames: searchPkgps4, scrapeGameDetail: scrapePkgps4, BASE_URL: PKGPS4_URL } = require('../main/scraper/pkgps4');
const { searchGames: searchSuperpsx, scrapeGameDetail: scrapeSuperpsx, BASE_URL: SUPERPSX_URL } = require('../main/scraper/superpsx');
const { resolveMirror, checkYtDlp } = require('../main/scraper/mirror-resolver');
const { DownloadManager } = require('../main/downloader/manager');
const { Extractor } = require('../main/extractor/extractor');
const { SettingsManager } = require('../main/settings');
const { Logger } = require('../main/logger');

// Phase 2: Database, caching, notifications
const { dbManager } = require('../main/database/db');
const { DownloadHistory } = require('../main/database/downloads');
const { GameCache, CACHE_TTL_HOURS } = require('../main/database/cache');
const { NotificationManager } = require('../main/notifications');

// Initialize database
dbManager.initialize();
const downloadHistory = new DownloadHistory();
const gameCache = new GameCache();
const notifications = new NotificationManager();

// Initialize logger
const logger = new Logger({ level: 'info' });

// Initialize settings
const settings = new SettingsManager();
settings.load();

// Apply notification preferences
notifications.setPreferences({
  downloadComplete: settings.get('notifyOnComplete'),
  downloadFailed: settings.get('notifyOnFailed'),
  extractComplete: settings.get('notifyOnExtractComplete'),
  soundAlert: settings.get('soundAlert'),
});

// Initialize download manager
const downloadManager = new DownloadManager({
  downloadDir: settings.getDownloadDir(),
  maxConcurrent: settings.get('maxConcurrentDownloads'),
  retryCount: settings.get('retryCount'),
  retryDelay: settings.get('retryDelay') * 1000,
});

// Initialize extractor
const extractor = new Extractor({
  extractTo: settings.get('extractTo'),
  customDir: settings.get('customExtractDir') || null,
  deleteAfterExtract: settings.get('deleteArchiveAfterExtract'),
  formats: settings.get('extractFormats'),
});

// Initialize CLI
const program = new Command();

program
  .name('ps4dl')
  .description('PS4 PKG Downloader - Browse and download PS4 games from dlpsgame.com')
  .version('0.1.0');

// ─────────────────────────────────────────────
// SEARCH COMMAND
// ─────────────────────────────────────────────
program
  .command('search <query>')
  .description('Search for PS4 games by title')
  .option('-p, --pages <number>', 'Maximum pages to scrape', '3')
  .option('-s, --source <scraper>', 'Source to use: dlpsgame, pkgps4, superpsx', 'dlpsgame')
  .option('--no-cache', 'Skip cache and scrape live')
  .action(async (query, options) => {
    const maxPages = parseInt(options.pages);
    const useCache = options.cache !== false;
    const source = options.source.toLowerCase();
    
    // Select scraper based on source
    let scraper;
    let baseUrl;
    switch (source) {
      case 'pkgps4':
        scraper = { search: searchPkgps4, detail: scrapePkgps4 };
        baseUrl = PKGPS4_URL;
        break;
      case 'superpsx':
        scraper = { search: searchSuperpsx, detail: scrapeSuperpsx };
        baseUrl = SUPERPSX_URL;
        break;
      case 'dlpsgame':
      default:
        scraper = { search: searchGames, detail: scrapeGameDetail };
        baseUrl = DLPSGAME_URL;
    }
    
    console.log(`\n🔍 Searching for: "${query}" (source: ${source}, up to ${maxPages} pages)...\n`);
    
    try {
      // Try cache first
      if (useCache) {
        const cachedResults = gameCache.search(query);
        if (cachedResults.length > 0) {
          console.log(`Found ${cachedResults.length} cached PS4 game(s):\n`);
          printGameList(cachedResults);
          console.log(`\n💡 Use "ps4dl info <slug>" to view game details`);
          console.log(`💡 Use --no-cache to scrape fresh data\n`);
          return;
        }
      }
      
      // Scrape live
      const results = await scraper.search(query, maxPages);
      
      if (results.length === 0) {
        console.log('No PS4 games found matching your search.');
        return;
      }

      // Save to cache
      for (const game of results) {
        gameCache.saveGame(game);
      }
      
      console.log(`Found ${results.length} PS4 game(s):\n`);
      printGameList(results.map(g => ({
        id: null,
        title: g.title,
        slug: g.slug,
        cover: g.cover,
        mirrorCount: null,
      })));
      
      console.log(`\n💡 Use "ps4dl info <slug>" to view game details`);
    } catch (error) {
      logger.error(`Search failed: ${error.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// INFO COMMAND
// ─────────────────────────────────────────────
program
  .command('info <slug>')
  .description('View detailed information about a game')
  .option('-s, --source <scraper>', 'Source to use: dlpsgame, pkgps4, superpsx', 'dlpsgame')
  .option('--no-cache', 'Skip cache and scrape live')
  .action(async (slug, options) => {
    const source = options.source.toLowerCase();
    
    // Select scraper based on source
    let scraper;
    let baseUrl;
    switch (source) {
      case 'pkgps4':
        scraper = { search: searchPkgps4, detail: scrapePkgps4 };
        baseUrl = PKGPS4_URL;
        break;
      case 'superpsx':
        scraper = { search: searchSuperpsx, detail: scrapeSuperpsx };
        baseUrl = SUPERPSX_URL;
        break;
      case 'dlpsgame':
      default:
        scraper = { search: searchGames, detail: scrapeGameDetail };
        baseUrl = DLPSGAME_URL;
    }
    
    const gameUrl = slug.startsWith('http') ? slug : `${baseUrl}/${slug}/`;
    const useCache = options.cache !== false;
    
    try {
      // Try cache first
      if (useCache) {
        const cachedGame = gameCache.getBySlug(slug);
        if (cachedGame && gameCache.isCached(slug)) {
          console.log(`\n📋 Loaded from cache: ${cachedGame.title}\n`);
          printGameDetail(cachedGame);
          return;
        }
      }
      
      // Scrape live
      console.log(`\n📋 Fetching game details...\n`);
      const game = await scraper.detail(gameUrl);
      
      // Save to cache
      gameCache.saveFullGame(game);
      
      printGameDetail(game);
    } catch (error) {
      logger.error(`Failed to fetch game info: ${error.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// DOWNLOAD COMMAND
// ─────────────────────────────────────────────
program
  .command('download <slug>')
  .description('Download a game file')
  .requiredOption('-m, --mirror <host>', 'Mirror to use (e.g., MediaFire, Viking File, Akiabox)')
  .option('-u, --url <url>', 'Direct mirror URL (skip scraping)')
  .option('-l, --label <label>', 'Download label', 'Download')
  .option('-i, --interactive', 'Open browser for manual interaction (e.g., captchas)', false)
  .option('-s, --source <scraper>', 'Source to use: dlpsgame, pkgps4, superpsx', 'dlpsgame')
  .action(async (slug, options) => {
    let mirrorUrl = options.url;
    const isInteractive = options.interactive === true;
    const source = options.source.toLowerCase();
    
    // Select scraper based on source
    let scraper;
    let baseUrl;
    switch (source) {
      case 'pkgps4':
        scraper = { detail: scrapePkgps4 };
        baseUrl = PKGPS4_URL;
        break;
      case 'superpsx':
        scraper = { detail: scrapeSuperpsx };
        baseUrl = SUPERPSX_URL;
        break;
      case 'dlpsgame':
      default:
        scraper = { detail: scrapeGameDetail };
        baseUrl = DLPSGAME_URL;
    }
    
    // If no direct URL provided, scrape it from the game page
    if (!mirrorUrl) {
      const gameUrl = slug.startsWith('http') ? slug : `${baseUrl}/${slug}/`;
      
      console.log(`\n🔍 Scraping game page for ${options.mirror} link (source: ${source})...`);
      
      try {
        const game = await scraper.detail(gameUrl);
        
        // Find the requested mirror
        let foundMirror = null;
        for (const group of game.downloads) {
          for (const m of group.mirrors) {
            if (m.host.toLowerCase().includes(options.mirror.toLowerCase())) {
              foundMirror = m;
              break;
            }
          }
          if (foundMirror) break;
        }
        
        if (!foundMirror) {
          console.error(`\n❌ Mirror "${options.mirror}" not found for this game.`);
          console.log('\nAvailable mirrors:');
          for (const group of game.downloads) {
            console.log(`  ${group.type}:`);
            for (const m of group.mirrors) {
              console.log(`    • ${m.host}`);
            }
          }
          process.exit(1);
        }
        
        mirrorUrl = foundMirror.url;
        console.log(`✓ Found ${options.mirror} link`);
      } catch (error) {
        logger.error(`Failed to scrape game page: ${error.message}`);
        process.exit(1);
      }
    }
    
    // Resolve the mirror URL to a direct download URL
    console.log(`\n🔗 Resolving download link from ${options.mirror}...`);
    console.log(`   URL: ${mirrorUrl.substring(0, 80)}...\n`);
    
    let directUrl;
    try {
      const result = await resolveMirror(mirrorUrl, { 
        ytdlpPath: settings.get('ytdlpPath'),
        headless: !isInteractive,
      });
      
      if (!result.success) {
        console.error(`\n❌ Failed to resolve link: ${result.error}`);
        process.exit(1);
      }
      
      directUrl = result.directUrl;
      console.log(`✓ Resolved direct URL`);
    } catch (error) {
      logger.error(`Link resolution failed: ${error.message}`);
      process.exit(1);
    }
    
    // Start the download
    const downloadDir = settings.getDownloadDir();
    console.log(`\n📥 Starting download to: ${downloadDir}\n`);

    // Create download history record
    const historyId = downloadHistory.create({
      gameTitle: slug,
      fileType: options.label,
      mirrorHost: options.mirror,
      mirrorUrl: mirrorUrl,
      directUrl: directUrl,
      status: 'queued',
    });

    const downloadId = downloadManager.add({
      url: directUrl,
      destination: downloadDir,
      label: options.label,
      source: options.mirror,
      gameTitle: slug,
    });

    // Update history with manager ID
    // (historyId is DB ID, downloadId is manager ID — they're different)
    
    // Track progress
    const progressInterval = setInterval(() => {
      const status = downloadManager.getStatus(downloadId);
      if (!status) return;
      
      if (status.state === 'downloading') {
        const percent = status.stats.percent.toFixed(1).padStart(5);
        const speed = formatSpeed(status.stats.speed);
        const eta = formatEta(status.stats.eta);
        
        const barWidth = 30;
        const filledWidth = Math.round((status.stats.percent / 100) * barWidth);
        const emptyWidth = barWidth - filledWidth;
        const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
        
        process.stdout.write(`\r  ${bar} ${percent}% | ${speed} | ETA: ${eta}`);
      }
    }, 500);
    
    // Listen for completion
    downloadManager.on('download:complete', (data) => {
      if (data.id === downloadId) {
        clearInterval(progressInterval);
        console.log(`\n\n✅ Download complete: ${data.filename}`);
        console.log(`   Saved to: ${data.path}`);
        
        // Update database
        downloadHistory.markCompleted(historyId, data.path, data.size);
        
        // Send notification
        notifications.sendDownloadComplete(data.filename, data.path);
        
        // Trigger auto-extract if enabled
        if (settings.get('autoExtract') && extractor.isArchive(data.path)) {
          console.log(`\n📦 Auto-extracting archive...`);
          extractFile(data.path);
        }
      }
    });
    
    // Listen for errors
    downloadManager.on('download:error', (data) => {
      if (data.id === downloadId) {
        clearInterval(progressInterval);
        console.error(`\n\n❌ Download failed: ${data.error}`);
        
        // Update database
        downloadHistory.markFailed(historyId, data.error);
        
        // Send notification
        notifications.sendDownloadFailed(data.label || slug, data.error);
      }
    });
    
    // Mark as started in database
    downloadHistory.markStarted(historyId);
    
    // Wait for download to finish (or fail)
    await waitForDownload(downloadId);
  });

// ─────────────────────────────────────────────
// RESOLVE COMMAND
// ─────────────────────────────────────────────
program
  .command('resolve <url>')
  .description('Resolve a file host URL to a direct download link')
  .option('-i, --interactive', 'Open browser for manual interaction (e.g., captchas)', false)
  .action(async (url, options) => {
    const isInteractive = options.interactive === true;
    console.log(`\n🔗 Resolving: ${url.substring(0, 80)}...\n`);
    
    try {
      const result = await resolveMirror(url, { 
        ytdlpPath: settings.get('ytdlpPath'),
        headless: !isInteractive,
      });
      
      if (result.success) {
        console.log(`✓ Resolved successfully:`);
        console.log(`  Direct URL: ${result.directUrl}`);
        if (result.filename) console.log(`  Filename: ${result.filename}`);
      } else {
        console.error(`✗ Failed to resolve: ${result.error}`);
      }
    } catch (error) {
      logger.error(`Resolution failed: ${error.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// STATUS COMMAND
// ─────────────────────────────────────────────
program
  .command('status')
  .description('Show active download status')
  .action(() => {
    const all = downloadManager.getAll('all');
    
    if (all.length === 0) {
      console.log('\n📭 No downloads in queue.\n');
      return;
    }
    
    console.log('\n📥 Downloads:\n');
    console.log('─'.repeat(100));
    
    for (const dl of all) {
      const stateIcon = getStateIcon(dl.state);
      const percent = dl.stats?.percent?.toFixed(1) || '100.0';
      const speed = dl.stats?.speed ? formatSpeed(dl.stats.speed) : '—';
      const eta = dl.stats?.eta !== undefined && dl.stats.eta !== Infinity ? formatEta(dl.stats.eta) : '—';
      
      const label = dl.label || dl.filename || 'Unknown';
      const labelTruncated = label.length > 35 ? label.substring(0, 32) + '...' : label;
      
      console.log(`  ${stateIcon} ${labelTruncated.padEnd(38)} ${percent.padStart(6)}%  ${speed.padStart(12)}  ${eta}`);
      
      if (dl.error) {
        console.log(`     Error: ${dl.error}`);
      }
    }
    
    console.log('─'.repeat(100));
    console.log(`\n  Active: ${downloadManager.getActiveCount()} | Queued: ${downloadManager.getQueueLength()} | Completed: ${downloadManager.getCompletedCount()}`);
    console.log();
  });

// ─────────────────────────────────────────────
// EXTRACT COMMAND
// ─────────────────────────────────────────────
program
  .command('extract <file>')
  .description('Extract an archive file')
  .option('-d, --destination <dir>', 'Extraction destination')
  .option('--delete', 'Delete archive after extraction')
  .action(async (file, options) => {
    const filePath = path.resolve(file);
    
    console.log(`\n📦 Extracting: ${filePath}\n`);
    
    try {
      const result = await extractor.extract(filePath, {
        destination: options.destination || null,
        deleteAfterExtract: options.delete || false,
      });
      
      if (result.success) {
        console.log(`✅ Extracted ${result.fileCount} files to: ${result.destination}`);
      } else {
        console.error(`❌ Extraction failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Extraction failed: ${error.message}`);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// CHECK COMMAND
// ─────────────────────────────────────────────
program
  .command('check')
  .description('Check yt-dlp and system configuration')
  .action(async () => {
    console.log('\n🔧 System Check:\n');
    
    // Check yt-dlp
    const ytdlpPath = settings.get('ytdlpPath');
    const ytdlpCheck = await checkYtDlp(ytdlpPath);
    
    if (ytdlpCheck.available) {
      console.log(`  ✓ yt-dlp: ${ytdlpPath} (version ${ytdlpCheck.version})`);
    } else {
      console.log(`  ✗ yt-dlp: Not found at "${ytdlpPath}"`);
      console.log(`    Install: pip install yt-dlp`);
      console.log(`    Or download from: https://github.com/yt-dlp/yt-dlp`);
    }
    
    // Check download directory
    const downloadDir = settings.get('downloadDir');
    if (require('fs').existsSync(downloadDir)) {
      console.log(`  ✓ Download directory: ${downloadDir}`);
    } else {
      console.log(`  ⚠ Download directory does not exist: ${downloadDir}`);
    }
    
    // Check settings
    console.log(`\n  Settings file: ${settings.getConfigPath()}`);
    console.log(`  Max concurrent downloads: ${settings.get('maxConcurrentDownloads')}`);
    console.log(`  Auto-extract: ${settings.get('autoExtract') ? 'ON' : 'OFF'}`);
    console.log(`  Extract formats: ${settings.get('extractFormats').join(', ')}`);
    console.log(`  Delete after extract: ${settings.get('deleteArchiveAfterExtract') ? 'ON' : 'OFF'}`);
    console.log();
  });

// ─────────────────────────────────────────────
// SETTINGS COMMAND
// ─────────────────────────────────────────────
program
  .command('settings')
  .description('View or modify settings')
  .argument('[key]', 'Setting key to view or modify')
  .argument('[value]', 'New value for the setting')
  .action((key, value) => {
    const all = settings.getAll();
    
    if (!key) {
      // Show all settings
      console.log('\n⚙️  Settings:\n');
      for (const [k, v] of Object.entries(all)) {
        const displayValue = v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : v;
        console.log(`  ${k.padEnd(30)} ${displayValue}`);
      }
      console.log();
      return;
    }
    
    if (value !== undefined) {
      // Set a setting
      let parsedValue = value;
      
      // Parse boolean
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      // Parse number
      else if (!isNaN(value)) parsedValue = Number(value);
      // Parse null
      else if (value === 'null') parsedValue = null;
      
      settings.set(key, parsedValue);
      console.log(`\n✓ Set "${key}" to "${parsedValue}"\n`);
    } else {
      // Get a setting
      const val = settings.get(key);
      if (val !== undefined) {
        console.log(`\n  ${key}: ${val}\n`);
      } else {
        console.error(`\n✗ Unknown setting: ${key}\n`);
        process.exit(1);
      }
    }
  });

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Wait for a download to complete or fail
 */
function waitForDownload(downloadId) {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      const status = downloadManager.getStatus(downloadId);
      if (!status) {
        clearInterval(check);
        resolve();
        return;
      }
      
      if (status.state === 'completed' || status.state === 'failed' || status.state === 'cancelled') {
        clearInterval(check);
        resolve();
      }
    }, 1000);
    
    // Timeout after 5 hours
    setTimeout(() => {
      clearInterval(check);
      console.error('\n\n⏰ Download timed out (5 hours)');
      resolve();
    }, 5 * 60 * 60 * 1000);
  });
}

/**
 * Extract a file with progress
 */
async function extractFile(filePath) {
  try {
    const result = await extractor.extract(filePath);
    
    if (result.success) {
      console.log(`✅ Extracted ${result.fileCount} files to: ${result.destination}`);
    } else {
      console.error(`❌ Extraction failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Extraction error: ${error.message}`);
  }
}

/**
 * Format bytes/s to human-readable speed
 */
function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let i = 0;
  let speed = bytesPerSecond;
  
  while (speed >= 1024 && i < units.length - 1) {
    speed /= 1024;
    i++;
  }
  
  return `${speed.toFixed(1)} ${units[i]}`;
}

/**
 * Format ETA seconds to human-readable
 */
function formatEta(seconds) {
  if (!seconds || seconds === Infinity) return '—';
  
  seconds = Math.round(seconds);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * Get state icon emoji
 */
function getStateIcon(state) {
  const icons = {
    idle: '⏳',
    downloading: '⬇️',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
    cancelled: '⛔',
    retrying: '🔄',
  };
  return icons[state] || '❓';
}

// Helper and formatting functions
function printGameList(games) {
  console.log('─'.repeat(80));
  console.log(`${'#'.padEnd(4)} ${'Title'.padEnd(40)} ${'Slug'.padEnd(30)}`);
  console.log('─'.repeat(80));
  
  games.forEach((game, i) => {
    const num = String(i + 1).padEnd(4);
    const title = game.title.length > 38 ? game.title.substring(0, 35) + '...' : game.title.padEnd(40);
    const slug = game.slug.length > 28 ? game.slug.substring(0, 25) + '...' : game.slug.padEnd(30);
    console.log(`${num} ${title} ${slug}`);
  });
  
  console.log('─'.repeat(80));
}

function printGameDetail(game) {
  console.log('═'.repeat(80));
  console.log(`  ${game.title}`);
  console.log('═'.repeat(80));
  console.log();
  
  if (game.size) console.log(`  📦 Size: ${game.size}`);
  if (game.region) console.log(`  🌍 Region: ${game.region}`);
  if (game.version) console.log(`  🔖 Version: ${game.version}`);
  if (game.date) console.log(`  📅 Date: ${game.date}`);
  console.log(`  🔗 URL: ${game.url}`);
  console.log();
  
  if (game.gallery && game.gallery.length > 0) {
    console.log(`  📸 Gallery: ${game.gallery.length} image(s)`);
    console.log();
  }
  
  if (game.videos && game.videos.length > 0) {
    console.log(`  🎬 Videos: ${game.videos.length} video(s)`);
    game.videos.forEach((v, i) => {
      console.log(`     ${i + 1}. ${v.title || 'Video'}: ${v.url}`);
    });
    console.log();
  }
  
  if (game.description) {
    console.log(`  📝 Description:`);
    console.log(`  ${game.description.substring(0, 300)}${game.description.length > 300 ? '...' : ''}`);
    console.log();
  }
  
  if (game.downloads && game.downloads.length > 0) {
    console.log(`  📥 Download Options:`);
    console.log();
    
    for (const group of game.downloads) {
      const sizeStr = group.size ? ` (${group.size})` : '';
      console.log(`     ${group.type}${sizeStr}:`);
      
      for (const mirror of group.mirrors) {
        console.log(`       • ${mirror.host}: ${mirror.url.substring(0, 80)}${mirror.url.length > 80 ? '...' : ''}`);
      }
      console.log();
    }
  } else {
    console.log(`  ⚠️  No download links found`);
    console.log();
  }
  
  console.log('─'.repeat(80));
  console.log(`\n💡 Use "ps4dl download <slug> --mirror <host>" to start download`);
}

// ─────────────────────────────────────────────
// Phase 2: New Commands
// ─────────────────────────────────────────────

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
    console.log(`\n  Total: ${counts.all} | Completed: ${counts.completed} | Failed: ${counts.failed} | Active: ${counts.downloading + counts.paused + counts.queued}`);
    const totalDownloaded = downloadHistory.getTotalDownloaded();
    if (totalDownloaded > 0) {
      console.log(`  Total Downloaded: ${formatBytes(totalDownloaded)}`);
    }
    console.log();
  });

// Cache commands
const cacheCmd = program.command('cache').description('Manage game data cache');

cacheCmd.command('stats').description('Show cache statistics').action(() => {
  const stats = gameCache.getStats();
  console.log('\n📦 Cache Statistics:\n');
  console.log(`  Games cached: ${stats.games}`);
  console.log(`  Mirrors cached: ${stats.mirrors}`);
  console.log(`  Images cached: ${stats.images}`);
  console.log(`  Videos cached: ${stats.videos}`);
  console.log(`  Cache TTL: ${stats.ttlHours} hours`);
  if (stats.oldestCached) console.log(`  Oldest entry: ${stats.oldestCached}`);
  if (stats.newestCached) console.log(`  Newest entry: ${stats.newestCached}`);
  console.log();
});

cacheCmd.command('clear').description('Clear all cached game data').action(() => {
  gameCache.clearAll();
  console.log('\n✓ Cache cleared.\n');
});

cacheCmd.command('clean').description('Remove expired cache entries').action(() => {
  const cleaned = gameCache.clearExpired();
  console.log(`\n✓ Removed ${cleaned} expired entries.\n`);
});

// Database command
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

// Download control commands
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
  .action(async (id) => {
    const dl = downloadHistory.getById(parseInt(id));
    if (!dl) {
      console.error(`\n✗ Download #${id} not found.\n`);
      process.exit(1);
    }
    downloadHistory.markCancelled(parseInt(id));
    await downloadManager.cancel(dl.id, true);
    console.log(`\n⛔ Cancelled download #${id}\n`);
  });

program
  .command('retry <id>')
  .description('Retry a failed download by ID')
  .action(async (id) => {
    const success = downloadHistory.retry(parseInt(id));
    if (!success) {
      console.error(`\n✗ Download #${id} not found or not in failed state.\n`);
      process.exit(1);
    }
    console.log(`\n🔄 Queued download #${id} for retry.\n`);
  });

program
  .command('retry-all')
  .description('Retry all failed downloads')
  .action(() => {
    const count = downloadHistory.retryAllFailed();
    console.log(`\n🔄 Queued ${count} failed downloads for retry.\n`);
  });

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

// Update the check command to include database info
const originalCheck = program.commands.find(c => c.name() === 'check');
if (originalCheck) {
  program.commands = program.commands.filter(c => c.name() !== 'check');
}

program
  .command('check')
  .description('Check yt-dlp and system configuration')
  .action(async () => {
    console.log('\n🔧 System Check:\n');
    
    const ytdlpPath = settings.get('ytdlpPath');
    const ytdlpCheck = await checkYtDlp(ytdlpPath);
    
    if (ytdlpCheck.available) {
      console.log(`  ✓ yt-dlp: ${ytdlpPath} (version ${ytdlpCheck.version})`);
    } else {
      console.log(`  ✗ yt-dlp: Not found at "${ytdlpPath}"`);
      console.log(`    Install: pip install yt-dlp`);
      console.log(`    Or download from: https://github.com/yt-dlp/yt-dlp`);
    }
    
    const downloadDir = settings.get('downloadDir');
    if (require('fs').existsSync(downloadDir)) {
      console.log(`  ✓ Download directory: ${downloadDir}`);
    } else {
      console.log(`  ⚠ Download directory does not exist: ${downloadDir}`);
    }
    
    console.log(`\n  Settings file: ${settings.getConfigPath()}`);
    console.log(`  Max concurrent downloads: ${settings.get('maxConcurrentDownloads')}`);
    console.log(`  Auto-extract: ${settings.get('autoExtract') ? 'ON' : 'OFF'}`);
    console.log(`  Extract formats: ${settings.get('extractFormats').join(', ')}`);
    console.log(`  Delete after extract: ${settings.get('deleteArchiveAfterExtract') ? 'ON' : 'OFF'}`);
    
    // Database info
    console.log(`\n  Database: ${dbManager.getDbPath()}`);
    console.log(`  Database size: ${dbManager.formatBytes(dbManager.getDbSize())}`);
    const dbStats = dbManager.getStats();
    console.log(`  Games cached: ${dbStats.games}`);
    console.log(`  Download history entries: ${dbStats.downloads}`);
    
    console.log();
  });


// Parse arguments and run (must be at the very end after all commands)
program.parse(process.argv);

