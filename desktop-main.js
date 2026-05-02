import { app as electronApp, BrowserWindow, shell } from 'electron';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import robloxAssets from './api/roblox-assets.js';
import robloxOperation from './api/roblox-operation.js';
import robloxAssetPermissions from './api/roblox-asset-permissions.js';
import robloxInventoryAssets from './api/roblox-inventory-assets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.SONICMORPH_DESKTOP_PORT || 3127);
const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE || '500mb';

let mainWindow;
let server;

electronApp.commandLine.appendSwitch('disable-renderer-backgrounding');
electronApp.commandLine.appendSwitch('disable-background-timer-throttling');

electronApp.whenReady().then(async () => {
  await startLocalServer();
  createWindow();

  electronApp.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electronApp.quit();
});

electronApp.on('before-quit', () => {
  server?.close();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0a0502',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

function startLocalServer() {
  const webApp = express();

  webApp.use('/api/roblox-assets', rawBodyMiddleware(MAX_UPLOAD_SIZE), wrapHandler(robloxAssets));
  webApp.use('/api/roblox-operation', wrapHandler(robloxOperation));
  webApp.use('/api/roblox-asset-permissions', jsonBodyMiddleware(), wrapHandler(robloxAssetPermissions));
  webApp.use('/api/roblox-inventory-assets', wrapHandler(robloxInventoryAssets));
  webApp.use(express.static(path.join(__dirname, 'dist'), {
    extensions: ['html'],
    maxAge: '1h',
  }));
  webApp.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
  webApp.use((error, req, res, _next) => {
    console.error('Desktop server request failed:', error);
    if (res.headersSent) return;

    res.status(error.statusCode || error.status || 500).json({
      message: error.message || 'Desktop server request failed.',
      path: req.originalUrl,
    });
  });

  return new Promise((resolve, reject) => {
    server = webApp.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
    server.timeout = 0;
    server.requestTimeout = 0;
    server.headersTimeout = 0;
  });
}

function rawBodyMiddleware(limit) {
  return (req, res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    express.raw({ type: '*/*', limit })(req, res, next);
  };
}

function jsonBodyMiddleware() {
  return express.json({ limit: '2mb' });
}

function wrapHandler(handler) {
  return (req, res, next) => {
    patchQuery(req);
    patchBodyStream(req);
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function patchQuery(req) {
  if (req.query) return;

  const url = new URL(req.originalUrl, 'http://localhost');
  req.query = Object.fromEntries(url.searchParams.entries());
}

function patchBodyStream(req) {
  if (!Buffer.isBuffer(req.body)) return;

  const body = req.body;
  req.on = (event, callback) => {
    if (event === 'data') {
      queueMicrotask(() => callback(body));
      return req;
    }

    if (event === 'end') {
      queueMicrotask(callback);
      return req;
    }

    return req;
  };
}
