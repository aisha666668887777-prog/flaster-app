/**
 * Legacy Service Worker Self-Cleanup & Migration Bridge
 *
 * Older installed Flaster PWAs on Android and iOS registered `/service-worker.js?v=4`
 * with a static cache (`flaster-pwa-cache-v4`), conflicting with Workbox's `/sw.js`.
 *
 * Keeping this lightweight migration script at `/service-worker.js` ensures devices
 * already running the legacy worker automatically purge old caches, unregister this
 * legacy worker, and seamlessly hand over control to `/sw.js` without forcing users
 * to uninstall and reinstall the PWA.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith('flaster-pwa-cache'))
            .map((key) => caches.delete(key))
        );
      } catch {
        // Ignore cache storage errors
      }

      try {
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'FLASTER_LEGACY_SW_CLEANED' });
        }
      } catch {
        // Ignore client notification errors
      }

      try {
        await self.registration.unregister();
      } catch {
        // Ignore unregister errors
      }
    })()
  );
});
