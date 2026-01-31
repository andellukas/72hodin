/* TABOR_SW_SCOPE_LOCK_v2
 * Cíl: /tabor/ nesmí ovládat cizí Service Worker.
 * Strategie: 1× v session odregistrovat SW mimo /tabor/ + smazat caches, pak reload.
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

/* SW_REGISTER_CITY_v1 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

import { bootCityApp } from "../shared/app-core.js";

bootCityApp().catch((e)=>{
  const s = document.getElementById('status');
  if (s) s.textContent = "Chyba startu: " + (e?.message || String(e));
});
