// Name of the cache
const CACHE_NAME = "surf-cache-v1";

// Path to JSON file that contains the URLs to cache
const CACHE_URLS_JSON = "./offline.json";

// Install event: load URLs from JSON and cache them.
self.addEventListener("install", (event) => {
    console.log("[ServiceWorker] Install");
    event.waitUntil(
        fetch(CACHE_URLS_JSON)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.json();
            })
            .then(async (data) => {
                const urlsToCache = data.urls;
                console.log("[ServiceWorker] Caching app shell:", urlsToCache);
                const cache = await caches.open(CACHE_NAME);
              return await cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error("[ServiceWorker] Failed to load URLs from JSON:", error);
            })
    );
    self.skipWaiting();
});

// Activate event: clean up old caches.
self.addEventListener("activate", (event) => {
    console.log("[ServiceWorker] Activate");
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("[ServiceWorker] Removing old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event: serve cached content when offline.
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches
            .match(event.request)
            .then((response) => {
                // Return cached response if found.
                if (response) {
                    return response;
                }
                // Else fetch from network and cache the response.
                return fetch(event.request).then((networkResponse) => {
                    // Check for a valid response.
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
                        return networkResponse;
                    }
                    // Clone the response to add it to the cache.
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    return networkResponse;
                });
            })
            .catch(() => {
                // If both cache and network fail, show the offline page.
                return caches.match("/offline.html");
            })
    );
});
