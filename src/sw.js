import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// `npm run build` (vite-plugin-pwa) replaces self.__WB_MANIFEST with every file in dist/, hashed
// bundles included, each with a revision. A new build installs as a new worker that downloads only
// the changed files, and the app shell and its scripts always come from the same build.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Page loads: the precached app shell, so the app starts offline. A new version is picked up on
// the launch after the new worker installs.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Google Fonts (the stylesheet and the font files it points to): cached as they are first used.
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
);

// Everything else, including Supabase API, auth and realtime, goes to the network.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Caches from the hand-written worker before this one ('irontrack-v1'…'irontrack-v4').
      .then((keys) => Promise.all(keys.filter((k) => /^irontrack-v\d+$/.test(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
