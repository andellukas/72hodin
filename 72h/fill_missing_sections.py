import json
import re
from copy import deepcopy
from datetime import datetime

def norm(s: str) -> str:
  s = (s or "").strip().lower()
  return s

def as_list(v):
  if v is None:
    return []
  if isinstance(v, list):
    return [str(x).strip() for x in v if str(x).strip()]
  if isinstance(v, str):
    s = v.strip()
    return [s] if s else []
  return []

def has_any(v):
  return len(as_list(v)) > 0

def tags_set(item):
  return set([norm(t) for t in as_list(item.get("tags"))])

def cat(item):
  return norm(item.get("category",""))

def qtext(item):
  return (item.get("q","") or "").strip()

# --- GENERIC SAFETY BLOCKS (fallback) ---
GENERIC_NOW = [
  "Zůstaň v klidu: zkontroluj, jestli nejsi v přímém ohrožení (oheň, plyn, padající věci).",
  "Zajisti světlo a komunikaci: čelovka/baterka, šetři baterii telefonu (úsporný režim).",
  "Získej informace: rádio (FM/DAB), obecní hlášení, ověř 2 nezávislé zdroje."
]
GENERIC_NEXT = [
  "Domluv si doma jednoduchý plán: kdo co dělá, kde je sraz, kontakt na příbuzné.",
  "Zkontroluj zásoby: voda, jídlo, léky, teplo, hygiena. Sepiš, co chybí.",
  "Minimalizuj rizika: odpoj zbytečné spotřebiče, připrav si hotovost a doklady."
]
GENERIC_H72 = [
  "Nastav režim šetření: energie, voda, baterie. Dělej jen nutné činnosti.",
  "Udržuj teplo/bezpečí: vrstvy oblečení, jedna místnost, větrání krátce a účelně.",
  "Průběžně aktualizuj informace a přizpůsob plán. Pokud se situace zhoršuje, odejdi včas."
]
GENERIC_DONT = [
  "Nešiř paniku ani neověřené zprávy. Nejednej impulzivně.",
  "Nehazarduj s ohněm/plynem/elektřinou. Nepřetěžuj prodlužky a zásuvky.",
  "Nezapomínej na děti/seniory/sousedku – zkontroluj zranitelné osoby."
]
GENERIC_CALL = [
  "155/112 při ohrožení života nebo vážném zranění.",
  "150 při požáru nebo zápachu kouře.",
  "112 při akutním nebezpečí, když nevíš, kam volat."
]

# --- CATEGORY/TAG TEMPLATES ---
TEMPLATES = []

def add_template(name, match_fn, now, nxt, h72, dont, call):
  TEMPLATES.append({
    "name": name,
    "match": match_fn,
    "now": now, "next": nxt, "h72": h72, "dont": dont, "call": call
  })

# VODA
add_template(
  "voda",
  lambda it: "voda" in tags_set(it) or "voda" in cat(it),
  now=[
    "Ověř rozsah: je voda jen u tebe (stoupačka/uzávěr) nebo v celé ulici? Zeptej se sousedů.",
    "Pokud hrozí únik (prasklé potrubí): zavři hlavní uzávěr vody v bytě/domu.",
    "Naplň nádoby, pokud voda krátce teče; vyhraď pitnou vodu zvlášť (čisté lahve)."
  ],
  nxt=[
    "Zaveď hygienický režim: mytí rukou minimalizuj, používej dezinfekci, jednorázové ubrousky.",
    "Zajisti vodu: rodina/sousedé, veřejné cisterny, obchody (pokud fungují), voda z bojleru jen pokud je bezpečná.",
    "Šetři splachování: používej kýbl/šedou vodu, pokud je to hygienicky možné."
  ],
  h72=[
    "Pitná voda: 2–3 l na osobu/den. Priorita pití, potom vaření, hygiena až nakonec.",
    "Pokud bereš vodu z alternativních zdrojů: převařit (min. 1 min varu) nebo použít ověřenou filtraci/dezinfekci.",
    "Sleduj pokyny obce/vodáren: kvalita vody, místa výdeje, zákaz používání."
  ],
  dont=[
    "Nepij neověřenou vodu (studna/řeka) bez úpravy. Riziko infekce.",
    "Nenechávej vodu v otevřených nádobách bez krytu (kontaminace).",
    "Neplýtvej pitnou vodou na úklid/splachování."
  ],
  call=[
    "Havarijní služba vodáren/správce domu při prasklém potrubí nebo vytápění vodou v domě.",
    "155/112 při příznacích těžké dehydratace, kolapsu, u malých dětí/seniorů.",
    "150 při zaplavení, které ohrožuje elektroinstalaci nebo vzniká riziko požáru."
  ]
)

