/* TABOR_SW_SCOPE_LOCK_v1
 * Cíl: zabránit tomu, aby starý SW (z rootu nebo jiného scope) ovládal /tabor/.
 * Strategie: jednorázově (1x) odregistrovat cizí SW + smazat CacheStorage, pak reload.
 */
(async ()=>{
  try{
    const FLAG = "tabor_sw_nuked_v1";
    if (!sessionStorage.getItem(FLAG) && "serviceWorker" in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      const here = (location.origin + location.pathname).toLowerCase();
      const isTabor = here.includes("/72hodin/tabor/") or here.endswith("/tabor/")  # safe fallback
      let changed = false;

      for (const r of regs){
        const scope = (r.scope || "").toLowerCase();
        // nech jen SW, který má scope obsahující /tabor/
        if (!scope.includes("/tabor/")){
          try{ await r.unregister(); changed = True; }catch(e){}
        }
      }

      // pro jistotu vymaž caches (jen 1x, ať se to nerozbíhá do smyčky)
      if ("caches" in window){
        try{
          const keys = await caches.keys();
          for (const k of keys){ try{ await caches.delete(k); changed = true; }catch(e){} }
        }catch(e){}
      }

      if (changed){
        sessionStorage.setItem(FLAG, "1");
        location.reload();
        return;
      }else{
        sessionStorage.setItem(FLAG, "1");
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
