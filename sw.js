const CACHE = "72h-cache-v20260126-" + "20260126_144337";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./faq.json",
  "./synonyms.json",
  "./help.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./city.config.json",
  "./assets/cities/tabor/logo.svg",
];

self.addEventListener("install", (e) =>
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(ASSETS);
      self.skipWaiting();
    })()
  )
);

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const ks = await caches.keys();
      await Promise.all(ks.map((k) => (k === CACHE ? null : caches.delete(k))));
      self.clients.claim();
    })()
  )
);

function isNetworkFirst(url) {
  // data soubory: chceme vždy brát nejnovější, ale mít fallback do cache pro offline
  return (
    url.endsWith("/faq.json") ||
    url.endsWith("/synonyms.json") ||
    url.endsWith("/city.config.json")
  );
}

self.addEventListener("fetch", (e) =>
  e.respondWith(
    (async () => {
      const req = e.request;
      const url = new URL(req.url);

      // Jen stejné origin (GH Pages)
      if (url.origin !== self.location.origin) {
        return fetch(req);
      }

      const cache = await caches.open(CACHE);

      // NETWORK-FIRST pro JSONy
      if (isNetworkFirst(url.pathname)) {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const hit = await cache.match(req);
          return hit || new Response("Offline", { status: 503 });
        }
      }

      // CACHE-FIRST pro všechno ostatní
      const hit = await cache.match(req);
      if (hit) return hit;

      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return hit || new Response("Offline", { status: 503 });
      }
    })()
  )
);
