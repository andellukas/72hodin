/**
 * sw.js (legacy) — KILL SWITCH
 * Purpose: prevent old/broken SW from staying installed.
 * Strategy: unregister itself and tell clients to register sw.pwa3.js
 */
self.addEventListener("install", (e) => self.skipWaiting());

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      try { await self.registration.unregister(); } catch(_) {}
      try {
        const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of cs) {
          // ask page to register sw.pwa3.js and reload
          try { c.postMessage({ type: "SW_MIGRATE_TO", url: "./sw.pwa3.js" }); } catch(_) {}
        }
      } catch(_) {}
      try { await self.clients.claim(); } catch(_) {}
    })()
  )
);

// If any fetch hits this SW, just passthrough network.
// (We want it gone.)
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
