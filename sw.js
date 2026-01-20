const CACHE_NAME = "72h-cache-v20260121-01";
const ASSETS=["./", "./index.html", "./app.js", "./faq.json", "./synonyms.json", "./help.html", "./offline.html", "./manifest.webmanifest", "./sw.js", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install",(e)=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);self.skipWaiting();})()));
self.addEventListener("activate",(e)=>e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.map(k=>k===CACHE?null:caches.delete(k)));self.clients.claim();})()));
self.addEventListener("fetch",(e)=>e.respondWith((async()=>{const hit=await caches.match(e.request);if(hit) return hit;try{const fresh=await fetch(e.request);const c=await caches.open(CACHE);c.put(e.request,fresh.clone());return fresh;}catch{return hit||new Response("Offline",{status:503});}})()));
