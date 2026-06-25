/* Quran Quiz Net — PWA service worker
 *
 * Strategy (full offline after first load):
 *  - Navigations (HTML): network-first, fall back to cached app shell when offline.
 *  - Hashed/immutable assets (/_expo/, /assets/, /icons/, js/css/fonts/images):
 *    cache-first. These names are content-hashed by the Expo export, so once
 *    cached they never go stale — this is what makes the bundled q.json (and the
 *    whole quiz) work fully offline after the first visit.
 *  - Everything else same-origin: network-first with cache fallback.
 *
 * Bump CACHE_VERSION on every release to bust old caches (the React/Expo
 * equivalent of the old www/worker.js `cacheName` bump).
 */
const CACHE_VERSION = 'v2';
const CACHE_NAME = `qqn-${CACHE_VERSION}`;

// App-shell resources precached at install time.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll fails the whole install if one entry 404s; add individually instead.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico|json)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (Firebase, fonts) hit network

  // Navigations → network-first, fall back to cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html') || caches.match('/'))
        )
    );
    return;
  }

  // Immutable, content-hashed assets → cache-first (populate on miss).
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other same-origin GETs → network-first with cache fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
