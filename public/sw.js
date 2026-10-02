const CACHE_NAME = 'irontrack-v4';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.svg',
  '/maskable-icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/apple-touch-icon.png'
];
// Third-party scripts/styles index.html needs to boot. Must match the URLs in index.html exactly.
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap'
];
const CACHEABLE_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(SHELL_ASSETS);
      // Best effort: a CDN hiccup must not block installing the app shell.
      await Promise.all(CDN_ASSETS.map((url) => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isCacheable = (res) => res && (res.ok || res.type === 'opaque');

// Hosts often send Vary (e.g. Vary: Origin); module scripts are requested with an Origin header the
// cached request lacked, so a Vary-respecting lookup would miss and the app would not load offline.
const MATCH_OPTS = { ignoreVary: true };

const putInCache = (request, res) =>
  caches.open(CACHE_NAME).then((cache) => cache.put(request, res));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, Supabase API/auth/realtime, and anything not ours or from our CDNs
  if (request.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;

  // HTML documents: network first, fallback to cached shell
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) event.waitUntil(putInCache('/index.html', res.clone()));
          return res;
        })
        .catch(() =>
          caches.match('/index.html', MATCH_OPTS).then((r) => r || caches.match('/', MATCH_OPTS))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request, MATCH_OPTS).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (isCacheable(res)) event.waitUntil(putInCache(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  // Allow the page to trigger a skipWaiting
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // The page sends the app's own asset URLs (hashed bundle names are not known here).
  if (event.data && event.data.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.filter((u) => {
      try { return new URL(u).origin === self.location.origin; } catch (e) { return false; }
    });
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.all(urls.map((u) => caches.match(u, MATCH_OPTS).then((hit) => hit || cache.add(u).catch(() => {}))))
      )
    );
  }
});
