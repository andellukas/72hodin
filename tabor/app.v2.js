
// cache-bust propagation: carry ?v... from app.v2.js into shared/app-core.js
const __APP_V2_QS__ = (new URL(import.meta.url).search || "");
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



function __mark(step){
  try{ setStatus(step + " " + __APP_V2_QS__); }catch(e){}
}
async function hardResetCachesAndSW(){
  try{
    setStatus("RESET: mažu cache + odregistruju SW…");
    if("serviceWorker" in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      for(const r of regs){ try{ await r.unregister(); }catch(e){} }
    }
    if("caches" in window){
      const keys = await caches.keys();
      for(const k of keys){ try{ await caches.delete(k); }catch(e){} }
    }
    const u = new URL(location.href);
    u.searchParams.set("v", String(Date.now()));
    location.replace(u.toString());
  }catch(e){
    setStatus("RESET selhal: " + (e?.message || String(e)));
  }
}

function hardReload(){
  const u = new URL(location.href);
  u.searchParams.set("v", String(Date.now()));
  location.replace(u.toString());
}

function wireButtons(){
  if(r) r.addEventListener("click", (e)=>{ e.preventDefault(); hardResetCachesAndSW(); });
  if(h) h.addEventListener("click", (e)=>{ e.preventDefault(); hardReload(); });
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
  navigator.serviceWorker.register("./sw.js" + __APP_V2_QS__, { scope: "./" }).catch(()=>{});
}

(async ()=>{
  wireButtons();
  __mark("M1 app.v2 start");

  // dynamický import, aby při failu šel vypsat status
  let mod;
  try{
    __mark("M2 before import app-core");
    mod = await import("../shared/app-core.js" + __APP_V2_QS__);
    __mark("M3 after import app-core");
  }catch(e){
    setStatus("Chyba startu: nelze načíst app-core.js — " + (e?.message || String(e)));
    return;
  }

  if (!mod || typeof mod.bootCityApp !== "function"){
    setStatus("Chyba startu: app-core.js nemá bootCityApp()");
    return;
  }

  try{
    __mark("M4a app.v2 says nacitam data");

  setTimeout(()=>{
    const el = document.getElementById("status");
    const cur = (el && el.textContent) ? el.textContent.trim() : "";
    if(cur === "Načítám data…" || cur === "Startuji…"){
      setStatus("Visí načítání. Klikni RESET CACHE. (SW/cache stav)");
    }
  }, 15000);

    __mark("M4 before bootCityApp");
    await mod.bootCityApp();
    __mark("M5 bootCityApp resolved");
  }catch(e){
    setStatus("Chyba startu: " + (e?.message || String(e)));
  }
})();
