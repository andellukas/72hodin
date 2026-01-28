/**
 * sw.killswitch.js — legacy SW cleanup helper
 * Goal: unregister any old sw.js and migrate clients to sw.pwa3.js
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      // unregister THIS killswitch (we don't want it to stay either)
      try { await self.registration.unregister(); } catch(_) {}

      // notify windows to register sw.pwa3.js and reload
      try {
        const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of cs) {
          try { c.postMessage({ type: "SW_MIGRATE_TO", url: "./sw.pwa3.js" }); } catch(_) {}
        }
      } catch(_) {}

      try { await self.clients.claim(); } catch(_) {}
    })()
  )
);

// passthrough
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
