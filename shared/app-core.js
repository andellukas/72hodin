/**
 * shared/app-core.js — Offline "Google-like" search (v1 data)
 * - searches in knowledge_base.txt + scenarios.json
 * - simple substring search, sorted by relevance
 * - fullscreen results
 */

function $(sel){ return document.querySelector(sel); }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toAbs(base, rel){
  return new URL(rel, base).toString();
}

async function fetchText(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.text();
}
async function fetchJson(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.json();
}

function parseKB(txt){
  // blocks separated by blank lines
  const blocks = txt.split(/\n\s*\n+/g).map(b => b.trim()).filter(Boolean);
  const items = [];
  for(const b of blocks){
    const lines = b.split("\n");
    const q = (lines[0] || "").trim();
    const a = lines.slice(1).join("\n").trim();
    if(q && a) items.push({ type:"kb", title:q.replace(/^\?\s*/,"").trim(), body:a });
  }
  if(items.length === 0 && txt.trim()){
    items.push({ type:"kb", title:"Znalostní báze", body:txt.trim() });
  }
  return items;
}

function normalize(s){
  return String(s).toLowerCase();
}

function score(hayTitle, hayBody, q){
  // simple deterministic relevance:
  // +3 for each token in title, +1 for each token in body
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  if(tokens.length === 0) return 0;
  const t = normalize(hayTitle);
  const b = normalize(hayBody);
  let s = 0;
  for(const tok of tokens){
    if(t.includes(tok)) s += 3;
    if(b.includes(tok)) s += 1;
  }
  // small bonus for exact substring match of full query
  if(t.includes(normalize(q))) s += 5;
  if(b.includes(normalize(q))) s += 2;
  return s;
}

function highlight(htmlText, q){
  const tokens = q.split(/\s+/).filter(Boolean).slice(0,8);
  let out = escapeHtml(htmlText);
  for(const tok of tokens){
    const safe = tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp(`(${safe})`, "ig");
    out = out.replace(re, `<mark style="background:rgba(45,212,191,.18);color:inherit;border-radius:6px;padding:0 3px">$1</mark>`);
  }
  return out;
}

function render(root, cityName){
  root.innerHTML = `
  <div class="wrap">
    <div class="topbar">
      <div class="brand">
        <div class="t">72 hodin – ${escapeHtml(cityName)}</div>
        <div class="s">Offline vyhledávač (scénáře + znalostní báze)</div>
      </div>
      <div class="kbd">Enter = hledat • Esc = zavřít</div>
    </div>

    <div class="searchRow">
      <input id="q" class="input" placeholder="Napiš co potřebuješ… (např. blackout, voda, úraz, evakuace)" autocomplete="off" />
      <button id="go" class="btn">Hledat</button>
    </div>

    <div class="card">
      <div class="cardHd">
        <div class="h">Stav</div>
        <div class="small" id="state">Načítám data…</div>
      </div>
      <div class="cardBd small">
        Tip: používej krátká slova. Offline to bude fungovat po prvním načtení (instalace SW).
      </div>
    </div>
  </div>

  <div id="fs" class="fullscreen" aria-hidden="true">
    <div class="fsWrap">
      <div class="fsTop">
        <div class="fsTitle" id="fsTitle">Výsledky</div>
        <div style="display:flex; gap:10px; align-items:center">
          <span class="small" id="fsMeta"></span>
          <button id="close" class="btn secondary">Zavřít</button>
        </div>
      </div>
      <div class="fsBody" id="fsBody"></div>
    </div>
  </div>
  `;
}

function openFS(title, meta, bodyHtml){
  $("#fsTitle").textContent = title;
  $("#fsMeta").textContent = meta;
  $("#fsBody").innerHTML = bodyHtml;
  const fs = $("#fs");
  fs.classList.add("on");
  fs.setAttribute("aria-hidden","false");
}
function closeFS(){
  const fs = $("#fs");
  fs.classList.remove("on");
  fs.setAttribute("aria-hidden","true");
}

export async function bootCityApp(){
  const root = document.getElementById("app");
  if(!root) throw new Error("Missing #app");
  const base = new URL(".", location.href).toString();

  const city = JSON.parse(await fetchText(toAbs(base,"./city.json")));
  const cityName = city?.name || "Město";
  render(root, cityName);

  let corpus = [];
  let okParts = [];

  // KB
  try{
    const kbUrl = toAbs(base, city.knowledge_base);
    const kbTxt = await fetchText(kbUrl);
    corpus = corpus.concat(parseKB(kbTxt));
    okParts.push(`KB:${corpus.filter(x=>x.type==="kb").length}`);
  }catch(e){}

  // Scenarios
  try{
    const scUrl = toAbs(base, city.scenarios);
    const sc = await fetchJson(scUrl);

    // support common shapes:
    // - array of {title, text/steps/body/...}
    // - {scenarios:[...]}
    const arr = Array.isArray(sc) ? sc : (Array.isArray(sc.scenarios) ? sc.scenarios : []);
    const items = [];
    for(const it of arr){
      const title = String(it.title || it.name || it.id || "Scénář").trim();
      const body =
        String(it.text || it.body || it.description || "").trim() ||
        (Array.isArray(it.steps) ? it.steps.join("\n") : "") ||
        (Array.isArray(it.now) ? ("NOW:\n"+it.now.join("\n")) : "") ||
        (Array.isArray(it.do) ? ("DO:\n"+it.do.join("\n")) : "");
      if(title && body) items.push({ type:"scenario", title, body });
    }
    corpus = corpus.concat(items);
    okParts.push(`SC:${items.length}`);
  }catch(e){}

  $("#state").textContent = corpus.length ? `OK • ${okParts.join(" • ")} • celkem: ${corpus.length}` : "Chyba: data se nenačetla";

  const runSearch = () => {
    const q = ($("#q").value || "").trim();
    if(!q){
      openFS("Napiš dotaz", "", `<div class="hit"><div class="a">Zkus: <b>blackout</b>, <b>voda</b>, <b>evakuace</b>, <b>zima</b>, <b>úraz</b>.</div></div>`);
      return;
    }

    const ranked = corpus
      .map(it => ({ it, s: score(it.title, it.body, q) }))
      .filter(x => x.s > 0)
      .sort((a,b)=> b.s - a.s)
      .slice(0, 40);

    if(!ranked.length){
      openFS(`Nenalezeno: ${q}`, "0 výsledků", `<div class="hit"><div class="a">Zkus kratší dotaz nebo jiné slovo.</div></div>`);
      return;
    }

    const html = ranked.map(x => `
      <div class="hit">
        <div class="q">${escapeHtml(x.it.type === "scenario" ? "Scénář" : "Znalostní báze")} • ${highlight(x.it.title, q)}</div>
        <div class="a">${highlight(x.it.body, q).replace(/\n/g,"<br>")}</div>
      </div>
    `).join("");

    openFS(`Výsledky: ${q}`, `nalezeno: ${ranked.length}`, html);
  };

  $("#go").addEventListener("click", runSearch);
  $("#q").addEventListener("keydown", (e)=>{ if(e.key==="Enter") runSearch(); });

  $("#close").addEventListener("click", closeFS);
  $("#fs").addEventListener("click", (e)=>{ if(e.target && e.target.id==="fs") closeFS(); });
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeFS(); });
}
