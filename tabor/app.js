/* SW_REGISTER_TBOR_v1 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

import { bootCityApp } from "../shared/app-core.js";
bootCityApp().catch((e)=>{
  const app = document.getElementById('app');
  if (app) app.textContent = "Chyba startu: " + (e?.message || String(e));
});
