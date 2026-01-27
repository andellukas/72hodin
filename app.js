(async function(){
  const el = document.getElementById("app");

  function h(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs||{})){
      if(k==="class") n.className=v;
      else if(k==="html") n.innerHTML=v;
      else n.setAttribute(k, v);
    }
    for(const c of (children||[])) n.appendChild(typeof c==="string"?document.createTextNode(c):c);
    return n;
  }

  async function loadCity(){
    const r = await fetch("../cities/tabor/city.json", {cache:"no-store"});
    if(!r.ok) throw new Error("city.json missing");
    return r.json();
  }
  async function loadContacts(){
    const r = await fetch("../cities/tabor/contacts.json", {cache:"no-store"});
    if(!r.ok) return null;
    return r.json();
  }

  function setTheme(theme){
    if(!theme) return;
    const root = document.documentElement;
    for(const [k,v] of Object.entries(theme)){
      root.style.setProperty(`--${k}`, v);
    }
  }

  function screenHome(city){
    const container = h("div",{class:"container"});
    const header = h("div",{class:"header"},[
      h("div",{class:"brand"},[
        h("b",{},[city.appTitle||"72 hodin – Tábor"]),
        h("span",{},["Offline krizový manuál (v2)"])
      ])
    ]);
    const grid = h("div",{class:"grid"},[
      h("a",{class:"btn panic",href:"#panic"},["🆘 PANIKA – JDE O ŽIVOT"]),
      h("a",{class:"btn",href:"#where"},["📍 KDE JSEM / CO SE DĚJE"]),
      h("a",{class:"btn",href:"#contacts"},["📞 POMOC & KONTAKTY"])
    ]);
    const foot = h("div",{class:"small",style:"margin-top:10px"},[
      `Stav: ${navigator.onLine ? "online" : "offline"}`
    ]);
    container.append(header, grid, foot);
    return container;
  }

  function screenPanic(){
    const container = h("div",{class:"container"});
    container.append(
      h("div",{class:"card"},[
        h("b",{},["TEĎ (1–3 min): ZASTAV PANIKU"]),
        h("div",{class:"small",style:"margin-top:8px"},[
          "ZASTAV SE. Nadechni nosem, vydechni pusou (5×). Rozhlédni se: jsem v bezpečí? Zkontroluj zranění/krev/zmatenost."
        ]),
        h("div",{class:"row",style:"margin-top:12px"},[
          h("a",{class:"pill call",href:"tel:112"},[h("b",{},["📞 112"]), "IZS"]),
          h("a",{class:"pill call",href:"tel:155"},[h("b",{},["📞 155"]), "Záchranka"]),
          h("a",{class:"pill call",href:"tel:158"},[h("b",{},["📞 158"]), "Policie"]),
          h("a",{class:"pill call",href:"tel:150"},[h("b",{},["📞 150"]), "Hasiči"])
        ]),
        h("div",{style:"margin-top:12px"},[
          h("a",{class:"btn",href:"#"},["⬅ ZPĚT"])
        ])
      ])
    );
    return container;
  }

  function screenWhere(){
    const container = h("div",{class:"container"});
    container.append(
      h("div",{class:"card"},[
        h("b",{},["KDE JSEM / CO SE DĚJE"]),
        h("div",{class:"small",style:"margin-top:8px"},["Vyber stav. Aplikace tě navede na správný postup."]),
        h("div",{class:"grid",style:"margin-top:12px"},[
          h("a",{class:"btn",href:"#panic"},["🏠 JSEM DOMA / V BUDOVĚ"]),
          h("a",{class:"btn",href:"#panic"},["🚶 JSEM VENKU"]),
          h("a",{class:"btn",href:"#panic"},["🏙 JSEM V CIZÍM MÍSTĚ"]),
          h("a",{class:"btn",href:"#panic"},["🚨 SIRÉNY / HROZBA VENKU"]),
          h("a",{class:"btn",href:"#panic"},["⚡ NEJDE PROUD / VODA"])
        ]),
        h("div",{style:"margin-top:12px"},[
          h("a",{class:"btn",href:"#"},["⬅ ZPĚT"])
        ])
      ])
    );
    return container;
  }

  function screenContacts(contacts){
    const container = h("div",{class:"container"});
    const card = h("div",{class:"card"},[
      h("b",{},["KONTAKTY – Tábor"]),
      h("div",{class:"small",style:"margin-top:8px"},["Jedno klepnutí = volání. Čísla mimo tísňové doplníme až po ověření."])
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
    card.append(h("div",{style:"margin-top:12px"},[h("a",{class:"btn",href:"#"},["⬅ ZPĚT"])]));
    container.append(card);
    return container;
  }

  function render(node){
    el.innerHTML="";
    el.appendChild(node);
  }

  const city = await loadCity();
  setTheme(city.theme);

  const contacts = await loadContacts().catch(()=>null);

  function route(){
    const hash = location.hash || "#";
    if(hash==="#panic") return render(screenPanic());
    if(hash==="#where") return render(screenWhere());
    if(hash==="#contacts") return render(screenContacts(contacts));
    return render(screenHome(city));
  }

  window.addEventListener("hashchange", route);
  route();
})();
