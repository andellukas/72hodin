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


/*__CONTACTS_PANEL_V1__*/
(function () {
  const panel = document.getElementById("contactsPanel");
  const body  = document.getElementById("contactsBody");
  const q     = document.getElementById("q");
  if (!panel || !body || !q) return;

  function extractContacts(text) {
    const lines = String(text || "").split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim().toUpperCase();
      if (t.startsWith("@@SECTION") && t.includes("KONTAKT")) { start = i + 1; break; }
    }
    if (start < 0) return "";
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith("@@SECTION") || t.startsWith("@@SCENARIO")) break;
      out.push(lines[i]);
    }
    return out.join("\n").trim();
  }

  fetch("./knowledge_base.txt")
    .then(r => r.ok ? r.text() : "")
    .then(txt => {
      const c = extractContacts(txt);
      if (!c) return;
      body.textContent = c;
      panel.hidden = false;
      q.addEventListener("input", () => {
        panel.hidden = q.value.trim().length > 0;
      }, { passive: true });
    })
    .catch(() => {});
})();
