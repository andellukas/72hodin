import json
from copy import deepcopy
from datetime import datetime

def norm(s: str) -> str:
  return (s or "").strip().lower()

def as_list(v):
  if v is None: return []
  if isinstance(v, list):
    return [str(x).strip() for x in v if str(x).strip()]
  if isinstance(v, str):
    s = v.strip()
    return [s] if s else []
  return []

def has_any(v): return len(as_list(v)) > 0

def tags_set(item):
  return set(norm(t) for t in as_list(item.get("tags")))

def cat(item): return norm(item.get("category",""))
def qtext(item): return (item.get("q","") or "").strip().lower()

# ------------------------
# GENERIC (fallback) – kvalitní minimum
# ------------------------
GENERIC_NOW = [
  "Zajisti bezpečí: oheň/kouř/plyn/CO/padající věci? Pokud ano, okamžitě ven a volej 112/150.",
  "Světlo a komunikace: čelovka/baterka, telefon úsporný režim, SMS, powerbanka.",
  "Získej informace: rádio (FM/DAB), obecní hlášení, ověř 2 nezávislé zdroje (ne sdílené fámy).",
  "Domluv doma plán na papír: kdo je kde, kontakty, místo srazu, pravidlo „jeden hlídá děti/seniory“."
]
GENERIC_NEXT = [
  "Zkontroluj zásoby: voda, jídlo, léky, hygiena, teplo. Sepiš chybějící věci a prioritu.",
  "Minimalizuj rizika: odpoj zbytečné spotřebiče, připrav hotovost, doklady, klíče, základní lékárničku.",
  "Sousedská kontrola: ověř seniory a zranitelné osoby v okolí.",
  "Nastav režim šetření: baterie/energie/voda; plánuj krátké intervaly kontroly zpráv."
]
GENERIC_H72 = [
  "Udržuj bezpečí a teplo: vrstvy oblečení, jedna místnost, izolace od podlahy, větrání krátce a účelně.",
  "Hygiena a prevence: mytí rukou/dezinfekce, bezpečná voda, šetrné nakládání s odpadem.",
  "Průběžně aktualizuj plán podle pokynů obce/integrovaného systému. Připrav se na evakuaci, pokud se situace zhoršuje."
]
GENERIC_DONT = [
  "Nešiř neověřené zprávy, nejednej impulzivně a nevycházej do rizika „jen se podívat“.",
  "Nehazarduj s ohněm/plynem/elektřinou. Nepřetěžuj prodlužky ani improvizované topení bez větrání.",
  "Nenechávej děti bez dozoru v krizové situaci; hlídej i domácí zvířata.",
  "Nezapomeň na léky a zdravotní potřeby – u rizikových osob se situace zhorší rychle."
]
GENERIC_CALL = [
  "155/112 při ohrožení života, vážném zranění, bezvědomí, dušnosti, krvácení, podezření na otravu CO.",
  "150 při požáru nebo silném kouři.",
  "112 při akutním nebezpečí, kdy nevíš, koho volat, nebo když nejde jiné číslo."
]

# ------------------------
# TEMPLATES – pravidlové doplňování
# ------------------------
TEMPLATES = []

def add_template(name, match_fn, now, nxt, h72, dont, call):
  TEMPLATES.append({
    "name": name,
    "match": match_fn,
    "now": now, "next": nxt, "h72": h72, "dont": dont, "call": call
  })

# Helper matchers
def has_tag(it, *tags):
  ts = tags_set(it)
  return any(norm(t) in ts for t in tags)

def in_cat(it, *subs):
  c = cat(it)
  return any(norm(s) in c for s in subs)

def q_has(it, *subs):
  q = qtext(it)
  return any(norm(s) in q for s in subs)

