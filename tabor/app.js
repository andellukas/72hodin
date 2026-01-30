/* TABOR_BOOT_DIAG_v1 */
/* SW_REGISTER_CITY_v1 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

import { bootCityApp } from "../shared/app-core.js?v=20260130b";

bootCityApp().catch((e)=>{
  const s = document.getElementById("status");
  const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);
  if (s) s.textContent = "Chyba startu: " + msg;
  console.error("TABOR_BOOT_ERROR", e);
});
