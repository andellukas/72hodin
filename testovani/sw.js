/* sw.js (v3 /test) */
const CACHE_VERSION = "test-v3-1";
const CACHE_NAME = `72h-${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./sw.js",
  "./city.json",
  "./manifest.webmanifest",
  "./shared/ui.css",
  "./shared/search-core.js",
  "./data/knowledge_base.txt",
];

self.addEventListener("install", (event)=>{
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event)=>{
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

function isNav(req){
  return req.mode === "navigate" || req.destination === "document";
}

function isNetworkFirst(path){
  return (
    path.endsWith("/test/") ||
    path.endsWith("/test/index.html") ||
    path.endsWith("/test/city.json") ||
    path.endsWith("/test/data/knowledge_base.txt") ||
    path.endsWith("/test/app.js") ||
    path.endsWith("/test/shared/search-core.js")
  );
}

self.addEventListener("fetch", (event)=>{
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);

    // Navigace: network-first, aby se nelepilo staré HTML
    if(isNav(req)){
      try{
        const fresh = await fetch(req, { cache: "no-store" });
        if(fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }catch(_){
        const cached = await cache.match(req);
        if(cached) return cached;
        return cache.match("./index.html") || Response.error();
      }
    }

    // Kritické soubory: network-first
    if(isNetworkFirst(url.pathname)){
      try{
        const fresh = await fetch(req, { cache: "no-store" });
        if(fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }catch(_){
        const cached = await cache.match(req);
        if(cached) return cached;
        return Response.error();
      }
    }

    // Ostatní: cache-first (např. assets/logo.jpg)
    const cached = await cache.match(req);
    if(cached) return cached;
    const fresh = await fetch(req);
    if(fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  })());
});