# ELEKTŘINA / BLACKOUT
add_template(
  "elektrina",
  lambda it: ("elektrina" in tags_set(it)) or ("blackout" in tags_set(it)) or ("elektr" in cat(it)),
  now=[
    "Zkontroluj jističe a chránič. Pokud se hned znovu vypíná, odpoj podezřelý spotřebič.",
    "Vytáhni citlivou elektroniku ze zásuvek (ochrana před přepětím při návratu proudu).",
    "Světlo: čelovka/baterka. Svíčky jen s dohledem a stabilním podkladem."
  ],
  nxt=[
    "Teplo: uzavři okna, soustřeď se do jedné místnosti, vrstvi oblečení.",
    "Jídlo: lednice/mrazák neotvírat zbytečně. Spotřebuj nejdřív to, co se kazí.",
    "Informace: rádio na baterie/autě, pokyny obce/distributora. Domluv sousedskou výpomoc."
  ],
  h72=[
    "Nabíjení: powerbanka, auto adaptér. Nastav režim komunikace (SMS, krátké hovory).",
    "Voda/vaření: pokud nefunguje elektrický sporák, připrav alternativu (plyn vařič jen s větráním).",
    "Bezpečnost: zkontroluj seniory, výtahy nepoužívej, hlídej požární rizika."
  ],
  dont=[
    "Nezapínej najednou všechny spotřebiče po návratu proudu (může shodit síť/jističe).",
    "Nezahřívej byt otevřeným plamenem bez větrání (CO, požár).",
    "Nenechávej svíčky bez dozoru."
  ],
  call=[
    "155/112 při úrazu, ztrátě vědomí, podezření na otravu kouřem/CO.",
    "150 při požáru nebo zápachu spáleniny z rozvodů.",
    "Distributora/správce, pokud jde o závadu jen v domě (jističe v rozvaděči, stoupačky)."
  ]
)

# TEplo / chlad / topení
add_template(
  "teplo",
  lambda it: ("teplo" in tags_set(it)) or ("zima" in tags_set(it)) or ("topeni" in tags_set(it)) or ("teplo" in cat(it)) or ("topen" in cat(it)),
  now=[
    "Zkrať prostor: zavři dveře, vyber jednu místnost a izoluj ji (deky, závěsy).",
    "Vrstvy: čepice, suché ponožky, více tenkých vrstev. Přikrývky a spacáky.",
    "Bezpečný zdroj tepla jen s větráním a dohledem (riziko CO/požáru)."
  ],
  nxt=[
    "Ucpěj průvan: utěsni okna/dveře, rohože, textilie. Větrej krátce a intenzivně.",
    "Teplé nápoje/jídlo, pohyb v bytě. Sleduj děti a seniory (rychleji prochladnou).",
    "Zajisti alternativní ohřev vody a světlo (baterky, powerbanky)."
  ],
  h72=[
    "Hlídej teplotu a příznaky podchlazení (třes, zmatenost, ospalost).",
    "Spánek: co nejvíc izolace od podlahy (karimatka, deky).",
    "Pokud teplota dlouhodobě klesá a nejste vybavení, zvaž přesun k rodině/evakuačnímu místu."
  ],
  dont=[
    "Nezahřívej byt grilem/uhlím uvnitř (CO).",
    "Nenechávej otevřený oheň bez dozoru.",
    "Nepij alkohol na zahřátí (zhoršuje podchlazení)."
  ],
  call=[
    "155/112 při příznacích podchlazení, kolapsu, u dětí/seniorů.",
    "150 při požáru nebo zakouření.",
    "Správce/servis při havárii topení/unikající vodě v topném systému."
  ]
)

