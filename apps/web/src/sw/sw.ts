/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// App shell: every build asset is precached so the app opens without network.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation works offline; the API is never served from cache.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));

// Exercise images: immutable, cache-first. Evictable when the device is full (see safe-write.ts).
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: 'catalog-images',
    plugins: [new ExpirationPlugin({ maxEntries: 4000, purgeOnQuotaError: true })],
  }),
);

// Take control of open pages once active. A new version only activates after the user accepts
// (SKIP_WAITING below), so this never swaps versions under a running workout.
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// The page asks to activate a waiting version only when the user accepts and no workout is running.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
