/**
 * 72H v3 search-core.js
 * - Supports legacy delimiter: "=== ITEM ==="
 * - Supports KB format:
 *     @@SCENARIO: <title>
 *     @@SECTION:  <title>
 *   -> Creates one searchable item per SECTION.
 * - UI should NEVER show @@SCENARIO / @@SECTION markers (we strip them here).
 */
(function () {
  "use strict";

  function normalizeText(s) {
    return String(s || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();
  }

  function stripMarkers(s) {
    // remove any leftover markers
    return String(s || "")
      .replace(/^@@SCENARIO:\s*/gm, "")
      .replace(/^@@SECTION:\s*/gm, "")
      .trim();
  }

  function parseByItemDelimiter(txt) {
    const parts = txt.split("=== ITEM ===").map(p => p.trim()).filter(Boolean);
    return parts.map((p, i) => ({
      id: `item_${i + 1}`,
      title: firstNonEmptyLine(p) || `Položka ${i + 1}`,
      text: p
    }));
  }

  function firstNonEmptyLine(s) {
    const lines = String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
    return lines[0] || "";
  }

  function parseByScenarioSection(txt) {
    // Split into scenario blocks; keep title.
    // We accept that the very first line is @@SCENARIO: ...
    const blocks = txt.split(/^@@SCENARIO:\s*/m);

    // If file doesn't start with @@SCENARIO: then blocks[0] is preamble (ignore if empty)
    const usable = blocks.map(b => b.trim()).filter(Boolean);

    const items = [];
    let idCounter = 1;

    for (const b of usable) {
      // b starts with "<scenario title>\n...\n@@SECTION: ..."
      const nl = b.indexOf("\n");
      const scenarioTitle = (nl >= 0 ? b.slice(0, nl) : b).trim();
      const rest = nl >= 0 ? b.slice(nl + 1) : "";

      // sections: split by @@SECTION:
      const secParts = rest.split(/^@@SECTION:\s*/m).map(x => x.trim());

      // secParts[0] may be empty / intro without section marker -> ignore if too small
      for (let si = 1; si < secParts.length; si++) {
        const sec = secParts[si];
        if (!sec) continue;

        const nls = sec.indexOf("\n");
        const sectionTitle = (nls >= 0 ? sec.slice(0, nls) : sec).trim();
        const sectionBodyRaw = nls >= 0 ? sec.slice(nls + 1) : "";

        const title = [scenarioTitle, sectionTitle].filter(Boolean).join(" — ").trim();
        const text = stripMarkers(sectionBodyRaw);

        // Skip empty
        if (!text || text.length < 5) continue;

        items.push({
          id: `sec_${idCounter++}`,
          title: title || `Sekce ${idCounter - 1}`,
          text: text
        });
      }
    }
    return items;
  }

  // Public API expected by app.js (minimal, robust)
  window.SearchCore = {
    async loadKB(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`KB fetch failed: ${res.status} ${res.statusText}`);
      return normalizeText(await res.text());
    },

    parseKB(raw) {
      const txt = normalizeText(raw);

      const hasItemDelim = txt.includes("=== ITEM ===");
      const hasScenario = /^@@SCENARIO:\s+/m.test(txt);
      const hasSection = /^@@SECTION:\s+/m.test(txt);

      let items = [];
      if (hasItemDelim) {
        items = parseByItemDelimiter(txt);
      } else if (hasScenario && hasSection) {
        items = parseByScenarioSection(txt);
      } else {
        // Fallback: one item
        items = [{
          id: "single_1",
          title: firstNonEmptyLine(txt) || "Knowledge Base",
          text: stripMarkers(txt)
        }];
      }

      // Final sanitize: make sure markers never leak
      items = items.map(it => ({
        id: it.id,
        title: stripMarkers(it.title),
        text: stripMarkers(it.text)
      }));

      return items;
    },

    // ultra-minimal search: substring match (can be replaced later)
    search(items, query) {
      const q = normalizeText(query).toLowerCase();
      if (!q) return items;

      return items.filter(it => {
        const hay = (it.title + "\n" + it.text).toLowerCase();
        return hay.includes(q);
      });
    }
  };
})();
