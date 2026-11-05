/* Market Remembers / V13: sourced financial history and thematic connections.
 * Non-destructive layer over V12 RC6. People / stories are owned by the original app.
 * Historical beacons are symbolic archive markers, NOT geographic coordinates.
 * Connection edges reflect common themes, NOT causation or real user participation.
 */
(function () {
  'use strict';
  const app = document.getElementById('app');
  const scene = document.getElementById('scene');
  const main = app && app.querySelector('main');
  if (!app || !scene || !main || document.getElementById('mhModeSwitch')) return;

  const EVENTS = Object.freeze([
    {
      id: '1907', year: '1907', date: '22 OCT 1907',
      name: 'Паника 1907 года', short: 'Банковская паника',
      detail: 'После прекращения работы Knickerbocker Trust паника распространилась среди трастовых компаний Нью-Йорка. Нехватка доверия переросла в кризис ликвидности.',
      mechanism: 'Доверие → снятие депозитов → дефицит краткосрочных денег',
      lesson: 'Ликвидность и уверенность контрагентов могут исчезнуть быстрее, чем меняется оценка долгосрочных активов.',
      themes: ['Risk', 'Patience'], source: 'Federal Reserve History',
      url: 'https://www.federalreservehistory.org/essays/panic-of-1907',
      p: [-.62,-.42]
    },
    {
      id: '1987', year: '1987', date: '19 OCT 1987',
      name: 'Чёрный понедельник', short: 'Рыночный обвал',
      detail: '19 октября 1987 года индекс Dow Jones Industrial Average упал на 22,6% за одну торговую сессию. Глобальные рынки испытали резкое падение.',
      mechanism: 'Резкий обвал → рыночный стресс → проблемы исполнения',
      lesson: 'Модель риска должна учитывать разрывы цены, резкое ухудшение ликвидности и невозможность выхода по ожидаемой цене.',
      themes: ['Risk', 'Discipline'], source: 'Federal Reserve History',
      url: 'https://www.federalreservehistory.org/essays/stock-market-crash-of-1987',
      p: [.52,-.50]
    },
    {
      id: '2008', year: '2008', date: '15 SEP 2008',
      name: 'Банкротство Lehman Brothers', short: 'Кризис доверия',
      detail: '15 сентября 2008 года Lehman Brothers подала заявление о банкротстве. Давление на финансирование, контрагентов и денежные рынки усилило финансовый кризис.',
      mechanism: 'Потеря доверия → отток финансирования → системный стресс',
      lesson: 'Концентрация рисков и зависимость от краткосрочного фондирования могут быть важнее видимой цены активов.',
      themes: ['Risk', 'Discipline', 'Patience'], source: 'FDIC · Crisis chronology',
      url: 'https://www.fdic.gov/history/2000-2009',
      p: [-.14,.11]
    },
    {
      id: '2020', year: '2020', date: '09 MAR 2020',
      name: 'Пандемический шок ликвидности', short: 'Dash for cash',
      detail: 'В марте 2020 года распродажи затронули даже рынок казначейских бумаг США. 9 марта резкое движение S&P 500 привело к временному прекращению торгов.',
      mechanism: 'Спрос на наличность → принудительные продажи → падение ликвидности',
      lesson: 'В системном стрессе корреляции и глубина рынка могут вести себя иначе, чем в обычные дни.',
      themes: ['Risk', 'FOMO', 'Patience'], source: 'Federal Reserve Bank of New York',
      url: 'https://libertystreeteconomics.newyorkfed.org/2020/05/treasury-market-liquidity-and-the-federal-reserve-during-the-covid-19-pandemic/',
      p: [.62,.34]
    }
  ]);
  const EVENT_BY_ID = Object.fromEntries(EVENTS.map(item => [item.id, item]));
  const THEME_NAMES = Object.freeze({ Risk: 'Управление риском', Discipline: 'Дисциплина', FOMO: 'Страх упустить', Patience: 'Терпение' });
  const TITLES = Object.freeze({
    people: { title: '', subtitle: '' },
    events: { title: 'THE MARKET HAS A MEMORY.', subtitle: 'Реальные события, даты и источники. Каждая точка — урок финансовой истории.' },
    connections: { title: 'EVERY EVENT LEAVES A TRACE.', subtitle: 'Связи между эпохами и темами человеческих решений. Не причинная модель.' }
  });
  const state = { mode: 'people', activeEvent: '2008' };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const switcher = document.createElement('nav');
  switcher.id = 'mhModeSwitch';
  switcher.className = 'mh-mode-switch';
  switcher.setAttribute('aria-label', 'Режимы вселенной Market Remembers');
  switcher.innerHTML = '<button type="button" data-mh-mode="people" aria-pressed="true">✦ <span>ЛЮДИ</span></button>' +
    '<button type="button" data-mh-mode="events" aria-pressed="false">◈ <span>СОБЫТИЯ</span></button>' +
    '<button type="button" data-mh-mode="connections" aria-pressed="false">⌁ <span>СВЯЗИ</span></button>';
  const intro = document.createElement('section');
  intro.className = 'mh-intro';
  intro.id = 'mhIntro';
  intro.hidden = true;
  intro.innerHTML = '<span class="mh-overline">THE MARKET REMEMBERS / FINANCIAL MEMORY</span><h1 id="mhHeadline"></h1><p id="mhSubtitle"></p>';
  const layer = document.createElement('div');
  layer.className = 'mh-event-layer';
  layer.id = 'mhEventLayer';
  layer.hidden = true;
  layer.setAttribute('aria-label', 'Символические маркеры исторических финансовых событий');
  const lines = document.createElementNS('http://www.w3.org/2000/svg','svg');
  lines.classList.add('mh-thematic-lines');
  lines.setAttribute('aria-hidden', 'true');
  layer.append(lines);
  const panel = document.createElement('section');
  panel.className = 'mh-history-panel';
  panel.id = 'mhHistoryPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'События и тематические связи');
  panel.setAttribute('aria-live', 'polite');
  scene.append(layer);
  main.append(switcher, intro, panel);

  function updateUrl() {
    try {
      const url = new URL(window.location.href);
      if (state.mode === 'people') { url.searchParams.delete('mm'); url.searchParams.delete('event'); }
      else { url.searchParams.set('mm', state.mode); url.searchParams.set('event', state.activeEvent); }
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    } catch (_) { /* URL state is optional; content remains usable. */ }
  }
  function timeline() {
    return '<div class="mh-timeline" role="group" aria-label="Выбрать историческое событие">' +
      EVENTS.map(e => '<button type="button" data-mh-event="' + e.id + '" class="' + (e.id === state.activeEvent ? 'is-active' : '') +
      '" aria-pressed="' + (e.id === state.activeEvent) + '"><b>' + e.year + '</b><small>' + escape(e.short) + '</small></button>').join('') +
      '</div>';
  }
  function themeButtons(event) {
    return '<div class="mh-theme-list">' + event.themes.map(t =>
      '<button type="button" data-mh-theme="' + t + '"><span>✦ ' + escape(THEME_NAMES[t]) +
      '</span><small>Истории этой темы ↗</small></button>').join('') + '</div>';
  }
  function eventMarkup(event) {
    return '<div class="mh-panel-heading"><span>FINANCIAL EVENT / SOURCED</span><strong>' + escape(event.date) + '</strong></div>' +
      '<h2>' + escape(event.name) + '</h2>' +
      '<p class="mh-detail">' + escape(event.detail) + '</p>' +
      '<div class="mh-mechanism"><small>МЕХАНИЗМ</small><p>' + escape(event.mechanism) + '</p></div>' +
      '<div class="mh-takeaway"><small>УРОК ДЛЯ ТРЕЙДЕРА</small><p>' + escape(event.lesson) + '</p></div>' +
      '<div class="mh-panel-actions"><button type="button" data-mh-go-connections>ИССЛЕДОВАТЬ СВЯЗИ ↗</button>' +
      '<a href="' + escape(event.url) + '" target="_blank" rel="noopener noreferrer">ИСТОЧНИК ↗</a></div>';
  }
  function connectionMarkup(event) {
    const related = EVENTS.filter(e => e.id !== event.id && e.themes.some(t => event.themes.includes(t)));
    return '<div class="mh-panel-heading"><span>THEMATIC MEMORY / DEMO STORIES</span><strong>' + escape(event.date) + '</strong></div>' +
      '<h2>' + escape(event.name) + '</h2>' +
      '<p class="mh-detail">Эти ссылки связывают историческое событие с темами историй, а не с конкретными участниками события. Демо-истории могут быть вымышленными.</p>' +
      '<div class="mh-connections-title">ОБЩИЕ ТЕМЫ · ОТКРЫТЬ В СФЕРЕ ЛЮДЕЙ</div>' +
      themeButtons(event) +
      '<div class="mh-connections-title">СХОЖИЕ ТЕМЫ В ДРУГИЕ ЭПОХИ</div>' +
      '<div class="mh-related">' + related.map(e =>
      '<button type="button" data-mh-event="' + e.id + '"><span>' + e.year + ' · ' + escape(e.short) +
      '</span><small>' + e.themes.filter(t => event.themes.includes(t)).map(t => escape(THEME_NAMES[t])).join(' · ') + '</small></button>'
      ).join('') + '</div>' +
      '<a class="mh-source" href="' + escape(event.url) + '" target="_blank" rel="noopener noreferrer">Проверить событие: ' + escape(event.source) + ' ↗</a>';
  }
  function renderPanel() {
    const event = EVENT_BY_ID[state.activeEvent];
    panel.innerHTML = '<div class="mh-panel-top"><span>◈ MARKET MEMORY ATLAS</span><span>04 / VERIFIED EVENTS</span></div>' +
      timeline() + '<div class="mh-panel-body">' + (state.mode === 'connections' ? connectionMarkup(event) : eventMarkup(event)) + '</div>' +
      '<p class="mh-disclaimer">Исторические факты снабжены источниками. Символические связи — тематические, не доказательство причинности и не свидетельства реальных трейдеров.</p>';
  }
  function measure() {
    if (state.mode === 'people') return;
    const rect = scene.getBoundingClientRect();
    const aura = document.getElementById('v81Aura');
    const a = aura && aura.getBoundingClientRect();
    const plausible = a && a.width > 100 && a.height > 100 && a.width < rect.width * 1.7;
    const w = rect.width, h = rect.height;
    const cx = plausible ? a.left - rect.left + a.width / 2 : (w < 820 ? w * .585 : w * .672);
    const cy = plausible ? a.top - rect.top + a.height / 2 : h * .52;
    const r = plausible ? Math.min(a.width,a.height) * .36 : Math.min(w,h) * (w < 820 ? .29 : .37);
    const positions = {};
    EVENTS.forEach(event => {
      positions[event.id] = {x: Math.max(18,Math.min(w-18,cx + event.p[0] * r)),y: Math.max(96,Math.min(h-85,cy + event.p[1] * r))};
    });
    layer.querySelectorAll('[data-mh-beacon]').forEach(button => {
      const pos = positions[button.dataset.mhBeacon];
      button.style.left = pos.x + 'px';
      button.style.top = pos.y + 'px';
    });
    lines.setAttribute('viewBox', '0 0 ' + Math.max(1,w) + ' ' + Math.max(1,h));
    lines.setAttribute('preserveAspectRatio', 'none');
    lines.innerHTML = '';
    if (state.mode === 'connections') {
      const selected = EVENT_BY_ID[state.activeEvent];
      EVENTS.forEach(other => {
        if(other.id === selected.id || !other.themes.some(t=>selected.themes.includes(t))) return;
        const from = positions[selected.id], to = positions[other.id];
        const d = 'M ' + from.x + ' ' + from.y + ' Q ' + ((from.x+to.x)/2) + ' ' +
          (Math.min(from.y,to.y)-50) + ' ' + to.x + ' ' + to.y;
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        lines.append(path);
      });
    }
  }
  function renderBeacons() {
    layer.querySelectorAll('[data-mh-beacon]').forEach(node=>node.remove());
    EVENTS.forEach(event => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mh-beacon' + (event.id === state.activeEvent ? ' is-active' : '');
      button.dataset.mhBeacon = event.id;
      button.setAttribute('aria-label',event.year + ': ' + event.name + '. Выбрать историческое событие');
      button.setAttribute('aria-pressed',String(event.id === state.activeEvent));
      button.innerHTML = '<span aria-hidden="true" class="mh-beacon-ring"></span><span class="mh-beacon-year">' + event.year + '</span>';
      layer.append(button);
    });
    window.requestAnimationFrame(measure);
  }
  function setMode(mode, update = true) {
    if (!['people','events','connections'].includes(mode)) return;
    state.mode = mode;
    app.dataset.mhMode = mode;
    switcher.querySelectorAll('[data-mh-mode]').forEach(btn => {
      const active = btn.dataset.mhMode === mode;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    intro.hidden = mode === 'people';
    panel.hidden = mode === 'people';
    layer.hidden = mode === 'people';
    if (mode !== 'people') {
      const title = TITLES[mode];
      intro.querySelector('h1').textContent = title.title;
      intro.querySelector('p').textContent = title.subtitle;
      const drawer = document.getElementById('drawer');
      if (drawer && !drawer.hidden) document.getElementById('closeDrawer')?.click();
      renderPanel();
      renderBeacons();
    }
    if (update) updateUrl();
  }
  function selectEvent(id) {
    if (!EVENT_BY_ID[id]) return;
    state.activeEvent = id;
    renderPanel();
    renderBeacons();
    updateUrl();
  }
  function openPeopleTheme(theme) {
    if (!(theme in THEME_NAMES)) return;
    setMode('people');
    const lensPanel = document.getElementById('lensPanel');
    if (lensPanel && lensPanel.hidden) document.getElementById('lensToggle')?.click();
    const button = document.querySelector('#lensPanel [data-lens="' + theme + '"]');
    button?.click();
  }
  // Prevent symbolic event beacons from also triggering the original globe's
  // pointer-to-story reader. Keep drag/zoom controls unchanged elsewhere.
  for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
    layer.addEventListener(type, event => {
      if (event.target instanceof Element && event.target.closest('[data-mh-beacon]')) event.stopPropagation();
    });
  }
  layer.addEventListener('click', event => {
    const beacon = event.target instanceof Element ? event.target.closest('[data-mh-beacon]') : null;
    if (!beacon) return;
    event.stopPropagation();
    selectEvent(beacon.dataset.mhBeacon);
  });
  app.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const modeBtn = target.closest('[data-mh-mode]');
    if (modeBtn) { setMode(modeBtn.dataset.mhMode); return; }
    const beacon = target.closest('[data-mh-beacon]');
    if (beacon) { selectEvent(beacon.dataset.mhBeacon); return; }
    const eventBtn = target.closest('[data-mh-event]');
    if (eventBtn) { selectEvent(eventBtn.dataset.mhEvent); return; }
    if (target.closest('[data-mh-go-connections]')) { setMode('connections'); return; }
    const themeBtn = target.closest('[data-mh-theme]');
    if (themeBtn) { openPeopleTheme(themeBtn.dataset.mhTheme); return; }
    if (target.closest('#brandHome')) setMode('people');
  });
  const drawer = document.getElementById('drawer');
  if (drawer && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      // If a visitor opens an existing person's reader, return the world to People.
      if (state.mode !== 'people' && !drawer.hidden) setMode('people');
    }).observe(drawer,{attributes:true,attributeFilter:['hidden']});
  }
  window.addEventListener('resize',()=>window.requestAnimationFrame(measure),{passive:true});
  const controls = document.getElementById('worldControls');
  controls?.addEventListener('click',()=>window.setTimeout(measure,140));
  const requested = new URLSearchParams(window.location.search);
  if (EVENT_BY_ID[requested.get('event')]) state.activeEvent = requested.get('event');
  const initial = requested.get('mm');
  setMode(initial === 'events' || initial === 'connections' ? initial : 'people', false);
  window.MarketHistoryModes = Object.freeze({
    version: '13.0.0',
    get mode() { return state.mode; },
    get activeEvent() { return state.activeEvent; },
    get events() { return EVENTS.map(({id,year,date,name,themes,url})=>({id,year,date,name,themes:[...themes],url})); },
    setMode, selectEvent
  });
})();