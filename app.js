(function(){
  try{
    var r=document.getElementById('r');
    if(r) r.textContent='BOOT STAGE 1 — '+new Date().toISOString();
  }catch(_){}
})();


window.addEventListener('error', function(e){
  try{
    var r=document.getElementById('r');
    if(r) r.textContent='GLOBAL ERROR: '+(e.message||'unknown');
  }catch(_){}
});
window.addEventListener('unhandledrejection', function(e){
  try{
    var r=document.getElementById('r');
    var msg=(e.reason&&(e.reason.message||String(e.reason)))||'unknown';
    if(r) r.textContent='PROMISE ERROR: '+msg;
  }catch(_){}
});


// --- helpers: normalize section fields (string|array|null -> array) ---
function asList(v) {
  if (Array.isArray(v)) return v.map(x => String(x ?? '').trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    return s ? [s] : [];
  }
  return [];
}

/* 72h offline search – no libs, works offline
   Features:
   1) Autocomplete (top 5)
   2) Did you mean… (when score weak)
   3) Category-aware boosts
   4) Cache: precomputed token sets + trigrams once
*/

let DATA = [];
let IDX = [];
let SYN = {};
let SYN_REV = {};
let panicMode = true;

// Autocomplete state
let SUGS = [];
let SUG_ACTIVE = -1;

