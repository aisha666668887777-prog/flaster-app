import { createServer } from './src/server/app.ts';
import { registerZiinaWebhook } from './src/server/paymentService.ts';
import { recordOpsLog } from './src/server/opsService.ts';
import express from 'express';
import fs from 'fs';
import path from 'path';

// Prevent transient async/network/Firestore errors from crashing Render with "Exited with status 1"
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[Server] Caught unhandledRejection:', msg);
  recordOpsLog({
    level: 'error',
    category: 'system',
    message: `Unhandled rejection caught safely: ${msg.slice(0, 160)}`,
  });
});

process.on('uncaughtException', (err: Error) => {
  console.error('[Server] Caught uncaughtException:', err?.message || err);
  recordOpsLog({
    level: 'error',
    category: 'system',
    message: `Uncaught exception caught safely: ${String(err?.message || err).slice(0, 160)}`,
  });
});

async function start() {
  const app = createServer();
  // Automatically treat Render runtime as production even if NODE_ENV was omitted,
  // preventing heavy Vite dev server from booting inside Render's 512MB RAM container.
  const isRenderRuntime =
    process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID);
  const isProd = process.env.NODE_ENV === 'production' || isRenderRuntime;
  // AI Studio Dev server strictly requires port 3000; Render/Cloud Run production uses process.env.PORT
  const port = isProd && process.env.PORT ? Number(process.env.PORT) : 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    const hashedAssetsDir = path.join(distPath, 'assets') + path.sep;

    const setNoCacheHeaders = (res: express.Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    };

    app.use(
      express.static(distPath, {
        index: false,
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          const fileName = path.basename(filePath);
          const isNoCacheFile =
            fileName.endsWith('.html') ||
            fileName === 'sw.js' ||
            fileName === 'registerSW.js' ||
            fileName === 'service-worker.js' ||
            fileName === 'manifest.json' ||
            fileName === 'manifest.webmanifest' ||
            fileName.startsWith('workbox-');

          if (isNoCacheFile) {
            setNoCacheHeaders(res);
            if (fileName === 'sw.js' || fileName === 'service-worker.js') {
              res.setHeader('Service-Worker-Allowed', '/');
            }
            return;
          }

          // Vite build output under /assets/ contains content hashes and can be cached safely long-term
          if (filePath.startsWith(hashedAssetsDir)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return;
          }

          // Non-hashed static icons/media: revalidate after 1 day
          res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
        },
      })
    );

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found.' });
      }
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(503).send('Application build not found.');
      }
      setNoCacheHeaders(res);
      return res.sendFile(indexHtmlPath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).end();
        }
      });
    });
  }

  // Final Express 4-argument error handler so malformed JSON/route errors never crash the server
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const msg = err instanceof Error ? err.message : 'Internal server error';
      recordOpsLog({
        level: 'error',
        category: 'system',
        message: `Express error: ${msg.slice(0, 140)}`,
        method: req.method,
        path: req.originalUrl,
        statusCode: 500,
      });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'حدث خطأ مؤقت في الخادم، يرجى المحاولة مجدداً.' });
      }
    }
  );

  const httpServer = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Flaster Server running on http://0.0.0.0:${port} (mode=${isProd ? 'production' : 'dev'})`);
    if ((process.env.ZIINA_API_TOKEN || '').trim() && (process.env.ZIINA_WEBHOOK_SECRET || '').trim()) {
      registerZiinaWebhook()
        .then((res) => {
          if (res.success) {
            console.log(`✅ Ziina Webhook registered automatically: ${res.webhookUrl}`);
          }
        })
        .catch(() => {
          // Ignore network errors during startup
        });
    }
  });

  // Clean shutdown on Render SIGTERM/SIGINT so Render exits with status 0 instead of status 1
  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down cleanly...`);
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
