/* TABOR_SW_CACHE_FIX_v1
 * Cíl: změny v app-core/ui/data se musí projevit hned (nečekat na starou cache).
 * Strategie:
 *  - bump CACHE_NAME
 *  - activate: smaž všechny staré caches
 *  - fetch:
 *      * network-first pro kritické soubory (app-core.js, ui.css, city.json, data)
 *      * cache-first pro ostatní statické assety
 */

const CACHE_NAME = "tabor-v3-cache-2026-01-31-180516";
const CORE_URLS = [
  "./",
  "./index.html",
  "./app.v2.js",
  "./city.json",
  "../shared/ui.css",
  "../shared/app-core.js",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_URLS);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // smaž staré cache
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isCritical(reqUrl){
  // network-first pro věci, které často měníme a nesmí "viset"
  return (
    reqUrl.includes("/shared/app-core.js") ||
    reqUrl.includes("/shared/ui.css") ||
    reqUrl.includes("/tabor/city.json") ||
    reqUrl.includes("/cities/tabor/knowledge_base.txt") ||
    reqUrl.includes("/cities/tabor/scenarios.json") ||
    reqUrl.includes("/tabor/app.v2.js") ||
    reqUrl.endsWith("/tabor/") ||
    reqUrl.endsWith("/tabor/index.html")
  );
}

self.addEventListener("fetch", (event) => {

  // NAVIGATION_NETWORK_FIRST_v1:
  // - nikdy nedržet starý HTML v cache-first (typicky způsobí "furt stejně" i po deploy)
  // - pro navigaci / dokumenty vždy zkus síť, teprve pak fallback cache/offline
  const req = event.request;
  const isNav = (req.mode === "navigate") || (req.destination === "document");
  if(isNav){
    event.respondWith((async ()=>{
      try{
        const fresh = await fetch(req, { cache: "no-store" });
        // opportunistic cache update
        try{
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        }catch(e){}
        return fresh;
      }catch(e){
        // fallback: cache -> offline
        try{
          const cached = await caches.match(req);
          if(cached) return cached;
        }catch(e2){}
        return caches.match("./offline.html") || Response.error();
      }
    })());
    return;
  }

    // (dedup) req already declared above for NAV block
const url = new URL(req.url);

  // jen GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isCritical(url.pathname)) {
      // NETWORK FIRST
      try{
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }catch(e){
        const cached = await cache.match(req);
        if (cached) return cached;
        // poslední záchrana: offline fallback na core index, jen pro navigace
        if (req.mode === "navigate") {
          const idx = await cache.match("./index.html");
          if (idx) return idx;
        }
        throw e;
      }
    } else {
      // CACHE FIRST
      const cached = await cache.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    }
  })());
});

