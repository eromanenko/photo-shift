const VERSION = '0.1.9';
const CACHE_NAME = 'photo-shift-v' + VERSION;
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './game.js',
    './manifest.json',
    './icon.svg',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap'
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(STATIC_ASSETS))
        .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
        .then((keys) => Promise.all(
            keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        ))
        .then(() => self.clients.claim())
    );
});

// Fetch: Serve matching strategy
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;
    
    // Network First (Fresh First) for Random API Photos
    if (event.request.url.includes('picsum.photos')) {
        event.respondWith(
            fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open('picsum-cache').then((cache) => {
                    cache.put(event.request, clone);
                });
                return response;
            })
            .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache First with default fallback for assets
    event.respondWith(
        caches.match(event.request)
        .then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clone);
                });
                return response;
            });
        })
    );
});