# ------------------------
# VODA (vylepšené)
# ------------------------
add_template(
  "voda",
  lambda it: has_tag(it,"voda","netece voda","hygiena") or in_cat(it,"voda"),
  now=[
    "Ověř rozsah: je voda jen u tebe (uzávěr/stoupačka), nebo v celé ulici? Zeptej se sousedů.",
    "Pokud je únik/prasklé potrubí: zavři hlavní uzávěr vody v bytě/domu a chraň elektroinstalaci před vodou.",
    "Pokud voda krátce teče: naplň čisté lahve/kanystry a vyhraď pitnou vodu zvlášť (uzavíratelně).",
    "Zapiš stav: kolik máte pitné vody a na kolik dní vystačí."
  ],
  nxt=[
    "Zaveď hygienický režim: dezinfekce rukou, ubrousky, šetřit splachování (jen nutně).",
    "Zajisti zdroj: obecní cisterny/výdej, rodina, sousedé; domluv donášku pro seniory.",
    "Pokud bereš vodu z alternativy: připrav možnost převaření/ověřené filtrace a čisté nádoby."
  ],
  h72=[
    "Pitná voda: cíl 2–3 l/osoba/den. Priorita pití, pak vaření, hygiena až nakonec.",
    "Bezpečnost vody: u neznámého zdroje raději převařit (min. 1 minuta varu) nebo použít ověřenou úpravu.",
    "Sleduj pokyny obce/vodáren: místa výdeje, kvalita vody, zákaz používání."
  ],
  dont=[
    "Nepij neověřenou vodu bez úpravy (studna/řeka). Riziko průjmů a infekcí.",
    "Nenechávej vodu otevřenou bez krytu (kontaminace). Neplýtvej pitnou vodou na úklid.",
    "Nepodceň děti a seniory – dehydratace přichází rychleji."
  ],
  call=[
    "Havarijní služba/správce domu při prasklém potrubí, zatékání, nebo když voda ohrožuje elektřinu.",
    "155/112 při kolapsu, příznacích těžké dehydratace, u malých dětí/seniorů.",
    "150 při riziku požáru/zakouření způsobeném zkratem po zatečení."
  ]
)

# ------------------------
# ELEKTŘINA / BLACKOUT (vylepšené)
# ------------------------
add_template(
  "elektrina_blackout",
  lambda it: has_tag(it,"elektrina","blackout","proud","vypadek proudu") or in_cat(it,"elektr") or q_has(it,"nejde proud","vypadek proudu","blackout"),
  now=[
    "Zkontroluj jističe a proudový chránič. Pokud se hned znovu vypíná, odpoj podezřelý spotřebič.",
    "Vytáhni citlivou elektroniku ze zásuvek (ochrana proti přepětí při návratu proudu).",
    "Světlo: čelovka/baterka. Svíčky jen s dohledem a na nehořlavém podkladu.",
    "Pokud nefunguje celý dům: zjisti info u sousedů/správce/distributora (SMS/rádio)."
  ],
  nxt=[
    "Jídlo: lednici a mrazák neotvírat zbytečně. Seřaď potraviny podle kazivosti a plán spotřeby.",
    "Teplo: jedna místnost, vrstvy, izolace od podlahy. Připrav deky/spacáky.",
    "Voda a vaření: pokud máš jen elektrický sporák, připrav studenou variantu jídla.",
    "Nabíjení: powerbanka, auto adaptér. Domluv časové okno komunikace (šetří baterii)."
  ],
  h72=[
    "Bezpečnost: pozor na výtahy, tmu na schodišti, riziko pádů. Zkontroluj seniory v okolí.",
    "Po návratu proudu zapínej spotřebiče postupně (nejdřív světla, pak lednice, až pak zbytek).",
    "Sleduj pokyny obce/distributora a připrav evakuační batoh, pokud se situace protahuje."
  ],
  dont=[
    "Nezapínej najednou všechny spotřebiče po návratu proudu (může to shodit jističe).",
    "Nezahřívej byt grilem/uhlím uvnitř. Nepřetěžuj prodlužky a improvizované rozvody.",
    "Nenechávej svíčky bez dozoru; nechoď potmě bez světla."
  ],
  call=[
    "150 při požáru/zakouření/hoření kabelů. 155/112 při úrazu, bezvědomí, podezření na otravu kouřem/CO.",
    "Správce/distributor při lokální závadě v domě (rozvaděč, stoupačky).",
    "112 při nebezpečí a nejistotě, kam volat."
  ]
)

