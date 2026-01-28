const CACHE = "72h-tabor-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js"
];

self.addEventListener("install", e =>
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())
  )
);

self.addEventListener("activate", e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k)))
    ).then(()=>self.clients.claim())
  )
);

self.addEventListener("fetch", e =>
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  )
);
