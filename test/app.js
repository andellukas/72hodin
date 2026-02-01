/* 72H /test boot (v3) - forces KB load and shows counters */
(() => {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  const BUILD = Date.now(); // cache-bust without involving bash expansion
  const KB_URL = "./data/knowledge_base.txt?v=" + BUILD;

  const state = { raw: "", items: [] };

  function log(...args){ console.log("[72H/test]", ...args); }
  function setText(sel, txt){ const el = $(sel); if (el) el.textContent = String(txt); }
  function escapeHtml(s){
    return String(s||"").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  }

  async function load() {
    if (!window.SearchCore) throw new Error("SearchCore missing (search-core.js not loaded)");
    log("Loading KB:", KB_URL);

    const raw = await window.SearchCore.loadKB(KB_URL);
    state.raw = raw;

    const items = window.SearchCore.parseKB(raw);
    state.items = items;

    const lines = raw.split("\n").length;
    const bytes = new TextEncoder().encode(raw).length;

    setText("#kb_path", KB_URL);
    setText("#kb_lines", lines);
    setText("#kb_bytes", bytes);
    setText("#kb_items", items.length);

    const scenario = (raw.match(/^@@SCENARIO:\s+/gm) || []).length;
    const section  = (raw.match(/^@@SECTION:\s+/gm)  || []).length;
    setText("#kb_scen", scenario);
    setText("#kb_sec", section);

    renderResults(items.slice(0, 20));
    log("KB loaded OK. items=", items.length, "lines=", lines, "bytes=", bytes);
  }

  function renderResults(list) {
    const box = $("#results");
    if (!box) return;
    box.innerHTML = list.map(it => {
      const preview = (it.text || "").slice(0, 220).replace(/\s+/g, " ").trim();
      return `
        <div class="card">
          <div class="t">${escapeHtml(it.title || "")}</div>
          <div class="p">${escapeHtml(preview)}${(it.text||"").length>220 ? "…" : ""}</div>
        </div>
      `;
    }).join("");
    setText("#shown", list.length);
  }

  function onSearch() {
    const q = ($("#q")?.value || "").trim();
    const out = window.SearchCore.search(state.items, q);
    renderResults(out.slice(0, 50));
    setText("#match", out.length);
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("#q")?.addEventListener("input", () => onSearch());
    $("#reload")?.addEventListener("click", async () => {
      try { await load(); } catch (e) { console.error(e); alert(String(e)); }
    });

    load().catch(e => {
      console.error(e);
      setText("#kb_items", "ERROR");
      setText("#kb_path", "ERROR");
      alert("KB load failed: " + e.message);
    });
  });
})();
