(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const KB_URL = "./data/knowledge_base.txt";

  function esc(s){
    return String(s ?? "").replace(/[&<>"]/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
    }[c]));
  }

  function render(items){
    const box = $("#results");
    if(!box) return;

    if(!items || items.length === 0){
      box.innerHTML = "";
      return;
    }

    box.innerHTML = items.slice(0, 40).map(it => `
      <div class="item">
        <div class="t">${esc(it.title || "")}</div>
        <div class="p">${esc(it.text || "")}</div>
      </div>
    `).join("");
  }

  async function boot(){
    if(!window.SearchCore) throw new Error("SearchCore missing");

    const q = $("#q");
    if(!q) throw new Error("Missing #q input");

    const raw = await window.SearchCore.loadKB(KB_URL);
    const all = window.SearchCore.parseKB(raw);

    const run = () => {
      const term = (q.value || "").trim();
      const out = window.SearchCore.search(all, term);
      render(out);
    };

    q.addEventListener("input", run);
    // čistý start – nic neukazovat, dokud uživatel nepíše
    render([]);
  }

  window.addEventListener("DOMContentLoaded", () => {
    boot().catch(err => console.error(err));
  });
})();
