/* /test v3 app.js
   Goals:
   - prove KB is loaded (visible counters)
   - detect if a Service Worker controls this page (likely from root) and allow reset
   - keep simple search UX
*/
(() => {
  "use strict";

  const BUILD = Date.now().toString(36);
  const KB_URL = "./data/knowledge_base.txt?v=" + BUILD;

  const $ = (sel) => document.querySelector(sel);

  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = String(text ?? "");
  }

  function log(...args) {
    // keep logs minimal but useful
    console.log("[/test]", ...args);
  }

  async function getKB() {
    const res = await fetch(KB_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("KB fetch failed: " + res.status + " " + res.statusText);
    const txt = await res.text();
    return txt;
  }

  function kbStats(raw) {
    // lines: count '\n' + (raw not empty ? 1 : 0) is more stable across trailing newline situations
    const bytes = new TextEncoder().encode(raw).length;
    const lines = raw.length ? raw.split("\n").length : 0;
    return { bytes, lines };
  }

  function renderResults(items, query) {
    const box = $("#results");
    if (!box) return;

    const q = (query || "").trim().toLowerCase();
    const filtered = q
      ? items.filter(it => (it.title + "\n" + it.body).toLowerCase().includes(q))
      : items;

    setText("#kb_items", String(items.length));
    setText("#results_count", String(filtered.length));

    box.innerHTML = filtered.slice(0, 200).map(it => {
      const t = escapeHtml(it.title || "(bez názvu)");
      const b = escapeHtml(it.body || "");
      return `<div style="padding:12px 14px;border:1px solid rgba(255,255,255,.10);border-radius:14px;margin:10px 0;background:rgba(0,0,0,.18)">
        <div style="font-weight:800;margin-bottom:6px">${t}</div>
        <div style="white-space:pre-wrap;opacity:.92;line-height:1.35">${b}</div>
      </div>`;
    }).join("");

    // extra proof: show first/last titles
    setText("#first_item", items[0]?.title || "-");
    setText("#last_item", items[items.length - 1]?.title || "-");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function initSWPanel() {
    const controlled = !!navigator.serviceWorker?.controller;
    setText("#sw_status", controlled ? "SW: ANO (může cachovat /test)" : "SW: NE");

    const btn = $("#reset_sw");
    if (btn) {
      btn.addEventListener("click", async () => {
        try {
          // unregister all SW for this origin
          if (navigator.serviceWorker?.getRegistrations) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
          // delete all caches
          if (window.caches?.keys) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch (e) {
          console.warn("[/test] reset failed:", e);
        } finally {
          // hard reload with cache bust
          location.replace("./?v=" + Date.now());
        }
      });
    }
  }

  async function main() {
    await initSWPanel();

    setText("#kb_path", KB_URL);

    // load KB via SearchCore if present, else direct fetch
    let raw = "";
    try {
      if (window.SearchCore?.loadKB) {
        log("Loading KB via SearchCore:", KB_URL);
        raw = await window.SearchCore.loadKB(KB_URL);
      } else {
        log("Loading KB via fetch:", KB_URL);
        raw = await getKB();
      }
    } catch (e) {
      console.error(e);
      setText("#sw_status", "SW: (chyba) " + (e?.message || e));
      return;
    }

    const st = kbStats(raw);
    setText("#kb_lines", st.lines);
    setText("#kb_bytes", st.bytes);

    let items = [];
    try {
      if (window.SearchCore?.parseKB) {
        items = window.SearchCore.parseKB(raw);
      } else {
        // ultra-simple fallback: one item
        items = [{ title: "Knowledge Base", body: raw }];
      }
    } catch (e) {
      console.error(e);
      setText("#sw_status", "Parse error: " + (e?.message || e));
      return;
    }

    // ensure results placeholders exist (non-fatal if missing)
    if (!$("#results_count")) {
      // inject minimal search UI if current index.html doesn't have it
      const host = document.createElement("div");
      host.style.maxWidth = "980px";
      host.style.margin = "0 auto";
      host.style.padding = "0 16px 30px";
      host.innerHTML = `
        <div style="margin:10px 0 6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
          <input id="q" placeholder="Hledej…" style="flex:1;min-width:240px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.2);color:#fff;outline:none" />
          <div style="font-size:12px;opacity:.85">Nalezeno: <span id="results_count">0</span></div>
        </div>
        <div style="font-size:12px;opacity:.75;margin:6px 0">První: <span id="first_item">-</span> • Poslední: <span id="last_item">-</span></div>
        <div id="results"></div>`;
      document.body.appendChild(host);
    }

    const qEl = $("#q");
    const doSearch = () => renderResults(items, qEl ? qEl.value : "");

    if (qEl) qEl.addEventListener("input", doSearch);

    // initial render
    doSearch();
    log("KB loaded. items=", items.length, "lines=", st.lines, "bytes=", st.bytes);
  }

  window.addEventListener("DOMContentLoaded", main);
})();
