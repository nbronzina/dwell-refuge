// ============================================
// DWELL:REFUGE - Service Worker
// Offline support and caching
// ============================================

const CACHE_NAME = 'dwell-refuge-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/js/audio.js',
    '/js/input.js',
    '/js/synthesis.js',
    '/js/samples.js',
    '/js/zones.js',
    '/manifest.json',
    '/icon.svg'
];
// Note: field recordings in audio/ are cached at runtime on first
// fetch (cache-first branch below), so they work offline after the
// first listen without breaking install when files are absent.

// Install: cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching assets');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch:
// - Navigations (index.html) are network-first so deploys reach
//   existing users without a manual cache bump
// - Everything else is cache-first for offline speed
self.addEventListener('fetch', (event) => {
    const isNavigation = event.request.mode === 'navigate' ||
        event.request.url.endsWith('/index.html');

    if (isNavigation) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(r => r || caches.match('/index.html'));
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // Clone and cache the response
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            })
            .catch(() => {
                // Offline fallback for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});
