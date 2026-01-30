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
  // Accept:
  // 1) { items: [...] }
  // 2) [...] (array)
  // Anything else -> empty
  let items = [];
  if (Array.isArray(data)) items = data;
  else if (data && Array.isArray(data.items)) items = data.items;

  // Normalize each item into {title, body, tags?}
  return items.map((it) => {
    if (typeof it === "string") return { title: it.slice(0, 80), body: it };
    const title = String(it.title ?? it.name ?? it.q ?? it.question ?? "").trim();
    const body  = String(it.body ?? it.text ?? it.a ?? it.answer ?? "").trim();
    const tags  = Array.isArray(it.tags) ? it.tags.map(String) : [];
    return { title: title || "(bez názvu)", body, tags };
  }).filter(x => x.body || x.title);
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
