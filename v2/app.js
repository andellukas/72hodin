/* v2/app.js — offline search over v2/data/knowledge_base.json ONLY */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

function $(sel){ return document.querySelector(sel); }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

function normalizeKB(data){
  // Intuitive normalization:
  // Accept many reasonable JSON shapes and normalize into:
  // [{ title, body, tags:[] }]
  //
  // Supported top-level:
  // - Array
  // - {items:[...]} or {entries:[...]} or {data:[...]} or {kb:[...]} or {docs:[...]} etc.

  const pickArray = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const keys = ["items","entries","data","kb","records","docs","documents","articles","scenarios"];
    for (const k of keys){
      if (Array.isArray(obj[k])) return obj[k];
    }
    return null;
  };

  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

  const asText = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return "";
  };

  const joinLines = (arr) => (Array.isArray(arr) ? arr.map(asText).filter(Boolean).join("\n") : "");

  const formatSteps = (steps) => {
    if (!Array.isArray(steps)) return "";
    const lines = steps.map((s, i) => {
      if (typeof s === "string") return `- ${s}`;
      if (isObj(s)){
        const t = asText(s.title || s.step || s.name);
        const b = asText(s.body || s.text || s.do || s.action);
        if (t && b) return `- ${t}: ${b}`;
        if (t) return `- ${t}`;
        if (b) return `- ${b}`;
      }
      return "";
    }).filter(Boolean);
    return lines.join("\n");
  };

  const formatSections = (sections) => {
    if (!isObj(sections)) return "";
    const out = [];
    for (const [k,v] of Object.entries(sections)){
      const head = String(k).trim();
      if (!head) continue;
      let body = "";
      if (typeof v === "string") body = v.trim();
      else if (Array.isArray(v)) body = v.map(asText).filter(Boolean).join("\n");
      else if (isObj(v)) body = JSON.stringify(v, null, 2);
      if (body) out.push(`${head}\n${body}`);
    }
    return out.join("\n\n");
  };

  const uniq = (arr) => {
    const s = new Set();
    for (const x of arr){
      const v = String(x || "").trim();
      if (v) s.add(v);
    }
    return Array.from(s);
  };

  const deriveTags = (it, title) => {
    const tags = [];
    // explicit tags
    if (Array.isArray(it.tags)) tags.push(...it.tags.map(asText));
    else if (typeof it.tags === "string") tags.push(...it.tags.split(/[;,]/g).map(t=>t.trim()));

    // common metadata -> tags
    for (const k of ["category","type","city","severity","phase"]){
      const v = asText(it[k]);
      if (v) tags.push(v);
    }

    // very light title-derived tags (no guessing, just split)
    if (title){
      const t = title.toLowerCase();
      const hit = [];
      const map = [
        ["blackout","blackout"],["elektř","elektrina"],["voda","voda"],["plyn","plyn"],
        ["zima","zima"],["mráz","zima"],["oheň","pozar"],["požár","pozar"],
        ["konflikt","konflikt"],["agrese","konflikt"],["zraně","prvni_pomoc"],["krvác","prvni_pomoc"]
      ];
      for (const [needle, tag] of map){
        if (t.includes(needle)) hit.push(tag);
      }
      tags.push(...hit);
    }

    return uniq(tags);
  };

  const normalizeItem = (it) => {
    // string item
    if (typeof it === "string"){
      const s = it.trim();
      if (!s) return null;
      const title = s.split("\n")[0].slice(0, 120).trim() || "(bez názvu)";
      return { title, body: s, tags: [] };
    }

    // object item
    if (isObj(it)){
      const title =
        asText(it.title) ||
        asText(it.name) ||
        asText(it.q) ||
        asText(it.question) ||
        asText(it.heading) ||
        asText(it.h) ||
        "";

      // body can come from many places
      let body =
        asText(it.body) ||
        asText(it.text) ||
        asText(it.content) ||
        asText(it.markdown) ||
        asText(it.a) ||
        asText(it.answer) ||
        "";

      // enrich from structured fields if body empty or to append
      const parts = [];

      // "when"/"if" (conditions)
      const when = joinLines(it.when) || asText(it.when);
      const cond = joinLines(it.if) || asText(it.if);
      if (when) parts.push(`KDY:\n${when}`);
      if (cond) parts.push(`PODMÍNKA:\n${cond}`);

      // steps / do / bullets
      const steps = formatSteps(it.steps) || formatSteps(it.do) || joinLines(it.bullets);
      if (steps) parts.push(`POSTUP:\n${steps}`);

      // sections object
      const sec = formatSections(it.sections);
      if (sec) parts.push(sec);

      // fallback: if no body and we still have parts
      if (parts.length){
        const extra = parts.join("\n\n");
        if (body) body = `${body}\n\n${extra}`;
        else body = extra;
      }

      const finalTitle = (title || "(bez názvu)").trim();
      const finalBody = (body || "").trim();

      if (!finalTitle && !finalBody) return null;

      const tags = deriveTags(it, finalTitle);
      return { title: finalTitle, body: finalBody || finalTitle, tags };
    }

    // unknown type
    return null;
  };

  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (isObj(data)) arr = pickArray(data);

  if (!arr){
    // fail-closed: show diagnostic format
    const keys = isObj(data) ? Object.keys(data).slice(0, 30) : [];
    throw new Error("Neznámý formát knowledge_base.json. Očekávám pole nebo objekt s polem (items/entries/data/...). Vidím klíče: " + keys.join(", "));
  }

  const out = [];
  for (const it of arr){
    const n = normalizeItem(it);
    if (n) out.push(n);
  }
  return out;
}

