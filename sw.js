const CACHE_NAME = 'finance-tracker-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/js/app.js',
  '/js/store.js',
  '/js/ui.js',
  '/js/dashboard.js',
  '/js/statistics.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache all assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] All assets cached successfully');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Cache install failed:', err);
      })
  );
});

// Activate — clean old caches, take control immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => {
        console.log('[SW] Activated, claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch — cache-first with navigation handling
self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Navigation requests (opening the app) → always serve cached index.html
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html')
        .then(cached => cached || fetch(request))
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // All other requests — cache first, network fallback
  e.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // Cache successful responses for future offline use
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        // Last resort — try matching by URL pathname only
        const url = new URL(request.url);
        return caches.match(url.pathname);
      })
  );
});
