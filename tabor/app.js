/* SW_REGISTER_CITY_v1 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

import { bootCityApp } from "../shared/app-core.js";

bootCityApp().catch((e)=>{
  const s = document.getElementById('status');
  if (s) s.textContent = "Chyba startu: " + (e?.message || String(e));
});
