/* Service worker for the Lake Garda 2026 site.
   Precaches every page + shared assets so the whole planner works offline
   (poolside, on the plane, roaming off). Same-origin requests are served
   stale-while-revalidate: instant from cache, refreshed in the background
   whenever there's a connection.

   IMPORTANT: bump CACHE_VERSION whenever site content changes, so installed
   apps pick up the new pages on their next online visit. */

var CACHE_VERSION = 'garda-2026-v10';

/* Local pages + assets — these MUST be available offline. */
var PRECACHE = [
    './',
    'index.html',
    'weather.html',
    'itinerary.html',
    'booking.html',
    'logistics.html',
    'transfer.html',
    'essentials.html',
    'resort.html',
    'activities.html',
    'gardaland.html',
    'canevaworld.html',
    'boats.html',
    'daytrips.html',
    'venice.html',
    'towns.html',
    'nature.html',
    'beaches.html',
    'markets.html',
    'bikes.html',
    'running.html',
    'dining.html',
    'food.html',
    'wines.html',
    'etiquette.html',
    'phrases.html',
    'packing.html',
    'budget.html',
    'style.css',
    'theme.js',
    'pwa.js',
    'weather.js',
    'manifest.json',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png'
];

/* Cross-origin extras worth having offline (the Google Fonts stylesheet).
   The actual font files it references are cross-origin/opaque and are picked
   up by the runtime cache on first online load instead. */
var EXTERNAL_PRECACHE = [
    'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..700;1,9..144,500..700&family=Inter:wght@400..800&display=swap'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(function (cache) {
            /* Cache each item on its own. cache.addAll() is atomic — a single
               failed request would abort the whole precache and leave the app
               with nothing offline — so we tolerate individual failures and
               still cache everything that succeeds. */
            var all = PRECACHE.concat(EXTERNAL_PRECACHE);
            return Promise.all(all.map(function (url) {
                return cache.add(url).catch(function () {
                    /* skip assets that fail to fetch at install time;
                       the runtime handler will pick them up later */
                });
            }));
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

    /* Live weather API: network-first so an online device always gets the
       freshest forecast, falling back to the last cached response when offline
       (so the weather page/home card still show something poolside or roaming). */
    if (request.url.indexOf('api.open-meteo.com') !== -1) {
        event.respondWith(
            caches.open(CACHE_VERSION).then(function (cache) {
                return fetch(request).then(function (response) {
                    if (response && response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                }).catch(function () {
                    return cache.match(request).then(function (cached) {
                        return cached || Response.error();
                    });
                });
            })
        );
        return;
    }

    /* Stale-while-revalidate for everything cacheable (pages, assets and the
       Google Fonts files). Serve the cached copy instantly, then refresh it
       in the background when online so the next visit is up to date. Falls
       back to the cached home page for navigations that miss the cache. */
    event.respondWith(
        caches.open(CACHE_VERSION).then(function (cache) {
            return cache.match(request).then(function (cached) {
                var refresh = fetch(request).then(function (response) {
                    /* Cache successful same-origin responses and opaque
                       cross-origin ones (e.g. Google Fonts woff2 files, whose
                       no-cors responses report status 0 / ok === false). */
                    if (response && (response.ok || response.type === 'opaque')) {
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

                /* Keep the worker alive long enough to finish the background
                   refresh so updates land even when we served from cache. */
                event.waitUntil(refresh.catch(function () {}));

                return cached || refresh;
            });
        })
    );
});

/* Let the page trigger an immediate activation after an update. */
self.addEventListener('message', function (event) {
    if (event.data === 'skip-waiting') {
        self.skipWaiting();
    }
});
