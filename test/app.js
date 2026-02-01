(() => {
  "use strict";
  const $ = (s)=>document.querySelector(s);
  const KB_URL = "./data/knowledge_base.txt";

  function esc(s){
    return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function render(items){
    const box = $("#results");
    if(!box) return;
    box.innerHTML = items.map(it => `
      <div class="item">
        <div class="t">${esc(it.title||"")}</div>
        <div class="p">${esc(it.text||"")}</div>
      </div>
    `).join("");
  }

  async function boot(){
    if(!window.SearchCore) throw new Error("SearchCore missing");
    const raw = await window.SearchCore.loadKB(KB_URL);
    const all = window.SearchCore.parseKB(raw);

    const q = $("#q");
    const run = () => {
      const v = (q.value || "").trim();
      const out = window.SearchCore.search(all, v);
      render(out.slice(0, 30));
    };

    q.addEventListener("input", run);
    // nic nehledáme defaultně (prázdno), aby to bylo čisté jako předtím
    render([]);
  }

  window.addEventListener("DOMContentLoaded", ()=>boot().catch(e=>console.error(e)));
})();
