const CACHE = "tabor-v2-20260127_120427";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./offline.html",
  "./manifest.webmanifest",
  "../cities/tabor/city.json",
  "../cities/tabor/contacts.json"
];

self.addEventListener("install", (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(ASSETS);
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
