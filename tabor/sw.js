const CACHE = "72h-tabor-v2-20260128_164201";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./city.json",
    "../shared/ui.css",
  "../shared/app-core.js",
  "../assets/cities/tabor/logo.svg",
  "../cities/tabor/scenarios.json",
  "../cities/tabor/knowledge_base.txt"
];

self.addEventListener("install", (e) =>
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* SW_FAILSOFT_v1 */
        try {
          await c.addAll(ASSETS);
        } catch (e) {
          // If any single asset 404s (CDN propagation), do best-effort caching so SW still installs.
          for (const a of ASSETS) {
            try { await c.add(a); } catch (_) {}
          }
        }
        // cache offline.html best-effort (do NOT make install fail)
        try { await c.add("./offline.html"); } catch (_) {}

    self.skipWaiting();
  })())
);

self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.map(k => (k === CACHE ? null : caches.delete(k))));
    self.clients.claim();
  })())
);

function isNetworkFirst(pathname){
  return pathname.endsWith(".json") || pathname.endsWith(".txt");
}

self.addEventListener("fetch", (e) =>
  e.respondWith((async () => {
    const req = e.request;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return fetch(req);

    const cache = await caches.open(CACHE);

    if (req.mode === "navigate") {
      const hit = await cache.match("./index.html");
      if (hit) return hit;
      const off = await cache.match("./offline.html");
      return off || fetch(req);
    }

    if (isNetworkFirst(url.pathname)) {
      try{
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone());
        return fresh;
      }catch{
        const hit = await cache.match(req);
        return hit || new Response("Offline", { status: 503 });
      }
    }

    const hit = await cache.match(req);
    if (hit) return hit;

    try{
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    }catch{
      return new Response("Offline", { status: 503 });
    }
  })())
);
