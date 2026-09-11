const { app, BrowserWindow } = require('electron');
const path = require('path');

const { bootstrap, registerIpcHandlers, setBroadcaster, setMainWindow, broadcast, listDownloads } = require('./ipc');

let mainWindow = null;

// Last-resort safety net: a stray async error must never take down the app
// with a main-process crash dialog. Log it loudly instead.
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection:', reason instanceof Error ? reason.stack || reason.message : reason);
});
process.on('uncaughtException', (error) => {
  console.error('[main] uncaught exception:', error instanceof Error ? error.stack || error.message : error);
});

// Dev flag: `electron . --dev` loads the Vite dev server instead of built UI
const DEV = process.argv.includes('--dev') || process.env.PS4DL_DEV === '1';
const VITE_URL = 'http://localhost:5173';

function createWindow(ctx) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#061423',
    title: 'PS4 PKG Downloader',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Push manager events + periodic full snapshots to the renderer.
  // Updater events ride the same channel but keep their own payload shape
  // (the download shape would mangle percent/version fields).
  setBroadcaster((type, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (String(type).startsWith('update:')) {
      mainWindow.webContents.send('download:event', { type, ...((payload && typeof payload === 'object') ? payload : {}) });
      return;
    }
    mainWindow.webContents.send('download:event', {
      type,
      download: payload ? { id: payload.id, url: payload.url } : null,
    });
    // Full snapshot keeps renderer state authoritative
    mainWindow.webContents.send('downloads:snapshot', listDownloads(ctx));
  });

  if (DEV) {
    mainWindow.loadURL(VITE_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Built UI lives at renderer/dist (repo-relative, works packaged too)
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
  setMainWindow(mainWindow);
}

let updaterState = { status: 'idle', version: null, percent: 0, transferred: 0, total: 0, error: null };

// Stall watchdog: if a download is in flight but no progress arrives within
// STALL_MS, tell the renderer once (re-armed by the next progress event).
// Threshold is env-overridable for tests: PS4DL_STALL_TIMEOUT_MS.
const UPDATE_STALL_MS = Number(process.env.PS4DL_STALL_TIMEOUT_MS) || 60000;
let updateLastProgressAt = 0;
let updateStallSent = false;
let updateStallTimer = null;

function armStallWatchdog() {
  if (updateStallTimer) return;
  try {
    updateStallTimer = setInterval(() => {
      try {
        if (!ctxRef || updateStallSent) return;
        const startedAt = Number(ctxRef.updateDownloadActive) || 0;
        if (!startedAt) return;
        const lastActivity = Math.max(startedAt, updateLastProgressAt);
        if (Date.now() - lastActivity > UPDATE_STALL_MS) {
          updateStallSent = true;
          broadcast('update:stalled', { percent: updaterState.percent });
        }
      } catch (_) {}
    }, 10000);
    if (updateStallTimer.unref) updateStallTimer.unref();
  } catch (_) {}
}

let ctxRef = null;

function wireAutoUpdater(ctx) {
  let autoUpdater = null;
  try {
    // eslint-disable-next-line global-require
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (error) {
    console.error(`[updater] unavailable: ${error.message}`);
    return null;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.allowDowngrade = false;
  const applyChannel = () => {
    try {
      autoUpdater.allowPrerelease = ctx.settings.get('updateChannel') !== 'stable';
    } catch (_) {
      autoUpdater.allowPrerelease = true;
    }
  };
  applyChannel();
  ctxRef = ctx;
  armStallWatchdog();
  autoUpdater.on('checking-for-update', () => { updaterState = { status: 'checking', version: null, percent: 0, transferred: 0, total: 0, error: null }; });
  autoUpdater.on('update-available', (info) => {
    updaterState = { status: 'available', version: (info && info.version) || null, percent: 0, transferred: 0, total: 0, error: null };
    broadcast('update:available', { version: updaterState.version });
  });
  autoUpdater.on('update-not-available', () => { updaterState = { status: 'idle', version: null, percent: 0, transferred: 0, total: 0, error: null }; });
  autoUpdater.on('download-progress', (p) => {
    updaterState.percent = Math.round((p && p.percent) || 0);
    updaterState.transferred = Number((p && p.transferred) || 0);
    updaterState.total = Number((p && p.total) || 0);
    updateLastProgressAt = Date.now();
    updateStallSent = false;
    broadcast('update:progress', { percent: updaterState.percent, transferred: updaterState.transferred, total: updaterState.total });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updaterState = { status: 'downloaded', version: (info && info.version) || updaterState.version, percent: 100, transferred: updaterState.transferred, total: updaterState.total, error: null };
    try {
      ctx.updateDownloadActive = false;
    } catch (_) {}
    updateStallSent = false;
    broadcast('update:downloaded', { version: updaterState.version });
    try {
      if (ctx.notifications) ctx.notifications.send(`Update ${updaterState.version || ''} downloaded`.trim(), 'Restart the app to install it');
    } catch (_) {}
  });
  autoUpdater.on('error', (error) => {
    updaterState = { status: 'error', version: null, percent: 0, transferred: 0, total: 0, error: (error && error.message) || String(error) };
    try {
      ctx.updateDownloadActive = false;
    } catch (_) {}
    broadcast('update:error', { error: updaterState.error });
  });
  return autoUpdater;
}

app.whenReady().then(() => {
  const ctx = bootstrap();
  registerIpcHandlers(ctx);
  createWindow(ctx);

  // Silent launch check (unless disabled); the renderer prompts only when an update lands
  const updater = wireAutoUpdater(ctx);
  if (updater) {
    ctx.appUpdater = updater;
    let autoCheck = true;
    try {
      autoCheck = ctx.settings.get('autoCheckUpdates') !== false;
    } catch (_) {}
    if (autoCheck) updater.checkForUpdates().catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(ctx);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
