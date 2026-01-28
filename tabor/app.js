import { bootCityApp } from "../shared/app-core.js";
bootCityApp().catch((e)=>{
  const app = document.getElementById('app');
  if (app) app.textContent = "Chyba startu: " + (e?.message || String(e));
});
