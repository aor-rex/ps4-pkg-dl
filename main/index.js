const { app, BrowserWindow } = require('electron');
const path = require('path');

const { bootstrap, registerIpcHandlers, setBroadcaster, listDownloads } = require('./ipc');

let mainWindow = null;

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

  // Push manager events + periodic full snapshots to the renderer
  setBroadcaster((type, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
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
}

let updaterState = { status: 'idle', version: null, percent: 0, error: null };

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
  autoUpdater.on('checking-for-update', () => { updaterState = { status: 'checking', version: null, percent: 0, error: null }; });
  autoUpdater.on('update-available', (info) => {
    updaterState = { status: 'available', version: (info && info.version) || null, percent: 0, error: null };
    setBroadcaster('update:available', { version: updaterState.version });
  });
  autoUpdater.on('update-not-available', () => { updaterState = { status: 'idle', version: null, percent: 0, error: null }; });
  autoUpdater.on('download-progress', (p) => {
    updaterState.percent = Math.round((p && p.percent) || 0);
    if (updaterState.status === 'downloading') setBroadcaster('update:progress', { percent: updaterState.percent });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updaterState = { status: 'downloaded', version: (info && info.version) || updaterState.version, percent: 100, error: null };
    setBroadcaster('update:downloaded', { version: updaterState.version });
  });
  autoUpdater.on('error', (error) => {
    updaterState = { status: 'error', version: null, percent: 0, error: (error && error.message) || String(error) };
    setBroadcaster('update:error', { error: updaterState.error });
  });
  return autoUpdater;
}

app.whenReady().then(() => {
  const ctx = bootstrap();
  registerIpcHandlers(ctx);
  createWindow(ctx);

  // Silent launch check; the renderer prompts only when an update lands
  const updater = wireAutoUpdater(ctx);
  if (updater) {
    ctx.appUpdater = updater;
    updater.checkForUpdates().catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(ctx);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
