const PATH_HASH = self.location.pathname.replace(/\/sw\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_') || 'app';
const CACHE_NAME = `ExpenseTracker_${PATH_HASH}_Cache_v3`;

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
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Network-First strategy for documents & navigation, bypass API calls
self.addEventListener('fetch', (e) => {
    // Never cache API calls
    if (e.request.url.includes('/api/')) {
        return;
    }

    // Network-First for HTML navigation so updates appear immediately
    if (e.request.mode === 'navigate' || e.request.destination === 'document') {
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(e.request).then(res => res || caches.match('./index.html')))
        );
        return;
    }

    // Stale-while-revalidate / network-first for other assets
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
