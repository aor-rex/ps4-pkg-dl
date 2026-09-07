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
    // dist lives in the sibling ps4-pkg-ui project
    mainWindow.loadFile(path.resolve(__dirname, '../../../ps4-pkg-ui/dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  const ctx = bootstrap();
  registerIpcHandlers(ctx);
  createWindow(ctx);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(ctx);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
