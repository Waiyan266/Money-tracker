const PATH_HASH = self.location.pathname.replace(/\/sw\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_') || 'app';
const CACHE_NAME = `ExpenseTracker_${PATH_HASH}_Cache_v1`;

const ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key.startsWith('ExpenseTracker_') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request).catch(() => caches.match('./index.html'));
        })
    );
});
