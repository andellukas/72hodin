const CACHE = "72h-cache-v20260126-20260126_144504-pwa3";

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
  "./sw.pwa3.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./city.config.json",
  "./assets/cities/tabor/logo.svg",
  "./cities/tabor/scenarios.json",
  "./cities/tabor/knowledge_base.txt",
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

function isNetworkFirst(pathname) {
  return (
    pathname.endsWith("/faq.json") ||
    pathname.endsWith("/synonyms.json") ||
    pathname.endsWith("/city.config.json") || pathname.includes("/cities/")
  );
}

self.addEventListener("fetch", (e) =>
  e.respondWith(
    (async () => {
      const req = e.request;
      const url = new URL(req.url);

      if (url.origin !== self.location.origin) return fetch(req);

      const cache = await caches.open(CACHE);

      // Offline fallback for document navigations
      if (req.mode === "navigate") {
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const off = await cache.match("./offline.html");
          if (off) return off;
        }
      }


      // NETWORK-FIRST pro JSONy (fresh, ale s offline fallbackem)
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

      // CACHE-FIRST pro ostatní
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