# ZDRAVÍ / DUŠENÍ / ASTMA (bez detailní léčby – bezpečné a obecné)
add_template(
  "astma",
  lambda it: ("astma" in tags_set(it)) or ("duseni" in tags_set(it)) or ("dech" in tags_set(it)) or ("astma" in qtext(it).lower()),
  now=[
    "Pokud je dušnost těžká, zhoršuje se, nebo je modrání rtů/zmatenost: volej 155/112 hned.",
    "Posaď se do pohodlné polohy, uvolni těsné oblečení, soustřeď se na pomalý výdech.",
    "Zajisti čerstvý vzduch, odejdi od kouře, prachu, parfémů a dalších spouštěčů."
  ],
  nxt=[
    "Zkontroluj zásobu léků/pomůcek, pokud je máš doma. Ulož je na jedno místo a chraň před chladem/teplem.",
    "Minimalizuj spouštěče: kouř, prach, plísně, zvířecí srst. Krátce vyvětrej a setři prach.",
    "Domluv plán: kdo volá pomoc, kdo jde pro léky, seznam alergií a diagnóz na papír."
  ],
  h72=[
    "Sleduj příznaky: zhoršování dušnosti, sípání, únava, neschopnost mluvit v celých větách.",
    "Zajisti možnost kontaktu s lékařem/lékárnou, jakmile je to možné. Připrav seznam léků a dávek.",
    "Měj připravené doklady, kartičku pojištěnce a info pro záchranáře (diagnózy, alergie)."
  ],
  dont=[
    "Neodkládej volání pomoci při těžké dušnosti. Nečekej „až to přejde“. ",
    "Nevystavuj se kouři a dráždivým aerosolům (svíčky bez větrání, chemie).",
    "Nevynucuj námahu při zhoršování dýchání."
  ],
  call=[
    "155/112 při dechové tísni, modrání, zmatenosti, kolapsu, nebo když se stav rychle zhoršuje.",
    "Kontakt lékaře co nejdřív při opakovaném zhoršování i bez akutní tísně.",
    "Pokud nejste si jistí závažností, volej 112 – v panice raději dřív."
  ]
)

# OBECNÝ POŽÁR / KOUŘ
add_template(
  "pozar",
  lambda it: ("pozar" in tags_set(it)) or ("kour" in tags_set(it)) or ("pozar" in cat(it)) or ("kouř" in qtext(it).lower()) or ("požár" in qtext(it).lower()),
  now=[
    "Když je kouř/ohně: okamžitě ven, zavři dveře za sebou, nechoď do kouře.",
    "Volej 150 nebo 112, uveď adresu, patro, co hoří, jestli jsou lidé uvnitř.",
    "Nepoužívej výtah. Pokud jdeš kouřem, drž se při zemi a kryj ústa látkou."
  ],
  nxt=[
    "Po opuštění prostoru se neschovávej zpět pro věci. Zkontroluj všechny členy domácnosti.",
    "Pokud máš lehký hasicí přístroj a je to bezpečné: jen malý začátek požáru, úniková cesta zajištěná.",
    "Informuj sousedy jen pokud to nezdržuje únik (klepání, zvonek)."
  ],
  h72=[
    "Po zásahu: větrej až po pokynu hasičů. Nezapínej elektřinu/plyn bez kontroly.",
    "Sepiš škody, fotodokumentace, kontakt pojišťovny.",
    "Pokud je byt neobyvatelný, řeš náhradní ubytování přes obec/rodinu."
  ],
  dont=[
    "Nehas vodu na elektrických zařízeních nebo olej/ tuk (kuchyň).",
    "Nevracej se do zakouřeného prostoru.",
    "Neotevírej prudce dveře do místnosti s požárem (přísun kyslíku)."
  ],
  call=[
    "150 při požáru, 112 při akutním ohrožení.",
    "155 při nadýchání kouře, popáleninách, bezvědomí.",
    "Plynárenská pohotovost při zápachu plynu po požáru."
  ]
)

def choose_template(item):
  for t in TEMPLATES:
    if t["match"](item):
      return t
  return None

def merge_fill(item, tpl):
  # Preserve existing arrays if non-empty; fill only missing/empty
  out = deepcopy(item)

  # ensure keys exist as lists for renderer
  for k in ["panic","now","next","h72","dont","call","tags"]:
    if k in out:
      out[k] = as_list(out.get(k))
    else:
      # keep missing as missing? better: ensure list for consistency
      out[k] = []

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

  # minimal provenance marker (optional but useful)
  out.setdefault("_meta", {})
  if isinstance(out["_meta"], dict):
    out["_meta"].setdefault("filled_at", datetime.utcnow().isoformat(timespec="seconds")+"Z")
    out["_meta"].setdefault("filled_by", "fill_missing_sections.py")
    out["_meta"]["template"] = (tpl["name"] if tpl else "generic")
  return out

def stats(items):
  def cnt(key):
    return sum(1 for it in items if has_any(it.get(key)))
  def empty(key):
    return sum(1 for it in items if not has_any(it.get(key)))
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
