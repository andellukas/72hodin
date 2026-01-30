const CACHE = "72h-v2-workspace-20260130_135015";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./offline.html",
  "./data/knowledge_base.json"
];

self.addEventListener("install", (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  /* SW_V2_FAILSOFT */
      try{ await c.addAll(ASSETS); }
      catch(e){ for(const a of ASSETS){ try{ await c.add(a); }catch(_){ } } }
  self.skipWaiting();
})()));

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith("tabor-v2-") && k !== CACHE).map(k => caches.delete(k)));
  self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      return res;
    } catch {
      return caches.match("./offline.html");
    }
  })());
});


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

    const hit = await cache.match(req);
    if (hit) return hit;

    try {
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const off = await cache.match("./offline.html");
      return off || new Response("Offline", { status: 503 });
    }
  })())
);
