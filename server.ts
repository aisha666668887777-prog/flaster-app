import { createServer } from './src/server/app.ts';
import { registerZiinaWebhook } from './src/server/paymentService.ts';
import express from 'express';
import path from 'path';

async function start() {
  const app = createServer();
  const isProd = process.env.NODE_ENV === 'production';
  // AI Studio Dev server strictly requires port 3000; Cloud Run production uses process.env.PORT
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
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Flaster Server running on http://0.0.0.0:${port}`);
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
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
