(async function(){
  const el = document.getElementById("app");

  function h(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs||{})){
      if(k==="class") n.className=v;
      else if(k==="html") n.innerHTML=v;
      else if(k==="value") n.value=v;
      else n.setAttribute(k, v);
    }
    for(const c of (children||[])) n.appendChild(typeof c==="string"?document.createTextNode(c):c);
    return n;
  }

  function parseHash(){
    // "#path?x=y"
    const raw = (location.hash || "#").slice(1);
    const [path, qs] = raw.split("?");
    const q = {};
    if(qs){
      for(const part of qs.split("&")){
        const [k,v] = part.split("=");
        if(k) q[decodeURIComponent(k)] = decodeURIComponent(v||"");
      }
    }
    return { path: path || "", q };
  }

  async function loadJSON(url){
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) throw new Error(`Missing: ${url}`);
    return r.json();
  }

  function setTheme(theme){
    if(!theme) return;
    const root = document.documentElement;
    for(const [k,v] of Object.entries(theme)){
      root.style.setProperty(`--${k}`, v);
    }
  }

  const city = await loadJSON("../cities/tabor/city.json");
  setTheme(city.theme);

  const contacts = await loadJSON("../cities/tabor/contacts.json").catch(()=>null);
  const scenariosPayload = await loadJSON("../cities/tabor/scenarios.json").catch(()=>null);
  const scenarios = (scenariosPayload && scenariosPayload.scenarios) ? scenariosPayload.scenarios : [];
  const scenarioById = Object.fromEntries(scenarios.map(s => [s.id, s]));

  function render(node){
    el.innerHTML="";
    el.appendChild(node);
  }

  function header(title, subtitle){
    return h("div",{class:"header"},[
      h("div",{class:"brand"},[
        h("b",{},[title]),
        h("span",{},[subtitle||""])
      ])
    ]);
  }

  function btn(href, label, cls="btn"){
    return h("a",{class:cls,href},[label]);
  }

  function screenHome(){
    const container = h("div",{class:"container"});
    container.append(
      header(city.appTitle||"72 hodin – Tábor","Offline krizový manuál (v2)"),
      h("div",{class:"grid"},[
        btn("#panic","🆘 PANIKA – JDE O ŽIVOT","btn panic"),
        btn("#where","📍 KDE JSEM / CO SE DĚJE","btn"),
        btn("#situations","📚 SITUACE (všechny)","btn"),
        btn("#contacts","📞 POMOC & KONTAKTY","btn")
      ]),
      h("div",{class:"small",style:"margin-top:10px"},[`Stav: ${navigator.onLine ? "online" : "offline"}`])
    );
    return container;
  }

  function screenPanic(){
    const container = h("div",{class:"container"});
    container.append(
      h("div",{class:"card"},[
        h("b",{},["TEĎ (1–3 min): ZASTAV PANIKU"]),
        h("div",{class:"small",style:"margin-top:8px"},[
          "ZASTAV SE. Nadechni nosem, vydechni pusou (5×). Rozhlédni se: jsem v bezpečí? Zkontroluj zranění/krev/zmatenost. Pokud ano: volej."
        ]),
        h("div",{class:"row",style:"margin-top:12px"},[
          h("a",{class:"pill call",href:"tel:112"},[h("b",{},["📞 112"]), "IZS"]),
          h("a",{class:"pill call",href:"tel:155"},[h("b",{},["📞 155"]), "Záchranka"]),
          h("a",{class:"pill call",href:"tel:158"},[h("b",{},["📞 158"]), "Policie"]),
          h("a",{class:"pill call",href:"tel:150"},[h("b",{},["📞 150"]), "Hasiči"])
        ]),
        h("div",{style:"margin-top:12px"},[ btn("#","⬅ ZPĚT","btn") ])
      ])
    );
    return container;
  }

  function screenWhere(){
    const container = h("div",{class:"container"});
    container.append(
      h("div",{class:"card"},[
        h("b",{},["KDE JSEM / CO SE DĚJE"]),
        h("div",{class:"small",style:"margin-top:8px"},[
          "Vyber stav. Nejde o dokonalý výběr – jde o rychlé navedení."
        ]),
        h("div",{class:"grid",style:"margin-top:12px"},[
          btn("#situations?ctx=doma","🏠 JSEM DOMA / V BUDOVĚ","btn"),
          btn("#situations?ctx=venku","🚶 JSEM VENKU","btn"),
          btn("#situations?ctx=cizi","🏙 JSEM V CIZÍM MÍSTĚ","btn"),
          btn("#situations?ctx=ukryt","🚨 NEBEZPEČNO VENKU / ÚKRYT","btn"),
          btn("#situations?ctx=elektrina","⚡ VYPADLA ELEKTŘINA","btn"),
          btn("#situations?ctx=voda","🚰 NETEČE VODA","btn"),
          btn("#situations?ctx=jidlo","🥣 NENÍ JÍDLO","btn")
        ]),
        h("div",{style:"margin-top:12px"},[ btn("#","⬅ ZPĚT","btn") ])
      ])
    );
    return container;
  }

  function scenarioMatchesCtx(s, ctx){
    if(!ctx) return true;
    const t = (s.title || "").toLowerCase();
    if(ctx==="voda") return t.includes("voda");
    if(ctx==="elektrina") return t.includes("elektřina") || t.includes("elektrina");
    if(ctx==="jidlo") return t.includes("jídlo") || t.includes("jidlo");
    if(ctx==="ukryt") return t.includes("ukryt");
    // doma/venku/cizi: zatím neděláme “chytré” tagy – fail-closed: ukážeme vše
    return true;
  }

  function screenSituations(q){
    const container = h("div",{class:"container"});
    const ctx = q.ctx || "";
    const input = h("input",{placeholder:"Hledej situaci…", value:"", style:"margin-top:10px"});
    const list = h("div",{class:"card"},[]);

    function draw(){
      const needle = (input.value||"").toLowerCase().trim();
      list.innerHTML="";
      const filtered = scenarios
        .filter(s => scenarioMatchesCtx(s, ctx))
        .filter(s => !needle || (s.title||"").toLowerCase().includes(needle));

      list.appendChild(h("b",{},[ctx ? `SITUACE (${ctx})` : "SITUACE"]));
      list.appendChild(h("div",{class:"small",style:"margin-top:8px"},[
        filtered.length ? `${filtered.length} položek` : "Nic nenalezeno."
      ]));

      for(const s of filtered){
        list.appendChild(
          h("div",{style:"margin-top:10px"},[
            h("a",{class:"pill",href:`#s/${encodeURIComponent(s.id)}`},[s.title])
          ])
        );
      }

      list.appendChild(h("div",{style:"margin-top:12px"},[ btn("#","⬅ ZPĚT","btn") ]));
    }

    input.addEventListener("input", draw);

    container.append(
      header(city.appTitle||"72 hodin – Tábor","Situace (v2)"),
      input,
      list
    );
    draw();
    return container;
  }

  function screenScenario(id){
    const s = scenarioById[id];
    const container = h("div",{class:"container"});

    if(!s){
      container.append(
        h("div",{class:"card"},[
          h("b",{},["Scénář nenalezen"]),
          h("div",{class:"small",style:"margin-top:8px"},[id]),
          h("div",{style:"margin-top:12px"},[ btn("#situations","⬅ ZPĚT","btn") ])
        ])
      );
      return container;
    }

    const card = h("div",{class:"card"},[
      h("b",{},[s.title]),
      h("div",{class:"small",style:"margin-top:8px"},["Čti shora. V krizi: nejdřív TEĎ."])
    ]);

    for(const sec of (s.sections||[])){
      const box = h("div",{class:"box"},[
        h("h3",{},[sec.title]),
        h("div",{class:"small",style:"white-space:pre-wrap"},[sec.content])
      ]);
      card.appendChild(box);
    }

    card.appendChild(h("div",{style:"margin-top:12px"},[
      btn("#situations","⬅ ZPĚT na situace","btn"),
      btn("#panic","🆘 PANIKA","btn panic")
    ]));

    container.append(card);
    return container;
  }

  function screenContacts(){
    const container = h("div",{class:"container"});
    const card = h("div",{class:"card"},[
      h("b",{},["KONTAKTY – Tábor"]),
      h("div",{class:"small",style:"margin-top:8px"},["Jedno klepnutí = volání. Mimo tísňové doplníme až po ověření."])
    ]);

    const tisen = (contacts && contacts.groups || []).find(g=>g.id==="tisen");
    if(tisen){
      for(const item of tisen.items){
        card.append(
          h("div",{style:"margin-top:10px"},[
            h("a",{class:"pill call",href:`tel:${item.tel}`},[
              h("b",{},[`📞 ${item.tel}`]), ` ${item.name}`
            ])
          ])
        );
      }
    }

    card.append(h("div",{style:"margin-top:12px"},[ btn("#","⬅ ZPĚT","btn") ]));
    container.append(card);
    return container;
  }

  function route(){
    const {path, q} = parseHash();

    if(path === "panic") return render(screenPanic());
    if(path === "where") return render(screenWhere());
    if(path === "contacts") return render(screenContacts());
    if(path === "situations") return render(screenSituations(q));
    if(path.startsWith("s/")) return render(screenScenario(decodeURIComponent(path.slice(2))));
    return render(screenHome());
  }

  window.addEventListener("hashchange", route);
  route();
})();