function escRe(s){return (s??"").toString().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

// Highlight query tokens in a text (safe, HTML-escaped around)
function highlightText(text, qTokens){
  const raw = (text??"").toString();
  if(!qTokens || !qTokens.length) return esc(raw);
  const toks = [...new Set(qTokens.map(t=>norm(t)).filter(t=>t && t.length>=3))].slice(0,10);
  if(!toks.length) return esc(raw);
  const reTok = new RegExp('(' + toks.map(escRe).sort((a,b)=>b.length-a.length).join('|') + ')','ig');
  const safe = esc(raw);
  // apply on escaped string; tokens are normalized ASCII, safe to match literally
  return safe.replace(reTok, '<mark style="background:#fff1a8;padding:0 2px;border-radius:4px">$1</mark>');
}


const PRESETS = [
  {label:"Blackout", q:"blackout elektrina vypadek proudu"},
  {label:"Siréna", q:"sirena vseobecna vystraha houka"},
  {label:"Voda", q:"netece voda bez vody"},
  {label:"Netopí", q:"netopi topeni teplarna zima"},
  {label:"Internet", q:"nejde internet wifi offline"},
  {label:"GSM", q:"gsm nejde signal hovory sms"},
  {label:"Peníze", q:"nejde platit karta bankomat hotovost"},
  {label:"Evakuace", q:"evakuace odejit pryc"},
    {label:"Kontakty", q:"__PANIKA_KONTAKTY__"},
  {label:"Válka", q:"valka utok bombardovani nato"},
];

const $q = document.getElementById("q");
const $r = document.getElementById("r");
const $grid = document.getElementById("panicGrid");
const $toggle = document.getElementById("toggle");
const $all = document.getElementById("all");
const $panicCard = document.getElementById("panicCard");
const $net = document.getElementById("net");
const $sug = document.getElementById("sug");
const $dym = document.getElementById("dym");

function esc(s){return (s??"").toString().replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));}
function list(items){ if(!items||!items.length) return "<ul><li>—</li></ul>"; return "<ul>"+items.slice(0,12).map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>";}
function listHL(items, qTokens){ if(!items||!items.length) return "<ul><li>—</li></ul>"; return "<ul>"+items.slice(0,12).map(x=>"<li>"+highlightText(x, qTokens)+"</li>").join("")+"</ul>";}
function tags(items){ if(!items||!items.length) return ""; return items.map(t=>`<span class="tag">${esc(t)}</span>`).join("");}

function setNet(){ $net.textContent = navigator.onLine ? "online" : "offline"; }

function updateCoverage(){
  try{
    const total = DATA.length;
    const withP = DATA.filter(x=>x.panic && x.panic.length).length;
    const el = document.getElementById('cov');
    if(el) el.textContent = `PANIKA: ${withP}/${total}`;
  }catch(e){}
}

window.addEventListener("online", setNet);
window.addEventListener("offline", setNet);
setNet();

/* ---------- NORMALIZATION (diacritics + junk) ---------- */
function norm(s){
  s=(s??"").toString().toLowerCase().trim();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  s = s.replace(/[^a-z0-9\s]+/g," ");
  s = s.replace(/\s+/g," ").trim();
  return s;
}

/* ---------- SYNONYMS ---------- */
function buildSynMaps(obj){
  SYN=obj||{};
  SYN_REV={};
  for(const can of Object.keys(SYN)){
    const c = norm(can);
    SYN_REV[c]=c;
    for(const v of SYN[can]){
      SYN_REV[norm(v)] = c;
    }
  }
}

// Replace multiword variants inside query and canonicalize tokens
function expandQuery(q){
  q = norm(q);
  const variants = Object.keys(SYN_REV).sort((a,b)=>b.length-a.length);
  for(const v of variants){
    if(v.length < 4) continue;
    if(q.includes(v)) q = q.split(v).join(SYN_REV[v]);
  }
  const toks = q.split(" ").filter(Boolean);
  const out=[];
  for(const t of toks){
    const can = SYN_REV[t] || t;
    out.push(can);
    if(can!==t) out.push(t);
  }
  return [...new Set(out)];
}

/* ---------- FUZZY CORE ---------- */
function trigrams(s){
  s = "  " + s + "  ";
  const set = new Set();
  for(let i=0;i<s.length-2;i++) set.add(s.slice(i,i+3));
  return set;
}
function jaccard(a,b){
  if(!a.size || !b.size) return 0;
  let inter=0;
  for(const x of a) if(b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// bounded edit distance <=2 (fast enough)
function editDistMax2(a,b){
  a=norm(a); b=norm(b);
  const la=a.length, lb=b.length;
  if(Math.abs(la-lb)>2) return 99;
  const prev = Array(lb+1);
  const cur  = Array(lb+1);
  for(let j=0;j<=lb;j++) prev[j]=j;
  for(let i=1;i<=la;i++){
    cur[0]=i;
    let rowMin=cur[0];
    for(let j=1;j<=lb;j++){
      const cost = a[i-1]===b[j-1] ? 0 : 1;
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
      if(cur[j] < rowMin) rowMin = cur[j];
    }
    if(rowMin>2) return 99;
    for(let j=0;j<=lb;j++) prev[j]=cur[j];
  }
  return prev[lb];
}

function buildIndex(items){
  IDX = items.map((it, i)=>{
    const blob = [
      it.category||"", it.q||"",
      (it.tags||[]).join(" "),
      (it.panic||[]).join(" "),
      (it.now||[]).join(" "),
      (it.next||[]).join(" "),
      (it.h72||[]).join(" "),
      (it.dont||[]).join(" "),
      (it.call||[]).join(" "),
      (it.if||[]).join(" "),
      (it.notes||[]).join(" ")
    ].join(" | ");
    const bn = norm(blob);
    const toks = new Set(bn.split(" ").filter(w=>w.length>=3));
    return {
      id: it.id ?? i,
      item: it,
      blobNorm: bn,
      blobTris: trigrams(bn.slice(0,9000)),
      tokensSet: toks,
      cat: norm(it.category||"")
    };
  });
}

/* Category-aware boost:
   If query contains a canonical keyword that matches a category,
   boost results in that category (small, but helpful). */
function catBoost(queryTokens, rec){
  // minimal mapping; can be extended
  const CAT_KEYS = {
    "elektrina":"elektrina",
    "voda":"voda",
    "internet":"internet",
    "signal":"info",
    "sirena":"sireny",
    "teplo":"domacnost",
    "jidlo":"zasobovani",
    "penize":"finance",
    "evakuace":"evakuace",
    "valka":"valka",
    "vojaci":"valka"
  };
  let b=0;
  for(const t of queryTokens){
    const key = CAT_KEYS[t];
    if(!key) continue;
    if(rec.cat.includes(key)) b += 12;
  }
  return b;
}

function scoreItem(qTokens, qNorm, qTris, rec){
  let s=0;

  // exact phrase
  if(qNorm && rec.blobNorm.includes(qNorm)) s += 120;

  // token match + typo match
  let hit=0;
  for(const t of qTokens){
    if(t.length<3) continue;

    if(rec.tokensSet.has(t)) { s += 18; hit++; continue; }

    if(t.length>=4){
      let best=99;
      let checked=0;
      for(const w of rec.tokensSet){
        if(Math.abs(w.length - t.length)>2) continue;
        if(w[0]!==t[0]) continue;
        const d = editDistMax2(t,w);
        if(d<best) best=d;
        checked++;
        if(best===0) break;
        if(checked>70) break;
      }
      if(best===1) s += 10;
      else if(best===2) s += 6;
    }
  }
  if(hit>=2) s+=10;
  if(hit>=3) s+=10;

  // trigram similarity
  s += Math.round(jaccard(qTris, rec.blobTris) * 60);

  // category boost
  s += catBoost(qTokens, rec);

  return s;
}

function search(q){
  const qn = norm(q);
  const qTokens = expandQuery(q);
  const qTris = trigrams(qTokens.join(" "));

  // empty query => show some results
  if(!qn){
    return IDX.map(rec=>({rec, score: 1})).slice(0, 80);
  }

  const scored = IDX.map(rec=>({rec, score: scoreItem(qTokens, qn, qTris, rec)}))
    .filter(x=>x.score >= 18);

  scored.sort((a,b)=>b.score-a.score);
  return scored;
}

/* ---------- AUTOCOMPLETE + DID YOU MEAN ---------- */
function topSuggestions(scored){
  // show top 5 question titles
  const seen=new Set();
  const out=[];
  for(const s of scored){
    const q = (s.rec.item.q||"").trim();
    if(!q) continue;
    const key = norm(q);
    if(seen.has(key)) continue;
    seen.add(key);
    out.push({q, score:s.score});
    if(out.length>=5) break;
  }
  return out;
}

function showSuggestions(sugs){
  SUGS = sugs || [];
  SUG_ACTIVE = -1;

  if(!SUGS.length){
    $sug.innerHTML = "";
    $sug.style.display = "none";
    return;
  }

  $sug.innerHTML = SUGS.map((x,i)=>`<button class="sugBtn" data-i="${i}" type="button">${esc(x.q)}</button>`).join("");
  $sug.style.display = "block";

  [...$sug.querySelectorAll("button")].forEach((b,i)=>{
    b.onclick=()=>{
      $q.value = SUGS[i].q;
      $sug.style.display="none";
      render();
      $q.focus();
    };
  });
}
  $sug.innerHTML = sugs.map(x=>`<button class="sugBtn" type="button">${esc(x.q)}</button>`).join("");
  $sug.style.display = "block";
  [...$sug.querySelectorAll("button")].forEach((b,i)=>{
    b.onclick=()=>{ $q.value = sugs[i].q; render(); $q.focus(); };
  });

// If the best score is low, propose a “did you mean” using nearest canonical tokens
function didYouMean(q){
  const qn = norm(q);
  if(!qn || qn.length<4) return null;

  const toks = qn.split(" ").filter(Boolean);
  // check each token against canonical synonym keys
  const canon = Object.keys(SYN_REV);
  let best = {from:null, to:null, d:99};

  for(const t of toks){
    if(t.length<4) continue;
    for(const c of canon){
      if(Math.abs(c.length - t.length)>2) continue;
      if(c[0]!==t[0]) continue;
      const d = editDistMax2(t,c);
      if(d<best.d){
        best={from:t, to:c, d};
        if(d===0) break;
      }
    }
  }
  if(best.d<=2 && best.from && best.to && best.from!==best.to){
    const fixed = qn.replace(best.from, best.to);
    if(fixed!==qn) return fixed;
  }
  return null;
}

function showDidYouMean(txt){
  if(!txt){
    $dym.innerHTML="";
    $dym.style.display="none";
    return;
  }
  $dym.innerHTML = `Myslíš <button class="dymBtn" type="button">${esc(txt)}</button> ?`;
  $dym.style.display="block";
  $dym.querySelector("button").onclick=()=>{ $q.value=txt; render(); $q.focus(); };
}

/* ---------- RENDER ---------- */
  function tokensForHL(q){
    // Simple + safe tokens for highlighting
    const t = norm(q).split(/\s+/).filter(Boolean);
    t.sort((a,b)=>b.length-a.length);
    return t;
  }


/* === PANIKA CARDS (AUTO) === */
function __renderPanicCards(){
  try{
    var grid = document.getElementById("panicGrid");
    if(!grid) return;
    grid.innerHTML = "";

    var cards = [('Nouzové zásoby', 'nouzové zásoby'), ('Voda', 'voda'), ('Jídlo', 'jídlo'), ('Informace a komunikace', 'informace'), ('Když vypadne elektrický proud', 'elektřina'), ('Ukrytí', 'ukrytí'), ('Evakuace', 'evakuace'), ('Pomoc sousedům', 'pomoc sousedům'), ('Komunikace s dětmi', 'děti'), ('Podpora v těžkých chvílích', 'psychická pomoc'), ('Hlavní zásady první pomoci', 'první pomoc'), ('Kontakty', '__PANIKA_KONTAKTY__')];

    cards.forEach(function(it){
      var title = it[0], action = it[1];
      var b = document.createElement("button");
      b.className = "panicBtn";
      b.textContent = title;

      b.onclick = function(){
        try{
          if(action === "__PANIKA_KONTAKTY__"){
            var card = document.getElementById("cityInfoCard");
            if(card){
              card.style.display = "block";
              card.scrollIntoView({behavior:"smooth", block:"start"});
              return;
            }
          }
          if(typeof $q !== "undefined"){
            $q.value = action;
            render();
            $q.focus();
          }
        }catch(_){}
      };
      grid.appendChild(b);
    });
  }catch(_){}
}
/* === /PANIKA CARDS (AUTO) === */

function render(){
  const q = $q.value || "";
    const qTokensForHL = tokensForHL(q);
  const scored = search(q);

  // suggestions
  const sugs = topSuggestions(scored);
  showSuggestions(sugs);

  // did you mean (only if weak top score)
  if(scored.length && (scored[0].score < 55) && norm(q).length>=4){
    showDidYouMean(didYouMean(q));
  }else{
    showDidYouMean(null);
  }

  $r.innerHTML="";
  if(!scored.length){
    $r.innerHTML = `<div class="card"><div class="q">Nic nenalezeno</div><div class="small">Zkus jiná slova: „proud“, „neteče“, „siréna“, „netopí“, „bankomat“. Piš klidně bez diakritiky – funguje to.</div></div>`;
    return;
  }

  const items = scored.map(x=>x.rec.item);
  const shown = panicMode ? items.slice(0,6) : items.slice(0,40);

  for(const x of shown){
    const panicBlock = (x.panic && x.panic.length)
      ? `<div class="box urgent" style="margin-top:10px"><h3>PANIKA ULTRA</h3>${listHL(x.panic, qTokensForHL)}</div>`
      : ``;

    const html = panicMode
      ? `<div class="card">
          <div class="q">${highlightText(x.q, qTokensForHL)}</div>
          <div>${tags(x.tags)}</div>
          ${panicBlock}
          <div class="box" style="margin-top:10px"><h3>TEĎ HNED</h3>${asList(x.now).length ? listHL(asList(x.now), qTokensForHL) : ""}</div>
          <div class="small" style="margin-top:8px">Přepni na PLNO pro detailní plán.</div>
        </div>`
      : `<div class="card">
          <div class="q">${highlightText(x.q, qTokensForHL)}</div>
          <div>${tags(x.tags)}</div>
          ${panicBlock}
          <div class="box"><h3>Teď hned</h3>${asList(x.now).length ? listHL(asList(x.now), qTokensForHL) : ""}</div>
          <div class="box" style="margin-top:10px"><h3>Další hodiny</h3>${asList(x.next).length ? listHL(asList(x.next), qTokensForHL) : ""}</div>
          <div class="box" style="margin-top:10px"><h3>72 hodin</h3>${asList(x.h72).length ? listHL(asList(x.h72), qTokensForHL) : ""}</div>
          <div class="box warn" style="margin-top:10px"><h3>Co nedělat</h3>${asList(x.dont).length ? listHL(asList(x.dont), qTokensForHL) : ""}</div>
          <div class="box urgent" style="margin-top:10px"><h3>Kdy volat pomoc</h3>${listHL(x.call, qTokensForHL)}</div>
          <div class="box" style="margin-top:10px"><h3>Speciální situace</h3>${listHL(x.if, qTokensForHL)}</div>
        </div>`;
    $r.insertAdjacentHTML("beforeend", html);
  }

  try{ __renderPanicCards(); }catch(_){ }
}


function updateSugActive(){
  const btns = [...$sug.querySelectorAll("button")];
  btns.forEach(b=>b.style.outline="none");
  btns.forEach((b,i)=>{
    if(i===SUG_ACTIVE){
      b.style.background="#f3f6ff";
      b.style.border="1px solid #cbd6ff";
      b.style.borderRadius="12px";
    }else{
      b.style.background="";
      b.style.border="";
    }
  });
  if(SUG_ACTIVE>=0 && btns[SUG_ACTIVE]){
    btns[SUG_ACTIVE].scrollIntoView({block:"nearest"});
  }
}

function pickActiveSuggestion(){
  if(SUG_ACTIVE>=0 && SUGS[SUG_ACTIVE]){
    $q.value = SUGS[SUG_ACTIVE].q;
    $sug.style.display="none";
    render();
    $q.focus();
    return true;
  }
  return false;
}

/* ---------- UI WIRING ---------- */
function buildPanicButtons(){
  $grid.innerHTML="";
  for(const p of PRESETS){
    const b=document.createElement("button");
    b.className="panicBtn";
    b.textContent=p.label;
    b.onclick=()=>{
        try{
          if(p.q === "__PANIKA_KONTAKTY__"){
            var card = document.getElementById("cityInfoCard");
            if(card){ card.style.display="block"; card.scrollIntoView({behavior:"smooth", block:"start"}); return; }
          }
        }catch(_){ }
        $q.value=p.q; render();
      };
    $grid.appendChild(b);
  }
}

$toggle.onclick=()=>{
  panicMode=!panicMode;
  $toggle.textContent = panicMode ? "PANIKA: ZAP" : "PLNO: ZAP";
  $toggle.className = "btn " + (panicMode ? "btnPrimary" : "");
  $panicCard.style.display = panicMode ? "" : "none";
  render();
};
$all.onclick=()=>{ $q.value=""; render(); };

$q.addEventListener("input", render);

  $q.addEventListener("keydown", (e)=>{
    if($sug.style.display!=="block" || !SUGS.length) {
      if(e.key==="Enter") return; // normal enter
      return;
    }
    if(e.key==="ArrowDown"){
      e.preventDefault();
      SUG_ACTIVE = Math.min(SUGS.length-1, SUG_ACTIVE+1);
      updateSugActive();
    }else if(e.key==="ArrowUp"){
      e.preventDefault();
      SUG_ACTIVE = Math.max(0, SUG_ACTIVE-1);
      updateSugActive();
    }else if(e.key==="Enter"){
      if(pickActiveSuggestion()) e.preventDefault();
    }else if(e.key==="Escape"){
      $sug.style.display="none";
      SUG_ACTIVE=-1;
    }
  });
$q.addEventListener("focus", ()=>{ if($sug.innerHTML) $sug.style.display="block"; });
document.addEventListener("click", (e)=>{ if(!e.target.closest("#sug") && e.target!==$q) $sug.style.display="none"; });

async function init(){
  var r=document.getElementById('r'); if(r) r.textContent='BOOT OK — '+new Date().toISOString();
  // data
  DATA = await fetch("faq.json").then(r=>r.json());

    // --- merge city.config.json contacts into search DATA (synthetic FAQ items) ---
    try{
      const cfg = await fetch("city.config.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      if(cfg){
        window.__CITY_CONFIG__ = cfg;
        const cityName = (cfg.city && cfg.city.name) ? String(cfg.city.name) : "";
        const groups = Array.isArray(cfg.contactGroups) ? cfg.contactGroups : [];
        const add = [];
        for(const g of groups){
          const gid = (g && g.id) ? String(g.id) : "X";
          const items = (g && Array.isArray(g.items)) ? g.items : [];
          for(const it of items){
            const label = (it && it.label) ? String(it.label).trim() : "";
            const num = (it && it.number) ? String(it.number).trim() : "";
            if(!label || !num) continue;
            add.push({
              id: `CITY_${gid}_${add.length}`,
              category: "Kontakty",
              q: label,
              a: `Telefon: ${num}`,
              tags: ["kontakty", cityName].filter(Boolean)
            });
          }
        }
        if(add.length) DATA = DATA.concat(add);
      }
    }catch(e){}


  // syn
  try{
    const syn = await fetch("synonyms.json").then(r=>r.json());
    buildSynMaps(syn);
  }catch(e){
    buildSynMaps({});
  }

  buildIndex(DATA);
  buildPanicButtons();
  render();

  // sw
  if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.killswitch.js", { scope: "./" }).catch(()=>{});
  // reload once when a new SW takes control (prevents stale UI)
  let __swReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (__swReloaded) return;
    __swReloaded = true;
    location.reload();
  });
}
}
init().catch(e=>{try{console.error(e);var r=document.getElementById("r");if(r)r.textContent="INIT ERROR: "+(e&&(e.stack||e.message)||e);}catch(_){}});

