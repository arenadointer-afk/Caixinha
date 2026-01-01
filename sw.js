const CACHE = "caixinha-v1";

const FILES = [
  "/Caixinha/",
  "/Caixinha/index.html",
  "/Caixinha/styles.css",
  "/Caixinha/app.js",
  "/Caixinha/manifest.json",
  "/Caixinha/icon-192.png",
  "/Caixinha/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request);
    })
  );
});
