/* Service worker for the Lake Garda 2026 site.
   Precaches every page + shared assets so the whole planner works offline
   (poolside, on the plane, roaming off). Same-origin requests are served
   stale-while-revalidate: instant from cache, refreshed in the background.

   IMPORTANT: bump CACHE_VERSION whenever site content changes, so installed
   apps pick up the new pages on their next visit. */

var CACHE_VERSION = 'garda-2026-v1';

var PRECACHE = [
    './',
    'index.html',
    'itinerary.html',
    'booking.html',
    'logistics.html',
    'essentials.html',
    'resort.html',
    'activities.html',
    'gardaland.html',
    'canevaworld.html',
    'boats.html',
    'daytrips.html',
    'towns.html',
    'nature.html',
    'beaches.html',
    'markets.html',
    'bikes.html',
    'running.html',
    'dining.html',
    'food.html',
    'etiquette.html',
    'phrases.html',
    'packing.html',
    'budget.html',
    'style.css',
    'theme.js',
    'pwa.js',
    'manifest.json',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(function (cache) {
            return cache.addAll(PRECACHE);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key !== CACHE_VERSION) {
                    return caches.delete(key);
                }
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') {
        return;
    }

    /* Stale-while-revalidate for everything cacheable (pages, assets, and
       the Google Fonts files). Falls back to the cached home page for
       navigations that miss the cache entirely. */
    event.respondWith(
        caches.open(CACHE_VERSION).then(function (cache) {
            return cache.match(request).then(function (cached) {
                var refresh = fetch(request).then(function (response) {
                    if (response && response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                }).catch(function () {
                    if (cached) {
                        return cached;
                    }
                    if (request.mode === 'navigate') {
                        return cache.match('index.html');
                    }
                    return Response.error();
                });
                return cached || refresh;
            });
        })
    );
});
