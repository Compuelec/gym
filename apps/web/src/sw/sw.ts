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

// Rest-timer push from the server (arrives with the screen locked).
self.addEventListener('push', (event) => {
  const data = (event.data?.json() ?? {}) as { title?: string; body?: string; tag?: string; url?: string };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Gym', {
      body: data.body,
      tag: data.tag ?? 'gym',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).pathname === url) ?? windows[0];
      if (open) {
        await open.focus();
        if (new URL(open.url).pathname !== url) await open.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
