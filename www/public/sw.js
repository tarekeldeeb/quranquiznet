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
const CACHE_VERSION = 'v4';
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

// True when a response is an HTML document. Used to make sure we never cache (or
// keep serving) index.html under an asset URL — which is what Firefox/Chrome see
// as "OTS parsing error / Failed to decode font" when a deploy momentarily 404s
// an asset and the SPA rewrite returns index.html in its place.
function isHtmlResponse(response) {
  return (response.headers.get('content-type') || '').includes('text/html');
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
        // Serve the cached copy only if it's a real asset. A poisoned entry (HTML
        // stored under an asset URL by a momentarily-broken deploy) is ignored and
        // re-fetched, so the asset self-heals once the server serves the real file.
        if (cached && !isHtmlResponse(cached)) return cached;
        return fetch(request).then((response) => {
          // Never cache an HTML response under an asset URL — that's the poison.
          if (response && response.status === 200 && response.type === 'basic' && !isHtmlResponse(response)) {
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