# ------------------------
# PLYN / ZÁPACH PLYNU / CO (kritické)
# ------------------------
add_template(
  "plyn_co",
  lambda it: has_tag(it,"plyn","unik plynu","zapach plynu","co","oxid uhelnaty","kotle","karma","topeni plyn") or in_cat(it,"plyn") or q_has(it,"zápach plynu","unik plynu","plyn","oxid uhelnat"),
  now=[
    "Pokud cítíš plyn: NEZAPÍNEJ/VYPÍNEJ elektřinu (žádné vypínače), nezapaluj oheň, nevolej z místnosti.",
    "Okamžitě otevři okna/dveře a vyvětrej. Zavři hlavní uzávěr plynu, pokud to jde bezpečně.",
    "Vyveď všechny osoby ven (hlavně děti/seniory).",
    "Zvenku volej plynárenskou pohotovost nebo 112, uveď adresu a situaci."
  ],
  nxt=[
    "Nevracej se dovnitř, dokud to nepovolí odborník. Informuj sousedy, pokud to nezvyšuje riziko.",
    "Zkontroluj zdroje: sporák, kotel, karma. Nech zařízení zkontrolovat odborně.",
    "Pokud je podezření na CO (bolest hlavy, nevolnost, ospalost): okamžitě ven a 155/112."
  ],
  h72=[
    "Bezpečný provoz: pravidelný servis spotřebičů, CO hlásič, větrání při provozu.",
    "Měj plán: kde je uzávěr plynu, koho volat, kde se sejdete venku.",
    "Pokud je plyn odstaven: plán vaření (studené jídlo) a tepla (vrstvy, jedna místnost)."
  ],
  dont=[
    "Nevytvářej jiskru: žádné vypínače, zvonky, zapalovače, nabíjení, dokud je plyn v prostoru.",
    "Neignoruj příznaky CO. CO je bez zápachu a může zabít ve spánku.",
    "Neřeš to „sám“ opravami – zavolej odborníky."
  ],
  call=[
    "112 při podezření na únik plynu nebo když je riziko výbuchu.",
    "155 při příznacích otravy CO (bolest hlavy, zvracení, zmatenost, ospalost).",
    "Plynárenská pohotovost / hasiči při úniku a nutnosti zajištění prostoru."
  ]
)

# ------------------------
# SIRÉNY / ÚTOK / OHROŽENÍ (civilní ochrana – bezpečné)
# ------------------------
add_template(
  "sireny_utok",
  lambda it: has_tag(it,"sireny","utok","valka","strelba","ohrozeni","kryt","ukryt") or q_has(it,"siréna","sireny","útok","výbuch","ostřelován","bombard"),
  now=[
    "Okamžitě vyhledej nejbližší bezpečný úkryt: suterén, vnitřní místnost bez oken, chodba/šachta. Vzdálit se od oken.",
    "Vypni otevřený oheň, vezmi telefon/powerbanku, doklady, léky, vodu – jen co je po ruce (max 60 sekund).",
    "Zavři okna, stáhni žaluzie/rolety, zavři dveře. Lehkni/klekněte k nosné zdi, chraň hlavu.",
    "Získej informace: rádio, oficiální pokyny obce/integrovaného systému. Krátké SMS rodině „jsem v bezpečí“."
  ],
  nxt=[
    "Domluv pravidla: kdo hlídá děti, kde je sraz, co berete při evakuaci (go-bag).",
    "Připrav úkryt: voda, deky, léky, baterka, nabíjení, základní hygienické věci.",
    "Omez pohyb venku. Pokud musíš ven, jdi rychle, bez zbytečných zastávek, vyhýbej se otevřeným prostranstvím."
  ],
  h72=[
    "Zaveď režim: kontrola zpráv v intervalech, šetření baterie, udržuj psychickou stabilitu (rutina, spánek).",
    "Připrav evakuaci: batoh pro každého, kopie dokladů, hotovost, voda/jídlo na cestu, léky na několik dní.",
    "Sleduj signály k evakuaci a drž se pokynů úřadů. Pomoz zranitelným osobám, pokud je to bezpečné."
  ],
  dont=[
    "Nezůstávej u oken a na balkonech, nefotografuj z nebezpečných míst, nezdržuj se venku.",
    "Nejezdi zbytečně autem (ucpání komunikací). Nešiř neověřené zprávy.",
    "Nevracej se pro věci, pokud je riziko. Bezpečí má absolutní prioritu."
  ],
  call=[
    "112 při bezprostředním ohrožení, zranění, nebo když vidíš požár/výbuch a je potřeba zásah.",
    "155 při vážném krvácení, bezvědomí, poranění hlavy, dušnosti.",
    "150 při požáru po výbuchu/útoku."
  ]
)

