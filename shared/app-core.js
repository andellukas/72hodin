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


/* AUTOCOMPLETE_TAHOR_v1
 * - offline našeptávač + rychlé dotazy (chips)
 * - bez knihoven, čisté DOM
 */

function norm(s){
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function uniq(arr){
  const out = [];
  const seen = new Set();
  for(const x of arr){
    const k = norm(x).trim();
    if(!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(x).trim());
  }
  return out;
}

function buildSuggestList(items){
  // pevné krizové fráze (prioritní, “městský krizový manuál”)
  const core = [
    "blackout",
    "voda neteče",
    "plyn",
    "požár",
    "zima",
    "úraz",
    "krvácení",
    "evakuace",
    "chemický zápach",
    "povodeň",
    "bouřka",
    "silný vítr",
    "výpadek signálu",
    "léky",
    "děti",
    "senioři",
  ];

  const titles = (items || []).map(it => it?.title).filter(Boolean);
  // bereme jen relativně krátké titulky, aby návrhy nebyly romány
  const compactTitles = titles.filter(t => String(t).length <= 90);

  return uniq([...core, ...compactTitles]);
}

function scoreSuggest(q, cand){
  // jednoduché, deterministické: startsWith > includes
  const nq = norm(q);
  const nc = norm(cand);
  if(!nq || nq.length < 2) return -1;
  let s = 0;
  if(nc.startsWith(nq)) s += 20;
  if(nc.includes(nq)) s += 8;
  // bonus pokud je to “krizové slovo” (krátké)
  if(String(cand).length <= 18) s += 2;
  return s;
}

function ensureSuggestUI(qInput){
  const wrap = qInput?.closest?.(".search");
  if(!wrap) return null;

  // chips row
  let chips = wrap.querySelector(".chips");
  if(!chips){
    chips = document.createElement("div");
    chips.className = "chips";
    wrap.appendChild(chips);
  }

  // suggest dropdown
  let box = wrap.querySelector(".suggestBox");
  if(!box){
    box = document.createElement("div");
    box.className = "suggestBox";
    box.setAttribute("aria-hidden","true");
    wrap.appendChild(box);
  }

  return { wrap, chips, box };
}

function renderChips(chipsEl, onPick){
  const chips = [
    "blackout",
    "voda neteče",
    "plyn",
    "zima",
    "úraz",
    "evakuace",
  ];
  chipsEl.innerHTML = chips.map(t => `<button type="button" class="chip">${escapeHtml(t)}</button>`).join("");
  chipsEl.querySelectorAll(".chip").forEach((btn)=>{
    btn.addEventListener("click", ()=> onPick(btn.textContent || ""));
  });
}

function showSuggestBox(box, list, activeIdx){
  if(!box) return;
  if(!list || list.length === 0){
    box.innerHTML = "";
    box.classList.remove("on");
    box.setAttribute("aria-hidden","true");
    return;
  }
  box.innerHTML = list.map((t, i)=>(
    `<div class="sItem ${i===activeIdx ? "on":""}" data-i="${i}">${escapeHtml(t)}</div>`
  )).join("");
  box.classList.add("on");
  box.setAttribute("aria-hidden","false");
}

function hideSuggestBox(box){
  if(!box) return;
  box.classList.remove("on");
  box.setAttribute("aria-hidden","true");
  box.innerHTML = "";
}

function tokenize(q){
  return q.toLowerCase().trim().split(/\s+/).filter(Boolean);
}
function scoreItem(tokens, title, body){
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let s = 0;
  for(const tok of tokens){
    if(!tok) continue;
    if(t.includes(tok)) s += 8;
    if(b.includes(tok)) s += 2;
    if(t.startsWith(tok)) s += 3;
  }
  // malý bonus za krátký titulek (čitelnost)
  if(title.length <= 60) s += 1;
  return s;
}

function parseKB(txt){
  // Očekáváme bloky oddělené prázdným řádkem:
  // první řádek = otázka / nadpis, zbytek = odpověď
  const blocks = txt.split(/\n\s*\n+/g).map(b => b.trim()).filter(Boolean);
  const items = [];
  for(const b of blocks){
    const lines = b.split("\n");
    const head = (lines[0] || "").trim().replace(/^\?\s*/,"").trim();
    const body = lines.slice(1).join("\n").trim();
    if(head && body) items.push({ type:"kb", title: head, body });
  }
  return items;
}

function parseScenarios(json){
  // podporujeme více možných tvarů (fail-soft)
  // 1) { scenarios:[{title,text|body|steps...}] }
  // 2) [{...}]
  const arr = Array.isArray(json) ? json : (Array.isArray(json?.scenarios) ? json.scenarios : []);
  const items = [];
  for(const s of arr){
    const title = (s.title || s.name || s.heading || "").toString().trim();
    const body =
      (s.text || s.body || s.content || "").toString().trim() ||
      (Array.isArray(s.steps) ? s.steps.join("\n") : "").trim();
    if(title && body) items.push({ type:"scenario", title, body });
  }
  return items;
}

function showOverlay(title, items){
  const ov = $("#overlay");
  const out = $("#results");
  const h = $("#ovTitle");
  if(!ov || !out || !h) return;

  h.textContent = title;
  out.innerHTML = items.map(it => {
    const badge = it.type === "kb" ? "Znalosti" : "Scénář";
    return `
      <div class="item">
        <div><span class="badge">${escapeHtml(badge)}</span></div>
        <h3>${escapeHtml(it.title)}</h3>
        <pre>${escapeHtml(it.body)}</pre>
      </div>
    `;
  }).join("");

  ov.classList.add("on");
  ov.setAttribute("aria-hidden","false");
}

function hideOverlay(){
  const ov = $("#overlay");
  if(!ov) return;
  ov.classList.remove("on");
  ov.setAttribute("aria-hidden","true");
}

export async function bootCityApp(){
  const status = $("#status");
  const q = $("#q");
  const closeBtn = $("#ovClose");
  const offBtn = $("#openOffline");
  const logoEl = $("#cityLogo");
  const titleEl = $("#cityTitle");

  // SW register je v city app.js (kvůli scope ./)
  // tady jen UI + data

  if(closeBtn) closeBtn.addEventListener("click", hideOverlay);
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") hideOverlay(); });

  // Load city.json relative to /<city>/
  const cityJson = await fetchJson("./city.json");

  if(titleEl && cityJson?.name) titleEl.textContent = `72 hodin – ${cityJson.name}`;
  if(logoEl && cityJson?.logo) logoEl.src = cityJson.logo;

  if(offBtn){
    offBtn.addEventListener("click", async ()=>{
      // otevře offline.html v overlay (jako “rychlá nápověda”)
      try{
        const html = await fetchText("./offline.html");
        showOverlay("Offline", [{type:"kb", title:"Offline režim", body: html.replace(/<\/?[^>]+>/g," ").replace(/\s+/g," ").trim()}]);
      }catch(e){
        showOverlay("Offline", [{type:"kb", title:"Offline", body:"Offline stránka není dostupná."}]);
      }
    });
  }

  if(status) status.textContent = "Načítám znalosti…";

  // Fetch v1 data (paths come from city.json)
  const kbUrl = cityJson?.knowledge_base;
  const scUrl = cityJson?.scenarios;
  if(!kbUrl || !scUrl) throw new Error("city.json: chybí knowledge_base nebo scenarios");

  const [kbTxt, scJson] = await Promise.all([
    fetchText(kbUrl),
    fetchJson(scUrl),
  ]);

  const items = [
    ...parseKB(kbTxt),
    ...parseScenarios(scJson),
  ];

  if(status) status.textContent = `Připraveno. Záznamů: ${items.length}.`;

  function runSearch(query){
    const tokens = tokenize(query);
    if(tokens.length === 0){
      showOverlay("Tipy", [{
        type:"kb",
        title:"Zadej dotaz",
        body:"Příklady: blackout, voda, zima, evakuace, úraz, oheň, plyn, povodeň."
      }]);
      return;
    }
    const scored = items
      .map(it => ({ it, s: scoreItem(tokens, it.title, it.body) }))
      .filter(x => x.s > 0)
      .sort((a,b)=> b.s - a.s)
      .slice(0, 30)
      .map(x => x.it);

    if(scored.length === 0){
      showOverlay(`Nic nenalezeno: "${query}"`, [{
        type:"kb",
        title:"Bez výsledku",
        body:"Zkus jiné slovo nebo kratší dotaz."
      }]);
      return;
    }
    showOverlay(`Výsledky: "${query}"`, scored);
  }

  if(q){
    q.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        runSearch(q.value || "");
      }
else{
          runSearch(q.value || "");
        }
      }
    });


  }
}
