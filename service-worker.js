/* =========================================
   Your Japan Journey — Service Worker
   Offline-first: app shell + assets cached;
   Google Fonts cached at runtime.
   ========================================= */

const CACHE_VERSION = 'japan-journey-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './images/hero-01.jpg',
  './images/hero-02.jpg',
  './images/moment-itinerary.jpg',
  './images/moment-culture.jpg',
  './images/moment-packing.jpg',
];

/* --- Install: pre-cache the app shell ------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use individual requests so one 404 doesn't kill the whole install
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('SW: skip', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* --- Activate: clean up old caches ---------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* --- Fetch: network-first for HTML, cache-first for assets ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin requests we don't control, except Google Fonts
  const isGoogleFonts =
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com';

  if (url.origin !== self.location.origin && !isGoogleFonts) return;

  // HTML: network-first so updates land quickly, fallback to cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else: cache-first, then network, then cache response
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache successful, basic or cors responses
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
