
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
function render(){
  const q = $q.value || "";
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
          <div class="box" style="margin-top:10px"><h3>TEĎ HNED</h3>${listHL(x.now, qTokensForHL)}</div>
          <div class="small" style="margin-top:8px">Přepni na PLNO pro detailní plán.</div>
        </div>`
      : `<div class="card">
          <div class="q">${highlightText(x.q, qTokensForHL)}</div>
          <div>${tags(x.tags)}</div>
          ${panicBlock}
          <div class="box"><h3>Teď hned</h3>${listHL(x.now, qTokensForHL)}</div>
          <div class="box" style="margin-top:10px"><h3>Další hodiny</h3>${listHL(x.next, qTokensForHL)}</div>
          <div class="box" style="margin-top:10px"><h3>72 hodin</h3>${listHL(x.h72, qTokensForHL)}</div>
          <div class="box warn" style="margin-top:10px"><h3>Co nedělat</h3>${listHL(x.dont, qTokensForHL)}</div>
          <div class="box urgent" style="margin-top:10px"><h3>Kdy volat pomoc</h3>${listHL(x.call, qTokensForHL)}</div>
          <div class="box" style="margin-top:10px"><h3>Speciální situace</h3>${listHL(x.if, qTokensForHL)}</div>
        </div>`;
    $r.insertAdjacentHTML("beforeend", html);
  }
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
    b.onclick=()=>{ $q.value=p.q; render(); };
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
  // data
  DATA = await fetch("faq.json").then(r=>r.json());

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
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("./sw.js").catch(()=>{}); }
}
init();
