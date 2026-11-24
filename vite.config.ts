import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'disable-hmr-ws-client',
        apply: 'serve',
        enforce: 'post',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs') || id.includes('vite/dist/client/bundledDevClient.mjs')) {
            return {
              code: code
                .replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR WebSocket disabled in cloud preview */'
                )
                .replace(
                  'else throw new SendBeforeConnectError("send was called before connect");',
                  'else return;'
                )
                .replace(
                  'else throw new SendBeforeConnectError("invoke was called before connect");',
                  'else return;'
                ),
              map: null,
            };
          }
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        manifestFilename: 'manifest.json',
        includeAssets: ['flaster-app-icon.jpg'],
        manifest: {
          id: '/',
          name: 'Flaster • فلاستر - استمتع بالأفضل ووفر الأكثر',
          short_name: 'Flaster',
          description: 'فلاستر (Flaster): استمتع بالأفضل ووفر الأكثر — احصل على أشهى وجبات ومخبوزات أفضل مطاعم وكافيهات رأس الخيمة طازجة يومياً بخصم يصل إلى 70%.',
          lang: 'ar',
          dir: 'rtl',
          orientation: 'portrait',
          theme_color: '#ee5253',
          background_color: '#FAF7F2',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          categories: ['food', 'shopping', 'lifestyle'],
          icons: [
            {
              src: '/pwa-192x192.png?v=2',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png?v=2',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png?v=2',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/service-worker.js', '**/google*.html', '**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/__cookie_check/,
            /^\/api\//,
            /^\/sitemap\.xml/,
            /^\/robots\.txt/,
            /^\/google.*\.html/,
          ],
          runtimeCaching: [
            {
              // Never cache live backend API routes (orders, payments, auth, loyalty, health)
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              // Never cache Firebase Auth or Firestore live API calls
              urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Same-origin images & icons: fast load with background refresh
              urlPattern: ({ request, url }) =>
                request.destination === 'image' &&
                url.origin === self.location.origin,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'flaster-images-cache',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    build: {
      sourcemap: false,
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio cloud environment
      hmr: false,
      ws: false,
      watch: null,
    },
  };
});
