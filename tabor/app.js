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

  const CONTACTS_TEXT = '=== KRIZOVÉ KONTAKTY – TELEFONY – TÁBOR (ORP) + ČR ===\n\n=== 1) TÍSŇOVÉ SLUŽBY (okamžitá pomoc – život, zdraví, majetek) ===\n112  – Evropské tísňové číslo (IZS) – non-stop, zdarma\n150  – Hasiči (HZS) – non-stop, zdarma\n155  – Záchranná služba (ZZS) – non-stop, zdarma\n158  – Policie ČR – non-stop, zdarma\n156  – Městská/obecní policie (pokud existuje) – typicky non-stop\n603 111 158 – SMS tísňová linka pro neslyšící – non-stop\n\n--- TÁBOR: rychlé lokální kontakty pro první hodiny ---\nMěsto Tábor – ústředna: 381 486 111\nMěsto Tábor – krizová/povodňová linka: 381 486 363\nMěstská policie Tábor (služebna / operační): 381 253 008\nPolicie ČR – ÚO/OO Tábor (ústředna/pevná linka): 974 238 111\nHZS Jihočeského kraje – ÚO/stanice Tábor (pevná linka): 950 221 111\n\n\n=== 2) KRIZOVÉ LINKY – PSYCHICKÁ / SOCIÁLNÍ POMOC (ČR) ===\n116 123 – Linka první psychické pomoci – non-stop, zdarma\n116 111 – Linka bezpečí (děti + studenti do 26 let) – non-stop, zdarma\n116 000 – Linka pro rodinu a školu – non-stop, zdarma\n800 157 157 – Senior telefon – non-stop, zdarma\n800 200 007 – Linka seniorů Elpida (8:00–20:00)\n\n--- TÁBOR: sociální pomoc, ubytování, humanitární pomoc ---\nOS ČČK Tábor (Český červený kříž – humanitární pomoc): 774 253 515\nCharita Tábor – info/ústředna: 381 255 998\nCharita Tábor – ředitelka: 736 256 987\nAzylový dům pro ženy a matky (G-centrum Tábor): 381 271 109 / 776 381 240\n\n\n=== 3) OBĚTI NÁSILÍ / TRESTNÉ ČINNOSTI (ČR) ===\n116 006 – Linka pomoci obětem kriminality / domácího násilí – non-stop, zdarma\n257 317 110 – Bílý kruh bezpečí (oběti TČ)\n222 717 171 / 800 077 777 – La Strada – pomoc obětem obchodování s lidmi\n283 892 772 – ACORUS – pomoc obětem násilí\n773 177 636 / 800 922 922 – In IUSTITIA / Poradna Justýna – násilí z nenávisti\n\n--- TÁBOR: když jde o akutní násilí / rabování / hrozby ---\n112 (akutní ohrožení)\n158 (Policie ČR)\n156 (Městská policie Tábor): 381 253 008\n974 238 111 (Policie ČR Tábor – neurgentní pevná linka)\n\n\n=== 4) DALŠÍ KRIZOVÉ, SPECIFICKÉ LINKY (ČR) ===\n606 021 021 – Rodičovská linka – poradenství rodičům\n+420 775 22 33 11 / +420 568 44 33 11 – Linka důvěry STŘED (09:00–21:00)\n585 414 600 – Krizová linka IPoradna.cz (18:00–06:00 všední, nonstop víkendy)\n227 272 225 – Krizová linka pomoci pro blízké pacientů – psychosociální podpora\n800 144 444 – Národní linka pomoci AIDS (pracovní doba)\n800 800 980 – Linka AIDS pomoci – nonstop\n\n\n=== 5) ENERGETIKA / INFRASTRUKTURA – PORUCHY A OHROŽENÍ (TÁBOR) ===\n--- PLYN ---\n1239 – Havárie / únik plynu – neodkladný zásah (GasNet)\n(volat při zápachu plynu / syčení)\n\n--- ELEKTŘINA (Jihočeský kraj = EG.D) ---\n800 22 55 77 – EG.D poruchy elektřiny – nonstop\n\n--- VODA / KANALIZACE (Tábor) ---\nVSTAB (Vodárenská společnost Táborsko) – havárie/poruchy: 722 933 636\n\n--- TEPLÁRNA / DÁLKOVÉ TEPLO (Tábor – výpadek tepla/TV) ---\nTeplárna Tábor / C-energy – centrála/hlášení: 381 417 202\n(Pokud máš bytový dům: současně kontaktuj správce / bytové družstvo / SVJ.)\n\n\n=== 6) ÚŘADY A SPRÁVA – KRIZOVÉ ROZHODOVÁNÍ (TÁBOR) ===\nMěsto Tábor – ústředna: 381 486 111\nMěsto Tábor – krizová/povodňová linka: 381 486 363\n\n--- DĚTI / OHROŽENÉ DÍTĚ (TÁBOR – OSPOD) ---\nOSPO\u200bD Tábor (SPOD – vybrané přímé linky):\n381 486 420\n381 486 426\n381 486 415\n381 486 413\n381 486 416\n\n\n=== 7) ZDRAVOTNICTVÍ – TÁBOR (když nejde jen o 155/112) ===\nNemocnice Tábor – ústředna: 381 608 111\n\n\n=== 8) HYGIENA / EPIDEMIE / KONTAMINACE POTRAVIN (TÁBOR) ===\nKrajská hygienická stanice JčK – ÚP Tábor: 387 712 410\n\n\n=== 9) DŮVĚRYHODNÉ INFORMACE V KRIZI (praktické) ===\nMěsto Tábor – oficiální informace: (sledovat, pokud funguje)\nObecní rozhlas / hlášení města: (priorita)\nČeský rozhlas (radio jako fallback): (priorita)\n\nPravidlo:\n„Když nevíš, kdo to říká → ignoruj.“\n';

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

