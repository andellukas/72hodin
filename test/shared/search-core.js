/**
 * shared/search-core.js (v3)
 * - Offline search over ONE text file (knowledge_base.txt)
 * - Supports user's format:
 *    @@SCENARIO: ...
 *    @@SECTION: ...
 *   Oddělovače se NEZOBRAZUJÍ; slouží jen jako struktura pro rozsekání na položky.
 */

export function stripDiacritics(s){
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalize(s){
  return stripDiacritics(String(s || "").toLowerCase())
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STOP = new Set(["a","i","že","se","si","to","ten","ta","tohle","tady","pro","na","do","v","ve","z","ze","u","od","k","ke","po","pod","nad","s","bez","ne","ano"]);

export function tokenize(s){
  const n = normalize(s);
  if(!n) return [];
  return n.split(/\s+/).filter(t => t && t.length >= 2 && !STOP.has(t));
}

function highlight(text, tokens){
  if(!tokens || tokens.length === 0) return text;
  let out = text;
  // zvýrazňuj jen rozumné tokeny (unikát)
  const uniq = Array.from(new Set(tokens)).slice(0, 12);
  for(const t of uniq){
    if(t.length < 2) continue;
    // jednoduchý case-insensitive marker přes normalize je složitý; děláme best-effort v původním textu:
    // (užitek > dokonalost, ale bez rozbití)
    const re = new RegExp(`(${escapeRegExp(t)})`, "ig");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/**
 * Parse user's KB text:
 * - Scenario starts new block
 * - Section starts new item inside scenario
 * - Text between markers becomes item body
 *
 * Output items:
 *  { title, body, tags: [scenario, section], _normTitle, _normBody }
 */
export function parseKB(text){
  const lines = String(text || "").replace(/\r\n/g,"\n").split("\n");

  let curScenario = "";
  let curSection = "";
  let buf = [];

  const items = [];

  function flush(){
    const body = buf.join("\n").trim();
    if(!body) { buf = []; return; }

    // Title rules (oddělovače nezobrazujeme; vytváříme "normální" tituly)
    let title = "";
    if(curScenario && curSection) title = `${curScenario} — ${curSection}`;
    else if(curScenario) title = curScenario;
    else if(curSection) title = curSection;
    else {
      // fallback: první řádek jako název
      const first = body.split("\n")[0].trim();
      title = first.length <= 80 ? first : "Záznam";
    }

    items.push({
      title,
      body,
      tags: [curScenario || "", curSection || ""].filter(Boolean),
      _normTitle: normalize(title),
      _normBody: normalize(body),
    });

    buf = [];
  }

  for(const raw of lines){
    const line = raw.trimEnd();

    if(line.startsWith("@@SCENARIO:")){
      flush();
      curScenario = line.replace("@@SCENARIO:","").trim();
      curSection = "";
      continue;
    }

    if(line.startsWith("@@SECTION:")){
      flush();
      curSection = line.replace("@@SECTION:","").trim();
      continue;
    }

    // ignorujeme prázdné superdlouhé "oddělovače" pouze vizuálně? ne – zachováme text jak je,
    // jen ty marker řádky jsme už odfiltrovali výše.
    buf.push(raw);
  }

  flush();
  return items;
}

/**
 * Score item:
 * - title matches > tags > body
 */
export function scoreItem(qTokens, item){
  if(!qTokens || qTokens.length === 0) return 0;

  let s = 0;
  for(const t of qTokens){
    if(item._normTitle.includes(t)) s += 8;
    else if((item.tags || []).some(tag => normalize(tag).includes(t))) s += 5;
    else if(item._normBody.includes(t)) s += 2;
  }
  return s;
}

export function search(items, query){
  const qTokens = tokenize(query);
  if(qTokens.length === 0) return { qTokens, results: [] };

  const scored = items
    .map(it => ({ it, s: scoreItem(qTokens, it) }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s)
    .slice(0, 30)
    .map(x => {
      const preview = x.it.body.length > 420 ? (x.it.body.slice(0, 420).trimEnd() + "…") : x.it.body;
      return {
        title: x.it.title,
        body: x.it.body,
        preview,
        tags: x.it.tags || [],
        _highlightTitle: highlight(x.it.title, qTokens),
        _highlightPreview: highlight(preview, qTokens),
        score: x.s
      };
    });

  return { qTokens, results: scored };
}
