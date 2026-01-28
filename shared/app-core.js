async function safeFetchText(url){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.text();
}
async function safeFetchJson(url){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.json();
}

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export async function bootCityApp(){
  const cfgUrl = './city.json';
  const cfg = await safeFetchJson(cfgUrl);

  // apply theme
  const root = document.documentElement;
  if (cfg.theme?.bg) root.style.setProperty('--bg', cfg.theme.bg);
  if (cfg.theme?.card) root.style.setProperty('--card', cfg.theme.card);
  if (cfg.theme?.accent) root.style.setProperty('--accent', cfg.theme.accent);
  if (cfg.theme?.danger) root.style.setProperty('--danger', cfg.theme.danger);

  // SW: city-scope only
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
  }

  const app = document.getElementById('app');
  app.innerHTML = '';
  const top = el(`
    <div class="top">
      <div class="brand">
        <div class="logo">${cfg.logo ? `<img alt="" src="${cfg.logo}">` : '72H'}</div>
        <div>
          <p class="h1">${cfg.title || '72 hodin'}</p>
          <p class="sub">${cfg.subtitle || 'Offline krizový manuál'}</p>
        </div>
      </div>
      <div class="badge">${cfg.citySlug || ''}</div>
    </div>
  `);
  app.appendChild(el('<div class="wrap"></div>'));
  app.querySelector('.wrap').appendChild(top);

  const grid = el(`<div class="grid"></div>`);
  app.querySelector('.wrap').appendChild(grid);

  const cardNow = el(`
    <div class="card">
      <h2>Teď hned</h2>
      <p class="p">Rychlé kroky pro první minuty. Offline-first, jedno tlačítko = jasná akce.</p>
      <div class="btns">
        <button class="btn primary" id="btnScenarios">Scénáře</button>
        <button class="btn" id="btnKB">Znalosti</button>
        <button class="btn danger" id="btnPanic">PANIKA</button>
      </div>
      <div class="small" id="status"></div>
    </div>
  `);

  const cardData = el(`
    <div class="card">
      <h2>Data města</h2>
      <ul class="list" id="dataList"></ul>
      <div class="small">Zdrojové soubory jsou mimo UI: stačí vyměnit cesty v <code>city.json</code>.</div>
    </div>
  `);

  grid.appendChild(cardNow);
  grid.appendChild(cardData);

  const status = app.querySelector('#status');
  const list = app.querySelector('#dataList');

  function addItem(name, desc){
    const li = el(`<li class="item"><strong></strong><span></span></li>`);
    li.querySelector('strong').textContent = name;
    li.querySelector('span').textContent = desc;
    list.appendChild(li);
  }

  addItem('scenarios.json', cfg.data?.scenarios || '(nenastaveno)');
  addItem('knowledge_base.txt', cfg.data?.knowledgeBase || '(nenastaveno)');

  async function showScenarios(){
    status.textContent = 'Načítám scénáře…';
    try{
      const data = await safeFetchJson(cfg.data.scenarios);
      const n = Array.isArray(data) ? data.length : (data?.length || Object.keys(data||{}).length);
      status.textContent = `Scénáře načteny: ${n}`;
    }catch(e){
      status.textContent = `Chyba scénářů: ${e.message}`;
    }
  }

  async function showKB(){
    status.textContent = 'Načítám znalosti…';
    try{
      const txt = await safeFetchText(cfg.data.knowledgeBase);
      status.textContent = `Znalosti načteny: ${txt.length} znaků`;
    }catch(e){
      status.textContent = `Chyba znalostí: ${e.message}`;
    }
  }

  document.getElementById('btnScenarios').onclick = showScenarios;
  document.getElementById('btnKB').onclick = showKB;
  document.getElementById('btnPanic').onclick = () => {
    status.textContent = 'PANIKA: TODO (v2) — sem dáme offline preset + kontakty.';
  };

  status.textContent = 'Připraveno.';
}
