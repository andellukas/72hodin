(() => {
  "use strict";
  const $ = (s)=>document.querySelector(s);
  const KB_URL = "./data/knowledge_base.txt";

  function esc(s){
    return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function render(items){
    const box=$("#results"); if(!box) return;
    box.innerHTML = items.map(it=>`
      <div class="card">
        <div class="t">${esc(it.title||"")}</div>
        <div class="p">${esc(it.text||"")}</div>
      </div>
    `).join("");
  }

  async function boot(){
    if(!window.SearchCore) throw new Error("SearchCore missing");
    const raw = await window.SearchCore.loadKB(KB_URL);
    const items = window.SearchCore.parseKB(raw);

    const q=$("#q");
    const run=()=>{
      const v=(q.value||"").trim();
      const out = window.SearchCore.search(items, v);
      render(out.slice(0, 50));
    };
    q.addEventListener("input", run);
  }

  window.addEventListener("DOMContentLoaded", ()=>boot().catch(e=>console.error(e)));
})();
