/**
 * shared/app-core.js — Offline "Google-like" search (v1 data)
 * - searches knowledge_base.txt + scenarios.json
 * - simple scoring (title/body token match)
 * - fullscreen results
 * - portable via /<city>/city.json
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
    if(q && a){
      items.push({ type:"kb", title:q.replace(/^\?\s*/,"").trim(), body:a });
    }
  }
  // fallback if KB doesn't follow block format
  if(items.length === 0 && txt.trim()){
    items.push({ type:"kb", title:"Znalostní báze", body:txt.trim() });
  }
  return items;
}

function normalize(s){ return String(s).toLowerCase(); }

function score(title, body, q){
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  if(tokens.length === 0) return 0;
  const t = normalize(title);
  const b = normalize(body);
  let s = 0;
  for(const tok of tokens){
    if(t.includes(tok)) s += 3;
    if(b.includes(tok)) s += 1;
  }
  if(t.includes(normalize(q))) s += 5;
  if(b.includes(normalize(q))) s += 2;
  return s;
}

function highlight(text, q){
  const tokens = q.split(/\s+/).filter(Boolean).slice(0,8);
  let out = escapeHtml(text);
  for(const tok of tokens){
    const safe = tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp(`(${safe})`, "ig");
    out = out.replace(re, `<mark>$1</mark>`);
  }
  return out;
}

function openFS(title, bodyHtml){
  $("#fsTitle").textContent = title;
  $("#fsBody").innerHTML = bodyHtml;
  $("#fs").classList.add("on");
  $("#fs").setAttribute("aria-hidden","false");
}
function closeFS(){
  $("#fs").classList.remove("on");
  $("#fs").setAttribute("aria-hidden","true");
}

export async function bootCityApp(){
  const root = document.getElementById("app");
  if(!root) throw new Error("Missing #app");

  const base = new URL(".", location.href).toString();
  const city = JSON.parse(await fetchText(toAbs(base,"./city.json")));

  const cityName = city?.name || "Město";
  const logoPath = city?.logo || "../assets/cities/tabor/logo.svg";

  root.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <div class="logo"><img alt="Logo" src="${escapeHtml(logoPath)}"></div>
        <h1 class="title">72 hodin – ${escapeHtml(cityName)}</h1>
        <p class="sub">Offline vyhledávač krizových postupů</p>
      </div>

      <div class="search">
        <input id="q" class="input" placeholder="Napiš, co potřebuješ…" autocomplete="off" />
        <button id="go" class="btn">Hledat</button>
      </div>

      <div class="quick">
        <button class="qbtn danger" data-q="blackout">BLACKOUT</button>
        <button class="qbtn" data-q="evakuace">EVAKUACE</button>
        <button class="qbtn" data-q="první pomoc">PRVNÍ POMOC</button>
      </div>
    </div>

    <div id="fs" class="fullscreen" aria-hidden="true">
      <div class="fsWrap">
        <div class="fsTop">
          <div class="fsTitle" id="fsTitle">Výsledky</div>
          <button class="fsClose" id="close">Zavřít</button>
        </div>
        <div class="fsBody" id="fsBody"></div>
      </div>
    </div>
  `;

  // Load v1 data
  let corpus = [];

  const kbUrl = toAbs(base, city.knowledge_base);
  const kbTxt = await fetchText(kbUrl);
  corpus = corpus.concat(parseKB(kbTxt));

  const scUrl = toAbs(base, city.scenarios);
  const sc = await fetchJson(scUrl);

  const arr =
    Array.isArray(sc) ? sc :
    (Array.isArray(sc.scenarios) ? sc.scenarios : []);

  for(const it of arr){
    const title = String(it.title || it.name || it.id || "Scénář").trim();
    const body =
      String(it.text || it.body || it.description || "").trim() ||
      (Array.isArray(it.steps) ? it.steps.join("\n") : "") ||
      (Array.isArray(it.now) ? ("NOW:\n"+it.now.join("\n")) : "") ||
      (Array.isArray(it.do) ? ("DO:\n"+it.do.join("\n")) : "");
    if(title && body) corpus.push({ type:"scenario", title, body });
  }

  const runSearch = () => {
    const q = ($("#q").value || "").trim();
    if(!q){
      openFS("Napiš dotaz", `<div class="hit"><div class="a">Zkus: blackout, voda, zima, úraz, evakuace…</div></div>`);
      return;
    }

    const ranked = corpus
      .map(it => ({ it, s: score(it.title, it.body, q) }))
      .filter(x => x.s > 0)
      .sort((a,b)=> b.s - a.s)
      .slice(0, 50);

    if(!ranked.length){
      openFS(`Nenalezeno: ${q}`, `<div class="hit"><div class="a">Zkus kratší slovo nebo jiné synonymum.</div></div>`);
      return;
    }

    const html = ranked.map(x => `
      <div class="hit">
        <div class="q">${escapeHtml(x.it.type === "scenario" ? "Scénář" : "Znalostní báze")} • ${highlight(x.it.title, q)}</div>
        <div class="a">${highlight(x.it.body, q).replace(/\n/g,"<br>")}</div>
      </div>
    `).join("");

    openFS(`Výsledky: ${q}`, html);
  };

  $("#go").addEventListener("click", runSearch);
  $("#q").addEventListener("keydown", (e)=>{ if(e.key==="Enter") runSearch(); });

  document.querySelectorAll("[data-q]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $("#q").value = btn.getAttribute("data-q") || "";
      runSearch();
    });
  });

  $("#close").addEventListener("click", closeFS);
  $("#fs").addEventListener("click", (e)=>{ if(e.target && e.target.id==="fs") closeFS(); });
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeFS(); });
}