# ------------------------
# EVAKUACE (kritické)
# ------------------------
add_template(
  "evakuace",
  lambda it: has_tag(it,"evakuace","opustit dum","utek") or q_has(it,"evakuace","evakuovat","opustit byt","opustit dům"),
  now=[
    "Pokud je nařízena evakuace: odejdi hned. Vezmi doklady, léky, telefon, nabíjení, klíče, vodu – minimum.",
    "Vypni plyn/elektřinu/vodu, pokud je čas a je to bezpečné. Zavři okna, zamkni.",
    "Jdi podle pokynů (shromaždiště, trasa). Pomoz dětem/seniorům, ale nezdržuj se balením.",
    "Dej rodině SMS: kam jdeš / kdy přibližně dorazíš / náhradní kontakt."
  ],
  nxt=[
    "Na místě: registrace, informace, základní potřeby. Drž se skupiny, hlídej děti.",
    "Zaznamenej: komu jsi předal info, kde jste ubytovaní, kontakty na úřady.",
    "Pokud evakuace není organizovaná: domluv bezpečné místo u rodiny mimo rizikovou oblast."
  ],
  h72=[
    "Režim přežití: hydratace, teplo, hygiena. Průběžně doplňuj informace a šetři energii.",
    "Důležité dokumenty: fotky dokladů v telefonu + papírová kopie v batohu.",
    "Po návratu domů až po povolení. Před vstupem kontroluj plyn/kouř/statiku."
  ],
  dont=[
    "Nečekej „ještě chvilku“ při nařízené evakuaci. Nejezdi do uzavíraných zón.",
    "Nezdržuj se balením věcí. Neber zbytečnosti na úkor léků/dokladů.",
    "Neignoruj pokyny složek IZS."
  ],
  call=[
    "112 při zranění, uvíznutí, ohrožení na trase, nebo když nemůžeš evakuovat z vážných důvodů.",
    "155 při zdravotním zhoršení (dušnost, kolaps).",
    "150 při požáru, který brání evakuaci."
  ]
)

# ------------------------
# POVODEŇ / ZAPLAVENÍ (kritické)
# ------------------------
add_template(
  "povoden",
  lambda it: has_tag(it,"povoden","zaplava","zatop") or q_has(it,"povodeň","záplava","zatopen","voda v bytě","stoupa"),
  now=[
    "Pokud voda rychle stoupá: jdi do vyšších pater / na vyvýšené místo. Nečekej na poslední chvíli.",
    "Vypni elektřinu hlavním jističem, pokud je to bezpečné a není voda u rozvaděče. Pozor na úraz proudem.",
    "Přesuň doklady, léky, mobil, nabíjení a pár věcí do batohu a dej je do výšky.",
    "Nechoď do vody s neznámou hloubkou/proudem. Volej pomoc, pokud hrozí uvěznění."
  ],
  nxt=[
    "Zabezpeč byt: ucpání průsaků jen pokud bezpečné. Sleduj pokyny obce (evakuace, uzávěry).",
    "Pitná voda: počítej s kontaminací. Používej balenou nebo bezpečně upravenou vodu.",
    "Zdraví: po kontaktu s povodňovou vodou očisti kůži, drobná poranění dezinfikuj (riziko infekce)."
  ],
  h72=[
    "Po opadnutí vody vstupuj až po povolení. Pozor na elektřinu, plyn, statiku, plísně.",
    "Větrej, odstraň mokré materiály, dokumentuj škody. Používej rukavice/ochranu dýchacích cest při úklidu.",
    "Zajisti odvoz odpadu a dezinfekci. Sleduj zdravotní potíže (průjmy, horečky)."
  ],
  dont=[
    "Nechoď do vody, kde může být elektřina. Nejezdi autem do zatopených míst.",
    "Nenechávej děti v blízkosti vody a rozbahněných sklepů.",
    "Nepij vodu, u které si nejsi jistý původem a kvalitou."
  ],
  call=[
    "112 při uvěznění, rychlém stoupání vody, ohrožení života.",
    "150 při záchranných pracích, evakuaci, riziku požáru/elektro-závad.",
    "155 při zranění, podchlazení, infekčních příznacích po kontaktu s povodňovou vodou."
  ]
)

