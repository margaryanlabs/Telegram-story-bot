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
    events: { title: 'EVENT CORE.', subtitle: 'Кризисы. Системные шоки. Решения, изменившие рынки. Исследуй финансовую историю.' },
    connections: { title: 'THE FAULT LINES.', subtitle: 'Повторяющиеся механизмы рыночных кризисов. Тематические связи, а не доказательства причинности.' }
  });
  const state = { mode: 'people', activeEvent: '2008' };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const switcher = document.createElement('nav');
  switcher.id = 'mhModeSwitch';
  switcher.className = 'mh-mode-switch';
  switcher.setAttribute('aria-label', 'Режимы вселенной Market Remembers');
  switcher.innerHTML = '<button type="button" data-mh-mode="people" aria-pressed="true">✦ <span>ЛЮДИ</span></button>' +
    '<button type="button" data-mh-mode="events" aria-pressed="false">◈ <span>EVENT CORE</span></button>';
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

  function updateUrl(method = 'replace') {
    try {
      const url = new URL(window.location.href);
      if (state.mode === 'people') { url.searchParams.delete('mm'); url.searchParams.delete('event'); }
      else { url.searchParams.set('mm', state.mode); url.searchParams.set('event', state.activeEvent); }
      // World changes are navigable with Android/system Back; individual year
      // focus updates avoid flooding the history stack with every star tap.
      const operation=method==='push'?'pushState':'replaceState';
      history[operation](history.state, '', url.pathname + url.search + url.hash);
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
    const sourceIndex=EVENTS.findIndex(item=>item.id===event.id);
    const before=EVENTS[(sourceIndex-1+EVENTS.length)%EVENTS.length];
    const after=EVENTS[(sourceIndex+1)%EVENTS.length];
    const steps=event.mechanism.split('→').map((part,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+escape(part.trim())+'</strong></li>').join('');
    return '<div class="mh-v16-record">' +
      '<div class="mh-v19-context"><span>АРХИВ ФИНАНСОВОЙ ИСТОРИИ / '+escape(event.year)+'</span>'+
      '<strong>'+escape(event.short)+'</strong>'+
      '<p>'+escape(event.mechanism)+'</p>'+
      '<small>Документированное событие · позиция метки на сфере символическая</small></div>' +
      '<div class="mh-v16-record-meta"><span>◈ VERIFIED CHRONICLE</span><time>'+escape(event.date)+'</time></div>' +
      '<div class="mh-v16-record-title"><span class="mh-v16-record-year">'+escape(event.year)+'</span><h2>'+escape(event.name)+'</h2></div>' +
      (event.id==='2008' ? '<section class="mh-shock-replay-host mh-shock-replay" id="mhShockReplay2008" aria-label="Управляемая хронология кризиса 2008 года"></section>' : '') +
      '<section class="mh-v16-research-card mh-v16-context"><div class="mh-v16-card-icon">01</div><div><h3>ЧТО ПРОИЗОШЛО</h3><p>'+escape(event.detail)+'</p></div></section>' +
      '<section class="mh-v16-research-card mh-v16-transmission"><div class="mh-v16-card-icon">02</div><div><h3>МЕХАНИЗМ ШОКА</h3><ol class="mh-v16-steps">'+steps+'</ol></div></section>' +
      '<section class="mh-v16-research-card mh-v16-lesson"><div class="mh-v16-card-icon">03</div><div><h3>УРОК ДЛЯ ТРЕЙДЕРА</h3><p>'+escape(event.lesson)+'</p></div></section>' +
      '<div class="mh-v19-neighbors" role="group" aria-label="Другие исторические события">'+
      '<button type="button" data-mh-event="'+before.id+'" aria-label="Предыдущее событие: '+escape(before.name)+'">← '+escape(before.year)+'</button>'+
      '<span>ИССЛЕДОВАТЬ ДРУГОЙ ГОД</span>'+
      '<button type="button" data-mh-event="'+after.id+'" aria-label="Следующее событие: '+escape(after.name)+'">'+escape(after.year)+' →</button></div>' +
      '<div class="mh-v16-card-footer"><button type="button" data-mh-go-connections>ИССЛЕДОВАТЬ СВЯЗИ <span aria-hidden="true">↗</span></button>' +
      '<a href="'+escape(event.url)+'" target="_blank" rel="noopener noreferrer">ПЕРВОИСТОЧНИК · '+escape(event.source)+' ↗</a></div></div>';
  }
  // Compare archival records, not price series. The globe remains on the
  // selected event while a second sourced case is examined independently.
  let compareEventId = null;
  function comparisonMarkup(event) {
    const candidates = EVENTS.filter(other => other.id !== event.id);
    const compared = candidates.find(other => other.id === compareEventId) || candidates[0];
    const shared = event.themes.filter(theme => compared.themes.includes(theme));
    const leftOnly = event.themes.filter(theme => !compared.themes.includes(theme));
    const rightOnly = compared.themes.filter(theme => !event.themes.includes(theme));
    const themeLabels = values => values.length
      ? values.map(theme => escape(THEME_NAMES[theme])).join(' · ')
      : 'нет в выбранных тематических тегах';
    const caseFile = (record, side) => {
      const stages = record.mechanism.split('→').map((part,index) =>
        '<li><span>'+String(index+1).padStart(2,'0')+'</span><strong>'+escape(part.trim())+'</strong></li>').join('');
      return '<article class="mh-v20-compare-case" aria-label="'+escape(record.name)+'">' +
        '<div class="mh-v20-compare-case-head"><span>ДОСЬЕ '+side+'</span><b>'+escape(record.year)+'</b></div>' +
        '<h4>'+escape(record.name)+'</h4><time>'+escape(record.date)+'</time>' +
        '<div class="mh-v20-compare-fact"><small>ЧТО ЗАДОКУМЕНТИРОВАНО</small><p>'+escape(record.detail)+'</p></div>' +
        '<div class="mh-v20-compare-path"><small>ЦЕПОЧКА ШОКА</small><ol>'+stages+'</ol></div>' +
        '<div class="mh-v20-compare-lesson"><small>ПРАКТИЧЕСКИЙ ВЫВОД · ИНТЕРПРЕТАЦИЯ</small><p>'+escape(record.lesson)+'</p></div>' +
        '<a href="'+escape(record.url)+'" target="_blank" rel="noopener noreferrer">ПЕРВОИСТОЧНИК · '+escape(record.source)+' ↗</a></article>';
    };
    return '<section class="mh-v20-compare" aria-label="Сравнение исторических кризисов">' +
      '<div class="mh-v20-compare-heading"><span>01 / CRISIS COMPARE</span>' +
      '<h3>Два кризиса. Разные механизмы.</h3>' +
      '<p>Первый кризис закреплён на сфере. Выберите второй для сопоставления архивных фактов и интерпретаций.</p></div>' +
      '<div class="mh-v20-compare-picker" role="group" aria-label="Выбрать второй кризис">' +
      candidates.map(other => '<button type="button" data-mh-compare="'+other.id+'" aria-pressed="'+(other.id===compared.id)+'" class="'+(other.id===compared.id?'is-active':'')+'">'+escape(other.year)+'</button>').join('')+'</div>' +
      '<div class="mh-v20-compare-pair">'+caseFile(event,'A')+caseFile(compared,'B')+'</div>' +
      '<div class="mh-v20-compare-synthesis"><h4>Тематическое пересечение</h4>' +
      '<p><b>Общее:</b> '+themeLabels(shared)+'</p>' +
      '<p><b>Только '+escape(event.year)+':</b> '+themeLabels(leftOnly)+'</p>' +
      '<p><b>Только '+escape(compared.year)+':</b> '+themeLabels(rightOnly)+'</p>' +
      '<small>Общие темы не доказывают причинность или одинаковую динамику цен. Схемы и уроки — краткая аналитическая интерпретация; факты проверяйте по двум первоисточникам.</small></div></section>';
  }
  function connectionMarkup(event) {
    const related=EVENTS.filter(e=>e.id!==event.id&&e.themes.some(t=>event.themes.includes(t)));
    return '<div class="mh-v16-record mh-v16-connection-record">' +
      '<div class="mh-v16-record-meta"><span>◈ THEMATIC INTELLIGENCE</span><time>'+escape(event.date)+'</time></div>' +
      '<div class="mh-v16-record-title"><span class="mh-v16-record-year">'+escape(event.year)+'</span><h2>'+escape(event.name)+'</h2></div>' +
      '<p class="mh-v16-connection-notice">Сопоставляем общие темы и механизмы. Эти связи не доказывают причинность и не означают, что авторы демо-историй участвовали в событии.</p>' +
      comparisonMarkup(event) +
      '<div class="mh-v16-section-label"><span>02</span> ЧЕЛОВЕЧЕСКИЕ УРОКИ</div>'+themeButtons(event) +
      '<div class="mh-v16-section-label"><span>03</span> ИСТОРИЧЕСКИЕ ПАРАЛЛЕЛИ</div>'+
      '<div class="mh-v16-related-grid">'+related.map(e=>'<button type="button" class="mh-v16-related-card" data-mh-event="'+e.id+'"><b>'+escape(e.year)+'</b><strong>'+escape(e.short)+'</strong><small>'+e.themes.filter(t=>event.themes.includes(t)).map(t=>escape(THEME_NAMES[t])).join(' · ')+'</small><span aria-hidden="true">↗</span></button>').join('')+'</div>'+
      '<a class="mh-v16-source-link" href="'+escape(event.url)+'" target="_blank" rel="noopener noreferrer">ИСТОЧНИК СОБЫТИЯ · '+escape(event.source)+' ↗</a></div>';
  }
  
  let panelExpanded = false;
  function renderPanel() {
    window.MarketShockReplay2008?.unmount();
    const event = EVENT_BY_ID[state.activeEvent];
    const eventIndex = EVENTS.findIndex(item => item.id === event.id);
    const previousEvent = EVENTS[(eventIndex - 1 + EVENTS.length) % EVENTS.length];
    const followingEvent = EVENTS[(eventIndex + 1) % EVENTS.length];
    const chronicle = '<div class="mh-v20-chronicle">' +
      '<span class="mh-v20-chronicle-label">CRISIS ATLAS / ДОКУМЕНТЫ</span>' +
      '<span class="mh-v20-chronicle-index" aria-label="Событие '+(eventIndex+1)+' из '+EVENTS.length+'">' +
      String(eventIndex+1).padStart(2,'0')+' <i>/</i> '+String(EVENTS.length).padStart(2,'0')+'</span>' +
      '<div class="mh-v20-traverse" role="group" aria-label="Перейти к другому кризису">' +
      '<button type="button" data-mh-v20-direction="prev" data-mh-event="'+previousEvent.id+
      '" aria-label="Предыдущее событие: '+escape(previousEvent.name)+'">‹</button>' +
      '<button type="button" data-mh-v20-direction="next" data-mh-event="'+followingEvent.id+
      '" aria-label="Следующее событие: '+escape(followingEvent.name)+'">›</button></div></div>';
    panel.classList.toggle('is-expanded',panelExpanded);
    window.MarketSignalDirector?.setEvent(event);
    // The selected crisis has a readable mechanism even without opening the
    // research dossier: show source-supplied stages, never inferred trade data.
    const impact=event.mechanism.split('→').map((part,i)=>
      '<li><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+escape(part.trim())+'</strong></li>').join('');
    panel.innerHTML = chronicle + '<button type="button" class="mh-panel-grip" data-mh-panel-toggle aria-expanded="'+panelExpanded+'"><span><small>FINANCIAL HISTORY / '+event.year+'</small><strong>'+escape(event.name)+'</strong></span><em>'+(panelExpanded?'СВЕРНУТЬ ↓':(event.id==='2008' && state.mode==='events'?'▶ 6 ЭТАПОВ':'ПОДРОБНЕЕ ↑'))+'</em></button>' +
      '<p class="mh-v19-preview" aria-label="Краткий контекст">'+escape(event.short)+' · '+escape(event.date)+'</p>' +
      '<ol class="mh-v20-impact-strip" aria-label="Схема механизма кризиса">'+impact+'</ol>' +
      '<div class="mh-v20-source-line"><span>ДОКУМЕНТИРОВАННОЕ СОБЫТИЕ</span><a href="'+escape(event.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Открыть первоисточник: '+escape(event.source)+'">ИСТОЧНИК ↗</a></div>' +
      '<div class="mh-panel-top"><span>◈ EVENT CORE / RESEARCH</span><span>04 / SOURCED EVENTS</span></div>' +
      '<nav class="mh-core-tabs" aria-label="Исследование истории"><button type="button" data-mh-mode="events" aria-pressed="'+(state.mode === 'events')+'" class="'+(state.mode === 'events'?'is-active':'')+'">СОБЫТИЯ</button><button type="button" data-mh-mode="connections" aria-pressed="'+(state.mode === 'connections')+'" class="'+(state.mode === 'connections'?'is-active':'')+'">СВЯЗИ</button></nav>' +
      timeline() + '<div class="mh-panel-body">' + (state.mode === 'connections' ? connectionMarkup(event) : eventMarkup(event)) + '</div>' +
      '<p class="mh-disclaimer">Исторические факты снабжены источниками. Символические связи — тематические, не доказательство причинности и не свидетельства реальных трейдеров.</p>';
    if (panelExpanded && state.mode==='events' && event.id==='2008') {
      window.MarketShockReplay2008?.mount(panel.querySelector('#mhShockReplay2008'));
    }
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
      const pos = window.MarketEventPlanet?.project(event.p);
      positions[event.id] = pos || {x: Math.max(18,Math.min(w-18,cx + event.p[0] * r)),y: Math.max(96,Math.min(h-85,cy + event.p[1] * r)),visible:true};
    });
    layer.querySelectorAll('[data-mh-beacon]').forEach(button => {
      const pos = positions[button.dataset.mhBeacon];
      button.style.left = pos.x + 'px';
      button.style.top = pos.y + 'px';
      const visible = pos.visible !== false;
      button.style.opacity = visible ? '1' : '0';
      button.style.pointerEvents = visible ? 'auto' : 'none';
      button.tabIndex = visible ? 0 : -1;
      button.setAttribute('aria-hidden',String(!visible));
    });
    lines.setAttribute('viewBox', '0 0 ' + Math.max(1,w) + ' ' + Math.max(1,h));
    lines.setAttribute('preserveAspectRatio', 'none');
    lines.innerHTML = '';
    if (state.mode === 'connections') {
      const selected = EVENT_BY_ID[state.activeEvent];
      EVENTS.forEach(other => {
        if(other.id === selected.id || !other.themes.some(t=>selected.themes.includes(t))) return;
        const from = positions[selected.id], to = positions[other.id];
        if (!from.visible || !to.visible) return;
        const d = 'M ' + from.x + ' ' + from.y + ' Q ' + ((from.x+to.x)/2) + ' ' +
          (Math.min(from.y,to.y)-50) + ' ' + to.x + ' ' + to.y;
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        lines.append(path);
      });
    }
    window.MarketSignalDirector?.position(positions[state.activeEvent],rect,panel.getBoundingClientRect(),panelExpanded);
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
    window.MarketShockReplay2008?.syncScene();
    window.requestAnimationFrame(measure);
  }
  function setMode(mode, update = true, afterCommit = null) {
    if (!['people','events','connections'].includes(mode)) return;
    const changingWorld=(state.mode==='people') !== (mode==='people');
    if(update && changingWorld && window.MarketWorldTransition?.run) {
      window.MarketWorldTransition.run(state.mode,mode,()=>{commitMode(mode,update);afterCommit?.();});
      return;
    }
    commitMode(mode,update);
    afterCommit?.();
  }
  function commitMode(mode, update = true) {
    const oldMode = state.mode;
    state.mode = mode;
    if (mode === 'people') {
      panelExpanded = false;
      window.MarketShockReplay2008?.unmount();
    }
    else if (oldMode !== 'people' && oldMode !== mode) panelExpanded = true;
    app.dataset.mhMode = mode;
    switcher.querySelectorAll('[data-mh-mode]').forEach(btn => {
      const active = mode === 'people' ? btn.dataset.mhMode === 'people' : btn.dataset.mhMode === 'events';
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
    window.MarketEventPlanet?.setActive(mode !== 'people');
    if (update) updateUrl(oldMode!==mode?'push':'replace');
  }
  function selectEvent(id) {
    if (!EVENT_BY_ID[id]) return;
    const origin=document.activeElement;
    const fromQuickNav=origin?.closest?.('[data-mh-v20-direction]')?.dataset.mhV20Direction;
    const fromTimeline=!!origin?.closest?.('.mh-timeline [data-mh-event],.mh-v19-neighbors [data-mh-event]');
    const fromBeacon=!!origin?.closest?.('[data-mh-beacon]');
    state.activeEvent = id;
    // Selecting a year must not immediately cover the sphere with a dossier.
    // The visitor explicitly expands "Подробнее" when ready to read.
    panelExpanded = false;
    renderPanel();
    panel.scrollTop=0;
    renderBeacons();
    // Re-rendering the panel replaces buttons: retain focus for keyboard users.
    if(fromQuickNav){
      panel.querySelector('[data-mh-v20-direction="'+fromQuickNav+'"]')?.focus({preventScroll:true});
    }else if(fromTimeline){
      const target=window.matchMedia('(max-width:819px)').matches
        ?panel.querySelector('.mh-timeline [data-mh-event="'+id+'"]')
        :panel.querySelector('.mh-panel-grip');
      target?.focus({preventScroll:true});
    }else if(fromBeacon)layer.querySelector('[data-mh-beacon="'+id+'"]')?.focus({preventScroll:true});
    window.MarketEventPlanet?.focus(EVENT_BY_ID[id].p);
    window.MarketSignalDirector?.setEvent(EVENT_BY_ID[id]);
    updateUrl();
  }
  function openPeopleTheme(theme) {
    if (!(theme in THEME_NAMES)) return;
    setMode('people',true,()=>{
      const lensPanel = document.getElementById('lensPanel');
      if (lensPanel && lensPanel.hidden) document.getElementById('lensToggle')?.click();
      const button = document.querySelector('#lensPanel [data-lens="' + theme + '"]');
      button?.click();
    });
  }
  // Prevent symbolic event beacons from also triggering the original globe's
  // pointer-to-story reader. Keep drag/zoom controls unchanged elsewhere.
  for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
    layer.addEventListener(type, event => {
      if (event.target instanceof Element && event.target.closest('[data-mh-beacon]')) event.stopPropagation();
    });
  }
  panel.addEventListener('keydown', event => {
    // Escape closes the research document without navigating away from the world.
    if(event.key==='Escape'&&panelExpanded){
      event.preventDefault();event.stopPropagation();
      panelExpanded=false;renderPanel();panel.scrollTop=0;
      panel.querySelector('.mh-panel-grip')?.focus({preventScroll:true});
      window.requestAnimationFrame(measure);
      return;
    }
    const compareButton=event.target instanceof Element?event.target.closest('[data-mh-compare]'):null;
    if(compareButton&&state.mode==='connections'&&['ArrowLeft','ArrowRight'].includes(event.key)){
      event.preventDefault();
      const candidates=EVENTS.filter(item=>item.id!==state.activeEvent);
      const index=candidates.findIndex(item=>item.id===compareButton.dataset.mhCompare);
      const direction=event.key==='ArrowRight'?1:-1;
      compareEventId=candidates[(index+direction+candidates.length)%candidates.length].id;
      const scroll=panel.scrollTop;
      renderPanel();panel.scrollTop=scroll;
      panel.querySelector('[data-mh-compare="'+compareEventId+'"]')?.focus({preventScroll:true});
      return;
    }
    const dateButton=event.target instanceof Element?event.target.closest('.mh-timeline [data-mh-event]'):null;
    if(!dateButton||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    const index=EVENTS.findIndex(item=>item.id===dateButton.dataset.mhEvent);
    const direction=event.key==='ArrowRight'?1:-1;
    selectEvent(EVENTS[(index+direction+EVENTS.length)%EVENTS.length].id);
  });
  layer.addEventListener('click', event => {
    const beacon = event.target instanceof Element ? event.target.closest('[data-mh-beacon]') : null;
    if (!beacon) return;
    event.stopPropagation();
    selectEvent(beacon.dataset.mhBeacon);
  });
  app.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if(target.closest('[data-mh-panel-toggle]')) {
      panelExpanded=!panelExpanded;
      renderPanel();panel.scrollTop=0;
      panel.querySelector('.mh-panel-grip')?.focus({preventScroll:true});
      window.requestAnimationFrame(measure);
      return;
    }
    const modeBtn = target.closest('[data-mh-mode]');
    if (modeBtn) { setMode(modeBtn.dataset.mhMode); return; }
    const beacon = target.closest('[data-mh-beacon]');
    if (beacon) { selectEvent(beacon.dataset.mhBeacon); return; }
    const compareBtn = target.closest('[data-mh-compare]');
    if (compareBtn && state.mode==='connections' && EVENT_BY_ID[compareBtn.dataset.mhCompare] && compareBtn.dataset.mhCompare!==state.activeEvent) {
      compareEventId=compareBtn.dataset.mhCompare;
      const scroll=panel.scrollTop;
      renderPanel();panel.scrollTop=scroll;
      panel.querySelector('[data-mh-compare="'+compareEventId+'"]')?.focus({preventScroll:true});
      return;
    }
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
  // The browser Back button restores the world selected in the URL.
  // Do not run an extra transition or write another history entry on replay.
  window.addEventListener('popstate',()=>{
    const parameters=new URLSearchParams(window.location.search);
    const requestedMode=parameters.get('mm');
    const nextMode=['events','connections'].includes(requestedMode)?requestedMode:'people';
    const nextId=parameters.get('event');
    if(EVENT_BY_ID[nextId])state.activeEvent=nextId;
    if(nextMode!==state.mode)setMode(nextMode,false);
    else if(nextMode!=='people'){
      panelExpanded=false;renderPanel();panel.scrollTop=0;renderBeacons();
      window.MarketEventPlanet?.focus(EVENT_BY_ID[state.activeEvent].p);
    }
  });
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
    get comparedEvent() { return (EVENTS.find(item=>item.id===compareEventId&&item.id!==state.activeEvent)||EVENTS.find(item=>item.id!==state.activeEvent)).id; },
    get events() { return EVENTS.map(({id,year,date,name,themes,url,p})=>({id,year,date,name,themes:[...themes],url,p:[...p]})); },
    setMode, selectEvent, measure
  });
})();