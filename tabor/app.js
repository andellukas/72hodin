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


/*__CONTACTS_PANEL_V3__*/
(function () {
  const panel = document.getElementById("contactsPanel");
  const body  = document.getElementById("contactsBody");
  const q     = document.getElementById("q");
  if (!panel || !body || !q) return;

  const CONTACTS_TEXT = '🔴 1) PŘI OHROŽENÍ ŽIVOTA\n\n112 – Tísňové číslo (IZS)\n155 – Záchranná služba  \n150 – Hasiči\n158 – Policie ČR\n156 – Městská policie Tábor  \n603 111 158 – SMS tísňová linka pro neslyšící  \n\nTábor – přímé linky \nMěstská policie Tábor: 156 / 381 253 008  \nPolicie ČR Tábor: 974 238 111  \nHZS Tábor: 950 221 111  \n\n────────────────────────\n\n⚠️ 2) AKUTNÍ HROZBY, NEPOKOJE\n\n112 – akutní ohrožení  \n158 – Policie ČR  \n156 – Městská policie Tábor (381 253 008)  \n974 238 111 – Policie ČR Tábor (neurgentní)\n\n────────────────────────\n\n⚡ 3) VÝPADKY A HAVÁRIE INFRASTRUKTURY  \n(blackout, plyn, voda, teplo)\n\nPLYN  \n1239 – Havárie / únik plynu\n\nELEKTŘINA – EG.D  \n800 22 55 77 – poruchy elektřiny\n\nVODA / KANALIZACE  \nVSTAB: 722 933 636\n\nTEPLO / DÁLKOVÉ VYTÁPĚNÍ  \nTeplárna Tábor / C-energy: 381 417 202\n(u bytových domů i správce / SVJ)\n\nKritická trojice při blackoutu:  \n112 / 800 22 55 77 / 722 933 636\n\n────────────────────────\n\n🏛️ 4) KRIZOVÉ ŘÍZENÍ MĚSTA / POVODNĚ\n\nMěsto Tábor – ústředna: 381 486 111  \nKrizová / povodňová linka: 381 486 363  \n\n────────────────────────\n\n🏥 5) ZDRAVOTNICTVÍ – NEURGENTNÍ  \n(pokud nejde o 112 / 155)\n\nNemocnice Tábor – ústředna: 381 608 111  \n\n────────────────────────\n\n🧠 6) PSYCHICKÁ, SOCIÁLNÍ A HUMANITÁRNÍ POMOC\n\nCelostátní linky  \n116 123 – Linka psychické pomoci  \n116 111 – Linka bezpečí  \n116 000 – Linka pro rodinu a školu  \n800 157 157 – Senior telefon  \n800 200 007 – Linka seniorů Elpida  \n\nMěsto Tábor:\nOS ČČK Tábor: 774 253 515  \nCharita Tábor – ústředna: 381 255 998  \nCharita Tábor – ředitelka: 736 256 987  \nAzylový dům G-centrum:  \n381 271 109 / 776 381 240  \n\n────────────────────────\n\n🛡️ 7) OBĚTI NÁSILÍ / TRESTNÉ ČINNOSTI\n\n116 006 – Pomoc obětem kriminality \n257 317 110 – Bílý kruh bezpečí  \n222 717 171 / 800 077 777 – La Strada  \n283 892 772 – ACORUS  \n773 177 636 / 800 922 922 – In IUSTITIA  \n\n────────────────────────\n\n👶 8) OHROŽENÉ DÍTĚ – OSPOD TÁBOR\n\nSociálně právní ochrana dětí – 381 486 420  \n\n────────────────────────\n\n🧪 9) HYGIENA / EPIDEMIE / KONTAMINACE POTRAVIN\n\nKHS Jihočeského kraje – ÚP Tábor:  \n387 712 410  \n\n────────────────────────\n\n📻 10) OFICIÁLNÍ INFORMACE V KRIZI\n\nOficiální kanály města Tábor  \nObecní rozhlas – PRIORITA  \nČeský rozhlas – záloha při výpadcích\n';
  body.textContent = CONTACTS_TEXT;

  // default show
  panel.hidden = false;

  // hide on typing, show again when empty
  q.addEventListener("input", () => {
    panel.hidden = q.value.trim().length > 0;
  }, { passive: true });

  // initial state safety
  panel.hidden = q.value.trim().length > 0;
})();