# ------------------------
# BOUŘE / VÍTR / STROMY / KROUPY
# ------------------------
add_template(
  "boure_vitr",
  lambda it: has_tag(it,"boure","vitr","kroupy","storm","vichr") or q_has(it,"bouře","vichr","kroupy","silný vítr"),
  now=[
    "Zůstaň uvnitř, zavři okna, stáhni rolety/žaluzie. Drž se dál od oken.",
    "Odpoj citlivou elektroniku ze zásuvek (přepětí). Připrav baterku a powerbanku.",
    "Venku: nechoď pod stromy a konstrukce, vyhni se volným předmětům a vedení.",
    "Zkontroluj, jestli něco nehrozí pádem na balkoně/okně – zajisti to, pokud je to bezpečné."
  ],
  nxt=[
    "Po přechodu bouře zkontroluj škody jen bezpečně: pozor na spadlé dráty a nestabilní větve.",
    "Pokud je výpadek proudu, přepni na blackout režim (světlo, rádio, šetření).",
    "Zkontroluj sousedy, hlavně seniory, pokud je to bezpečné."
  ],
  h72=[
    "Řeš opravy bezpečně: provizorní zakrytí střechy jen bez rizika pádu. Jinak čekej na odborníky.",
    "Dokumentuj škody pro pojišťovnu. Sleduj varování před další vlnou počasí.",
    "Měj připravený plán na další výpadky (baterie, voda, jídlo)."
  ],
  dont=[
    "Nechoď k popadanému vedení. Nelez na střechu za větru nebo mokra.",
    "Neparkuj pod stromy. Nezdržuj se venku při kroupách a silném větru.",
    "Neodkládej řešení rizik (uvolněné tašky, hrozící pád) – ale řeš to bezpečně."
  ],
  call=[
    "112/150 při bezprostředním ohrožení (spadlé vedení, požár, uvěznění).",
    "155 při zranění.",
    "Správce/servis při nebezpečné statice/poškození budovy."
  ]
)

def choose_template(item):
  for t in TEMPLATES:
    if t["match"](item):
      return t
  return None

def merge_fill(item, tpl):
  out = deepcopy(item)

  # normalize fields
  for k in ["panic","now","next","h72","dont","call","tags"]:
    if k in out:
      out[k] = as_list(out.get(k))
    else:
      out[k] = []

  # fill only if missing/empty
  if not has_any(out.get("now")):
    out["now"] = tpl["now"] if tpl else GENERIC_NOW
  if not has_any(out.get("next")):
    out["next"] = tpl["next"] if tpl else GENERIC_NEXT
  if not has_any(out.get("h72")):
    out["h72"] = tpl["h72"] if tpl else GENERIC_H72
  if not has_any(out.get("dont")):
    out["dont"] = tpl["dont"] if tpl else GENERIC_DONT
  if not has_any(out.get("call")):
    out["call"] = tpl["call"] if tpl else GENERIC_CALL

  out.setdefault("_meta", {})
  if isinstance(out["_meta"], dict):
    out["_meta"].setdefault("filled_at", datetime.utcnow().isoformat(timespec="seconds")+"Z")
    out["_meta"].setdefault("filled_by", "fill_missing_sections.py")
    out["_meta"]["template"] = (tpl["name"] if tpl else "generic")
  return out

def stats(items):
  def cnt(key): return sum(1 for it in items if has_any(it.get(key)))
  def empty(key): return sum(1 for it in items if not has_any(it.get(key)))
  return {
    "total": len(items),
    "nonempty_now": cnt("now"),
    "nonempty_next": cnt("next"),
    "nonempty_h72": cnt("h72"),
    "nonempty_dont": cnt("dont"),
    "nonempty_call": cnt("call"),
    "empty_now": empty("now"),
    "empty_next": empty("next"),
    "empty_h72": empty("h72"),
    "empty_dont": empty("dont"),
    "empty_call": empty("call"),
  }

def main():
  with open("faq.json","r",encoding="utf-8") as f:
    items = json.load(f)

  before = stats(items)
  filled = []
  for it in items:
    tpl = choose_template(it)
    filled.append(merge_fill(it, tpl))
  after = stats(filled)

  with open("faq.filled.json","w",encoding="utf-8") as f:
    json.dump(filled, f, ensure_ascii=False, indent=2)

  print("=== STATS BEFORE ===")
  print(json.dumps(before, ensure_ascii=False, indent=2))
  print("=== STATS AFTER ===")
  print(json.dumps(after, ensure_ascii=False, indent=2))
  print("WROTE: faq.filled.json")

if __name__ == "__main__":
  main()
