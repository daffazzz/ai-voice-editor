import express from 'express';
import { createServer as createViteServer } from 'vite';
import robloxAssets from './api/roblox-assets.js';
import robloxOperation from './api/roblox-operation.js';
import robloxAssetPermissions from './api/roblox-asset-permissions.js';
import robloxInventoryAssets from './api/roblox-inventory-assets.js';

const PORT = Number(process.env.PORT || 3001);
const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE || '250mb';

const app = express();

app.use('/api/roblox-assets', rawBodyMiddleware(MAX_UPLOAD_SIZE), wrapHandler(robloxAssets));
app.use('/api/roblox-operation', wrapHandler(robloxOperation));
app.use('/api/roblox-asset-permissions', wrapHandler(robloxAssetPermissions));
app.use('/api/roblox-inventory-assets', wrapHandler(robloxInventoryAssets));

const vite = await createViteServer({
  server: {
    middlewareMode: true,
    hmr: true,
  },
  appType: 'spa',
});

app.use(vite.middlewares);

app.use((error, req, res, _next) => {
  console.error('Local server request failed:', error);
  if (res.headersSent) return;

  res.status(error.statusCode || error.status || 500).json({
    message: error.message || 'Local server request failed.',
    path: req.originalUrl,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SonicMorph local server running at http://localhost:${PORT}`);
  console.log(`Upload proxy limit: ${MAX_UPLOAD_SIZE}`);
});

function rawBodyMiddleware(limit) {
  return (req, res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    express.raw({ type: '*/*', limit })(req, res, next);
  };
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