function scoreItem(item, qTokens){
  const t = (item.title || "").toLowerCase();
  const b = (item.body || "").toLowerCase();
  const tags = (item.tags || []).join(" ").toLowerCase();

  let s = 0;
  for (const tok of qTokens){
    if (!tok) continue;
    if (t.includes(tok)) s += 20;
    if (tags.includes(tok)) s += 12;
    if (b.includes(tok)) s += 6;
  }
  // Bonus if startswith in title
  if (qTokens.length && t.startsWith(qTokens[0])) s += 8;
  return s;
}

async function loadKB(){
  const url = "./data/knowledge_base.json";
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`KB load failed: HTTP ${r.status} (${url})`);
  const data = await r.json();
  return normalizeKB(data);
}

function openResults(query, results){
  const box = $("#results");
  const list = $("#list");
  const qinfo = $("#qinfo");
  qinfo.textContent = `Dotaz: "${query}" • Nalezeno: ${results.length}`;
  list.innerHTML = results.map((x) => `
    <div class="card">
      <h2>${escapeHtml(x.title)}</h2>
      <pre>${escapeHtml(x.body || "")}</pre>
      ${x.tags?.length ? `<div class="small">štítky: ${escapeHtml(x.tags.join(", "))}</div>` : ``}
    </div>
  `).join("");

  box.classList.add("open");
}

function closeResults(){
  $("#results").classList.remove("open");
}

(async function main(){
  const q = $("#q");
  const go = $("#go");
  const close = $("#close");
  const pills = document.querySelectorAll("[data-q]");

  let KB = [];
  try{
    KB = await loadKB();
  }catch(e){
    // Fail-closed: show explicit error
    const msg = document.createElement("div");
    msg.className = "wrap";
    msg.innerHTML = `<div class="card"><h2>Chyba dat</h2><pre>${escapeHtml(e?.message || String(e))}</pre></div>`;
    document.body.appendChild(msg);
    return;
  }

  function runSearch(query){
    const qq = String(query || "").trim();
    if(!qq) return;
    const tokens = qq.toLowerCase().split(/\s+/g).slice(0, 12);
    const scored = KB.map(it => ({ it, s: scoreItem(it, tokens) }))
                     .filter(x => x.s > 0)
                     .sort((a,b) => b.s - a.s)
                     .slice(0, 50)
                     .map(x => x.it);
    openResults(qq, scored.length ? scored : [{title:"Nic nenalezeno", body:"Zkus jiné slovo (např. blackout, voda, plyn, zima, konflikt)."}]);
  }

  go.addEventListener("click", () => runSearch(q.value));
  q.addEventListener("keydown", (e) => { if(e.key === "Enter") runSearch(q.value); });
  close.addEventListener("click", closeResults);
  $("#results").addEventListener("click", (e) => { if(e.target.id === "results") closeResults(); });

  pills.forEach(p => p.addEventListener("click", () => {
    const v = p.getAttribute("data-q") || "";
    q.value = v;
    runSearch(v);
  }));
})();
