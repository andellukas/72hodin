
// cache-bust propagation: carry ?v... from app.v2.js into shared/app-core.js
const __APP_V2_QS__ = (typeof import !== "undefined" && import.meta && import.meta.url)
  ? (new URL(import.meta.url).search || "")
  : "";
/* TABOR_BOOT_DIAG_v2
 * Cíl: aby se chyba VŽDY ukázala ve statusu (i když selže import).
 * Pozn.: žádné eval/new Function/setTimeout("string") -> CSP safe.
 */

/* TABOR_SW_SCOPE_LOCK_v2
 * Cíl: /tabor/ nesmí ovládat cizí SW. 1× per session odregistruj SW mimo /tabor/ + clear caches, pak reload.
 */
(async ()=>{
  try{
    const FLAG = "tabor_sw_nuked_v2";
    if (!sessionStorage.getItem(FLAG) && ("serviceWorker" in navigator)){
      const regs = await navigator.serviceWorker.getRegistrations();
      let changed = false;

      for (const r of regs){
        const scope = String(r.scope || "").toLowerCase();
        if (!scope.includes("/tabor/")){
          try{ await r.unregister(); changed = true; }catch(e){}
        }
      }

      if ("caches" in window){
        try{
          const keys = await caches.keys();
          for (const k of keys){
            try{ await caches.delete(k); changed = true; }catch(e){}
          }
        }catch(e){}
      }

      sessionStorage.setItem(FLAG, "1");
      if (changed){
        location.reload();
        return;
      }
    }
  }catch(e){}
})();

// --- boot diag helpers ---
function setStatus(msg){
  const s = document.getElementById("status");
  if (s) s.textContent = msg;
}

window.addEventListener("error", (ev)=>{
  try{
    const msg = ev?.message || "Neznámá chyba";
    const src = ev?.filename ? ` @ ${ev.filename}:${ev.lineno||0}` : "";
    setStatus("Chyba startu (error): " + msg + src);
  }catch(_){}
});

window.addEventListener("unhandledrejection", (ev)=>{
  try{
    const r = ev?.reason;
    const msg = (r && (r.message || String(r))) || "Unhandled rejection";
    setStatus("Chyba startu (promise): " + msg);
  }catch(_){}
});

/* SW_REGISTER_CITY_v1 */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(()=>{});
}

(async ()=>{
  setStatus("Startuji…");

  // dynamický import, aby při failu šel vypsat status
  let mod;
  try{
    mod = await import("../shared/app-core.js" + __APP_V2_QS__);
  }catch(e){
    setStatus("Chyba startu: nelze načíst app-core.js — " + (e?.message || String(e)));
    return;
  }

  if (!mod || typeof mod.bootCityApp !== "function"){
    setStatus("Chyba startu: app-core.js nemá bootCityApp()");
    return;
  }

  try{
    setStatus("Načítám data…");
    await mod.bootCityApp();
  }catch(e){
    setStatus("Chyba startu: " + (e?.message || String(e)));
  }
})();