/* === CITY CONFIG BOOTSTRAP (AUTO) === */
(function() {
  function el(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t||"").replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c] || c;
    });
  }
  function normTel(num) {
    return String(num||"").replace(/\s+/g,"").replace(/^\+/, "+");
  }

  function applyCityBranding(cfg) {
    try {
      var b = (cfg && cfg.branding) ? cfg.branding : null;
      var city = (cfg && cfg.city) ? cfg.city : null;

      var title = (b && b.headerTitle) ? b.headerTitle : (city && city.name ? ("Digitální krizový manuál – " + city.name) : "Digitální krizový manuál");
      var subtitle = (b && b.headerSubtitle) ? b.headerSubtitle : "Offline";

      var t = el("cityHeaderTitle");
      var sub = el("cityHeaderSubtitle");
      if (t) t.textContent = title;
      if (sub) sub.innerHTML = 'Offline: <b id="net">?</b> • ' + esc(subtitle);

      var logoPath = (b && b.logo) ? b.logo : "";
      var lg = el("cityLogo");
      if (lg && logoPath) {
        lg.src = logoPath;
        lg.alt = (city && city.name) ? ("Logo města " + city.name) : "Logo obce";
        lg.style.display = "block";
      }
    } catch (e) {}
  }

  function renderPhonesFlat(phones, out) {
    var rows = [];
    if (phones) {
      Object.keys(phones).forEach(function(k) {
        var it = phones[k] || {};
        var label = it.label || k;
        var num = (it.number || "").trim();
        if (!num) return;
        var tel = normTel(num);
        rows.push(
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)">' +
            '<div style="font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">' + esc(label) + '</div>' +
            '<a href="tel:' + esc(tel) + '" style="font-weight:900;text-decoration:none;color:#0b5bd3;white-space:nowrap">' + esc(num) + '</a>' +
          '</div>'
        );
      });
    }
    out.innerHTML = rows.length ? rows.join("") : '<div class="small">Kontakty nejsou vyplněné.</div>';
  }

  function renderContactGroups(groups, out) {
    if (!Array.isArray(groups) || !groups.length) return false;

    var html = groups.map(function(g) {
      var title = g.title || (g.id ? (g.id + ") Kontakty") : "Kontakty");
      var items = Array.isArray(g.items) ? g.items : [];
      var inner = items.map(function(it) {
        var label = it.label || "";
        var num = (it.number || "").trim();
        if (!num) return '';
        var tel = normTel(num);
        return (
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)">' +
            '<div style="font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">' + esc(label) + '</div>' +
            '<a href="tel:' + esc(tel) + '" style="font-weight:900;text-decoration:none;color:#0b5bd3;white-space:nowrap">' + esc(num) + '</a>' +
          '</div>'
        );
      }).filter(Boolean).join("");

      if (!inner) inner = '<div class="small">Bez položek.</div>';

      return (
        '<details style="margin:10px 0;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:#fff;padding:8px 10px">' +
          '<summary style="cursor:pointer;font-weight:900;list-style:none;outline:none">' + esc(title) + '</summary>' +
          '<div style="margin-top:8px">' + inner + '</div>' +
        '</details>'
      );
    }).join("");

    out.innerHTML = html;
    return true;
  }

  function renderCityInfo(cfg) {
    try {
      var card = el("cityInfoCard");
      var outPhones = el("cityContacts");
      var outEvac = el("cityEvacuation");
      if (!card || !outPhones || !outEvac) return;

      var groups = cfg && cfg.contactGroups;
      var phones = cfg && cfg.phones;

      // Prefer groups (A–G). If missing, fallback to flat phones.
      var usedGroups = renderContactGroups(groups, outPhones);
      if (!usedGroups) renderPhonesFlat(phones, outPhones);

      var evac = (cfg && cfg.evacuation) ? cfg.evacuation : null;
      if (evac && evac.primaryPoint) {
        var v = (evac.primaryPoint.value || "").trim();
        var lab = evac.primaryPoint.label || "Hlavní shromaždiště / evakuační místo";
        outEvac.innerHTML = '<div><b>' + esc(lab) + ':</b> ' + (v ? esc(v) : '<span class="small">není vyplněno</span>') + '</div>';
      } else {
        outEvac.innerHTML = '<div class="small">Evakuace není vyplněná.</div>';
      }

      card.style.display = "block";
    } catch (e) {}
  }

  async function loadCityConfig() {
    try {
      var r = await fetch("./city.config.json", { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  (async function() {
    var cfg = await loadCityConfig();
    if (cfg) {
      window.__CITY_CONFIG__ = cfg;
      applyCityBranding(cfg);
      renderCityInfo(cfg);
    } else {
      applyCityBranding({ branding: { headerTitle: "Digitální krizový manuál", headerSubtitle: "Offline" } });
    }
  })();
})();
/* === /CITY CONFIG BOOTSTRAP (AUTO) === */



/* PWA_INSTALL_UX_v1 */
(function(){
  // Optional install button: create it if it doesn't exist
  function ensureInstallBtn(){
    var btn = document.getElementById('btnInstall');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'btnInstall';
    btn.type = 'button';
    btn.textContent = 'Instalovat aplikaci';
    btn.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.15);background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.12);display:none;';
    document.body.appendChild(btn);
    return btn;
  }
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    var btn = ensureInstallBtn();
    btn.style.display = 'block';
    btn.onclick = async function(){
      if (!deferredPrompt) return;
      btn.disabled = true;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch(_) {}
      deferredPrompt = null;
      btn.style.display = 'none';
      btn.disabled = false;
    };
  });
  window.addEventListener('appinstalled', function(){
    var btn = document.getElementById('btnInstall');
    if (btn) btn.style.display = 'none';
  });
})();


/* SW_MIGRATION_LISTENER_v1 */
(function(){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", async (e)=>{
    try{
      const msg = e.data || {};
      if(msg.type !== "SW_MIGRATE_TO") return;
      const url = msg.url || "./sw.pwa3.js";
      await navigator.serviceWorker.register(url, { scope: "./" }).catch(()=>{});
      location.reload();
    }catch(_){}
  });
})();
