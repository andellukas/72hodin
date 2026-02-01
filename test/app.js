import { parseKB, search } from "./shared/search-core.js";

function $(sel){ return document.querySelector(sel); }

const els = {
  q: $("#q"),
  go: $("#go"),
  status: $("#status"),
  overlay: $("#overlay"),
  results: $("#results"),
  ovTitle: $("#ovTitle"),
  ovClose: $("#ovClose"),
  cityLogo: $("#cityLogo"),
  cityTitle: $("#cityTitle"),
  citySubtitle: $("#citySubtitle"),
  installBtn: $("#installBtn"),
};

function setStatus(s){ if(els.status) els.status.textContent = s; }

function openOverlay(title, cards){
  els.ovTitle.textContent = title;
  els.results.innerHTML = cards.map(c => `
    <div class="card">
      <h3>${c._highlightTitle || escapeHtml(c.title)}</h3>
      <p>${c._highlightPreview || escapeHtml(c.preview)}</p>
      ${c.tags && c.tags.length ? `<div class="meta">${escapeHtml(c.tags.join(" • "))}</div>` : ""}
      <div class="meta">Skóre: ${c.score}</div>
      <div style="margin-top:8px">
        <button class="btn" data-open="1">Otevřít</button>
      </div>
      <div class="meta" style="display:none" data-full="1">${escapeHtml(c.body)}</div>
    </div>
  `).join("");

  // open full
  els.results.querySelectorAll(".card").forEach(card => {
    const btn = card.querySelector('button[data-open="1"]');
    const full = card.querySelector('div[data-full="1"]');
    const p = card.querySelector("p");
    if(btn && full && p){
      btn.addEventListener("click", ()=>{
        p.textContent = full.textContent || "";
        btn.style.display = "none";
      });
    }
  });

  els.overlay.setAttribute("aria-hidden", "false");
}

function closeOverlay(){
  els.overlay.setAttribute("aria-hidden", "true");
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function fetchText(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.text();
}

async function fetchJson(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.json();
}

let KB_ITEMS = [];

async function boot(){
  try{
    setStatus("Načítám city.json…");
    const city = await fetchJson("./city.json");
    if(els.cityTitle) els.cityTitle.textContent = city.city || "72 hodin";
    if(els.citySubtitle) els.citySubtitle.textContent = city.subtitle || "Offline krizový vyhledávač";
    if(els.cityLogo && city.logo) els.cityLogo.src = city.logo;

    setStatus("Načítám knowledge_base.txt…");
    const txt = await fetchText(city.knowledge_base || "./data/knowledge_base.txt");
    KB_ITEMS = parseKB(txt);

    const bytes = (txt || "").length;
    setStatus(`Připraveno. KB_BYTES=${bytes} ITEMS=${KB_ITEMS.length}`);
    if(KB_ITEMS.length === 0){
      setStatus("Načteno, ale 0 položek. Vlož obsah do ./data/knowledge_base.txt");
    }
  }catch(e){
    setStatus(`Chyba: ${(e && (e.message || String(e))) || "boot failed"}`);
    console.error(e);
  }
}

function runSearch(){
  const q = (els.q.value || "").trim();
  if(!q){
    openOverlay("Tipy", [{
      title:"Zadej dotaz",
      preview:"Příklady: blackout, voda, zima, evakuace, úraz, konflikt, děti, léky.",
      body:"Příklady: blackout, voda, zima, evakuace, úraz, konflikt, děti, léky.",
      tags:["nápověda"],
      score: 1,
      _highlightTitle: "Zadej dotaz",
      _highlightPreview: "Příklady: blackout, voda, zima, evakuace, úraz, konflikt, děti, léky."
    }]);
    return;
  }
  const { results } = search(KB_ITEMS, q);
  if(results.length === 0){
    openOverlay(`Nic nenalezeno: "${q}"`, [{
      title:"Bez výsledku",
      preview:"Zkus jiné slovo nebo kratší dotaz.",
      body:"Zkus jiné slovo nebo kratší dotaz.",
      tags:["nápověda"],
      score: 1,
      _highlightTitle: "Bez výsledku",
      _highlightPreview: "Zkus jiné slovo nebo kratší dotaz."
    }]);
    return;
  }
  openOverlay(`Výsledky: "${q}"`, results);
}

function setupUI(){
  if(els.go) els.go.addEventListener("click", runSearch);
  if(els.q) els.q.addEventListener("keydown", (e)=>{ if(e.key==="Enter") runSearch(); });

  if(els.ovClose) els.ovClose.addEventListener("click", closeOverlay);
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeOverlay(); });

  // install prompt (PWA)
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    if(els.installBtn) els.installBtn.style.display = "inline-flex";
  });
  if(els.installBtn){
    els.installBtn.addEventListener("click", async ()=>{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      try{ await deferredPrompt.userChoice; }catch(_){}
      deferredPrompt = null;
      els.installBtn.style.display = "none";
    });
  }
}

async function setupSW(){
  if(!("serviceWorker" in navigator)) return;
  try{
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  }catch(e){
    console.warn("SW register failed", e);
  }
}

setupUI();
setupSW();
boot();
