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

  // Eight sourced episodes. Coordinates are SYMBOLIC archive positions, not geography.
  // Four original featured points retain their exact V18 coordinates.
  const EVENTS = Object.freeze([
    {
      "id": "1907",
      "year": "1907",
      "date": "22 OCT 1907",
      "name": "Паника 1907 года",
      "short": "Банковская паника",
      "detail": "После прекращения работы Knickerbocker Trust паника распространилась среди трастовых компаний Нью-Йорка. Нехватка доверия переросла в кризис ликвидности.",
      "mechanism": "Доверие → снятие депозитов → дефицит краткосрочных денег",
      "lesson": "Ликвидность и уверенность контрагентов могут исчезнуть быстрее, чем меняется оценка долгосрочных активов.",
      "themes": [
        "Risk",
        "Patience"
      ],
      "source": "Federal Reserve History",
      "url": "https://www.federalreservehistory.org/essays/panic-of-1907",
      "p": [
        -0.62,
        -0.42
      ],
      "featured": true,
      "metric": "1907",
      "metricLabel": "СИСТЕМНАЯ ПАНИКА",
      "scope": "БАНКИ · ДЕНЕЖНЫЕ РЫНКИ",
      "impact": "Банковские изъятия и кризис доверия создали острый дефицит краткосрочной ликвидности.",
      "chapters": [
        "Рост опасений относительно трастовых компаний",
        "Набег вкладчиков на Knickerbocker Trust",
        "Распространение дефицита ликвидности"
      ]
    },
    {
      "id": "1929",
      "year": "1929",
      "date": "28 OCT 1929",
      "name": "Биржевой крах 1929 года",
      "short": "Чёрный понедельник 1929",
      "detail": "28 октября 1929 года Dow Jones потерял почти 13%, а 29 октября упал ещё почти на 12%. Обвал последовал за многолетним ростом акций и расширением маржинального кредитования.",
      "mechanism": "Маржинальный кредит → распродажи → обрушение котировок",
      "lesson": "Леверидж усиливает движение цены; восстановление после крупного падения может занять гораздо больше времени, чем ожидают участники.",
      "themes": [
        "Risk",
        "FOMO",
        "Discipline"
      ],
      "source": "Federal Reserve History",
      "url": "https://www.federalreservehistory.org/essays/stock-market-crash-of-1929",
      "p": [
        -0.52,
        0.36
      ],
      "featured": false,
      "metric": "−13%",
      "metricLabel": "DJIA · 28 OCT 1929",
      "scope": "АКЦИИ · ПЛЕЧО",
      "impact": "Двухдневное падение разрушило уверенность участников; дальнейшие банковские кризисы углубили экономический спад.",
      "chapters": [
        "Бум акций и покупки с заёмными средствами",
        "Падение DJIA почти на 13% 28 октября",
        "Последующая слабость и банковские кризисы"
      ]
    },
    {
      "id": "1987",
      "year": "1987",
      "date": "19 OCT 1987",
      "name": "Чёрный понедельник",
      "short": "Рыночный обвал",
      "detail": "19 октября 1987 года индекс Dow Jones Industrial Average упал на 22,6% за одну торговую сессию. Глобальные рынки испытали резкое падение.",
      "mechanism": "Резкий обвал → рыночный стресс → проблемы исполнения",
      "lesson": "Модель риска должна учитывать разрывы цены, резкое ухудшение ликвидности и невозможность выхода по ожидаемой цене.",
      "themes": [
        "Risk",
        "Discipline"
      ],
      "source": "Federal Reserve History",
      "url": "https://www.federalreservehistory.org/essays/stock-market-crash-of-1987",
      "p": [
        0.52,
        -0.5
      ],
      "featured": true,
      "metric": "−22,6%",
      "metricLabel": "DJIA · 19 OCT 1987",
      "scope": "АКЦИИ · ИСПОЛНЕНИЕ",
      "impact": "Однодневный рекордный обвал показал уязвимость ликвидности и исполнения приказов в условиях рыночной паники.",
      "chapters": [
        "Продажи и усиливающийся рыночный стресс",
        "Резкое падение фондовых индексов",
        "Проблемы ликвидности и исполнения"
      ]
    },
    {
      "id": "1998",
      "year": "1998",
      "date": "23 SEP 1998",
      "name": "Кризис Long-Term Capital Management",
      "short": "LTCM / леверидж",
      "detail": "23 сентября 1998 года консорциум из 14 банков и брокерских фирм согласился вложить около $3,6 млрд в LTCM, чтобы предотвратить вынужденную распродажу крупных позиций фонда.",
      "mechanism": "Сложные ставки с плечом → потери и маржинальное давление → частная рекапитализация",
      "lesson": "Даже хеджированные позиции могут стать системно опасными при сочетании высокого плеча, неликвидности и сходных сделок у множества участников.",
      "themes": [
        "Risk",
        "Discipline",
        "Patience"
      ],
      "source": "Federal Reserve History",
      "url": "https://www.federalreservehistory.org/essays/ltcm-near-failure",
      "p": [
        0.04,
        0.64
      ],
      "featured": false,
      "metric": "$3,6 млрд",
      "metricLabel": "ЧАСТНЫЙ КАПИТАЛ · SEP 1998",
      "scope": "ХЕДЖ-ФОНД · ПЛЕЧО",
      "impact": "Частный консорциум рекапитализировал фонд, снижая риск принудительной продажи его активов на нестабильном рынке.",
      "chapters": [
        "Высокий леверидж и уязвимые торговые позиции",
        "Убытки и риск принудительной распродажи",
        "23 сентября: соглашение 14 финансовых организаций"
      ]
    },
    {
      "id": "2008",
      "year": "2008",
      "date": "15 SEP 2008",
      "name": "Банкротство Lehman Brothers",
      "short": "Кризис доверия",
      "detail": "15 сентября 2008 года Lehman Brothers подала заявление о банкротстве. Давление на финансирование, контрагентов и денежные рынки усилило финансовый кризис.",
      "mechanism": "Потеря доверия → отток финансирования → системный стресс",
      "lesson": "Концентрация рисков и зависимость от краткосрочного фондирования могут быть важнее видимой цены активов.",
      "themes": [
        "Risk",
        "Discipline",
        "Patience"
      ],
      "source": "FDIC · Crisis chronology",
      "url": "https://www.fdic.gov/history/2000-2009",
      "p": [
        -0.14,
        0.11
      ],
      "featured": true,
      "metric": "15 SEP",
      "metricLabel": "LEHMAN · 2008",
      "scope": "БАНКИ · КРЕДИТНЫЕ РЫНКИ",
      "impact": "Банкротство Lehman усилило кризис доверия и давление на финансовые институты и рынки фондирования.",
      "chapters": [
        "Накопленные риски на балансах и финансировании",
        "Банкротство Lehman Brothers",
        "Стресс контрагентов и денежных рынков"
      ]
    },
    {
      "id": "2010",
      "year": "2010",
      "date": "06 MAY 2010",
      "name": "Flash Crash 2010",
      "short": "Мгновенный обвал",
      "detail": "6 мая 2010 года американские фондовые и фьючерсные индексы за несколько минут дополнительно упали примерно на 5–6%, затем почти столь же быстро восстановились. SEC и CFTC изучили рыночную структуру и ликвидность.",
      "mechanism": "Давление продаж → исчезновение ликвидности → резкий ценовой провал и отскок",
      "lesson": "Высокая скорость торгов не гарантирует ликвидность: стоп-приказы и рыночное исполнение могут сработать намного хуже ожидаемого.",
      "themes": [
        "Risk",
        "Discipline",
        "FOMO"
      ],
      "source": "SEC / CFTC Joint Report",
      "url": "https://www.sec.gov/about/reports-publications/newsstudies2010marketevents-reportpdf",
      "p": [
        0.19,
        -0.29
      ],
      "featured": false,
      "metric": "5–6%",
      "metricLabel": "ПРОВАЛ ЗА МИНУТЫ",
      "scope": "АКЦИИ · МИКРОСТРУКТУРА",
      "impact": "Кратковременная дезорганизация ликвидности сопровождалась экстремальными ценами и резким восстановлением.",
      "chapters": [
        "Повышенная волатильность и давление продаж",
        "Кратковременный провал индексов на 5–6%",
        "Быстрый возврат цен и расследование SEC/CFTC"
      ]
    },
    {
      "id": "2020",
      "year": "2020",
      "date": "09 MAR 2020",
      "name": "Пандемический шок ликвидности",
      "short": "Dash for cash",
      "detail": "В марте 2020 года распродажи затронули даже рынок казначейских бумаг США. 9 марта резкое движение S&P 500 привело к временному прекращению торгов.",
      "mechanism": "Спрос на наличность → принудительные продажи → падение ликвидности",
      "lesson": "В системном стрессе корреляции и глубина рынка могут вести себя иначе, чем в обычные дни.",
      "themes": [
        "Risk",
        "FOMO",
        "Patience"
      ],
      "source": "Federal Reserve Bank of New York",
      "url": "https://libertystreeteconomics.newyorkfed.org/2020/05/treasury-market-liquidity-and-the-federal-reserve-during-the-covid-19-pandemic/",
      "p": [
        0.62,
        0.34
      ],
      "featured": true,
      "metric": "MAR 2020",
      "metricLabel": "CASH DEMAND",
      "scope": "ОБЛИГАЦИИ · АКЦИИ",
      "impact": "Спрос на наличность ухудшил ликвидность даже в сегментах, обычно рассматриваемых как защитные.",
      "chapters": [
        "Резкий рост неопределённости и спроса на деньги",
        "Продажи акций и казначейских бумаг",
        "Экстренные действия для стабилизации рынков"
      ]
    },
    {
      "id": "2023",
      "year": "2023",
      "date": "10 MAR 2023",
      "name": "Крах Silicon Valley Bank",
      "short": "Банковский набег",
      "detail": "После стремительного оттока незастрахованных депозитов Silicon Valley Bank был закрыт 10 марта 2023 года. Рост ставок ранее снизил рыночную стоимость части его портфеля ценных бумаг.",
      "mechanism": "Рост ставок → нереализованные потери → бегство вкладчиков",
      "lesson": "Риск процентной ставки на активах и концентрация источников финансирования могут соединиться в стремительный кризис ликвидности.",
      "themes": [
        "Risk",
        "Discipline"
      ],
      "source": "FDIC · Regional bank failures",
      "url": "https://www.fdic.gov/news/speeches/2024/lessons-learned-us-regional-bank-failures-2023",
      "p": [
        -0.67,
        0.04
      ],
      "featured": false,
      "metric": "$42 млрд",
      "metricLabel": "ОТТОК · 9 MAR 2023",
      "scope": "БАНКИ · СТАВКИ",
      "impact": "За один день банк столкнулся с оттоком около $42 млрд депозитов; на следующий день регуляторы закрыли SVB.",
      "chapters": [
        "Повышение ставок и убытки по облигациям",
        "Резкий отток незастрахованных вкладов",
        "10 марта: закрытие банка и вмешательство FDIC"
      ]
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
      '" aria-pressed="' + (e.id === state.activeEvent) + '" aria-label="' + escape(e.year + ': ' + e.name) + '"><b>' + e.year + '</b><small>' + escape(e.short) + '</small></button>').join('') +
      '</div>';
  }
  function themeButtons(event) {
    return '<div class="mh-theme-list">' + event.themes.map(t =>
      '<button type="button" data-mh-theme="' + t + '"><span>✦ ' + escape(THEME_NAMES[t]) +
      '</span><small>Истории этой темы ↗</small></button>').join('') + '</div>';
  }
  function eventMarkup(event) {
    const steps=event.mechanism.split('→').map((part,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+escape(part.trim())+'</strong></li>').join('');
    const chapters=event.chapters.map((item,i)=>'<div class="mh-chronicle-step"><span>'+String(i+1).padStart(2,'0')+'</span><p>'+escape(item)+'</p></div>').join('');
    return '<div class="mh-v16-record mh-chronicle-dossier">' +
      '<div class="mh-v16-record-meta"><span>◈ HISTORICAL RECORD</span><time>'+escape(event.date)+'</time></div>' +
      '<div class="mh-v16-record-title"><span class="mh-v16-record-year">'+escape(event.year)+'</span><h2>'+escape(event.name)+'</h2></div>' +
      '<div class="mh-chronicle-impact"><div><small>MARKET SIGNAL / HISTORICAL</small><strong>'+escape(event.metric)+'</strong><span>'+escape(event.metricLabel)+'</span></div><em>'+escape(event.scope)+'</em></div>' +
      '<section class="mh-v16-research-card mh-v16-context"><div class="mh-v16-card-icon">01</div><div><h3>ЧТО ПРОИЗОШЛО</h3><p>'+escape(event.detail)+'</p></div></section>' +
      '<section class="mh-v16-research-card mh-chronicle-story"><div class="mh-v16-card-icon">02</div><div><h3>ХРОНОЛОГИЯ ШОКА</h3><div class="mh-chronicle-steps">'+chapters+'</div></div></section>' +
      '<section class="mh-v16-research-card mh-v16-transmission"><div class="mh-v16-card-icon">03</div><div><h3>МЕХАНИЗМ ЗАРАЖЕНИЯ</h3><ol class="mh-v16-steps">'+steps+'</ol></div></section>' +
      '<section class="mh-v16-research-card mh-chronicle-impact-text"><div class="mh-v16-card-icon">04</div><div><h3>РЕАКЦИЯ РЫНКОВ</h3><p>'+escape(event.impact)+'</p></div></section>' +
      '<section class="mh-v16-research-card mh-v16-lesson"><div class="mh-v16-card-icon">05</div><div><h3>УРОК ДЛЯ ТРЕЙДЕРА</h3><p>'+escape(event.lesson)+'</p></div></section>' +
      '<div class="mh-v16-card-footer"><button type="button" data-mh-go-connections>ИССЛЕДОВАТЬ ПАРАЛЛЕЛИ <span aria-hidden="true">↗</span></button>' +
      '<a href="'+escape(event.url)+'" target="_blank" rel="noopener noreferrer">ИСТОЧНИК · '+escape(event.source)+' ↗</a></div></div>';
  }
  function connectionMarkup(event) {
    const related=EVENTS.filter(e=>e.id!==event.id&&e.themes.some(t=>event.themes.includes(t))).sort((a,b)=>b.themes.filter(t=>event.themes.includes(t)).length-a.themes.filter(t=>event.themes.includes(t)).length).slice(0,4);
    return '<div class="mh-v16-record mh-v16-connection-record">' +
      '<div class="mh-v16-record-meta"><span>◈ THEMATIC INTELLIGENCE</span><time>'+escape(event.date)+'</time></div>' +
      '<div class="mh-v16-record-title"><span class="mh-v16-record-year">'+escape(event.year)+'</span><h2>'+escape(event.name)+'</h2></div>' +
      '<p class="mh-v16-connection-notice">Сопоставляем общие темы и механизмы. Эти связи не доказывают причинность и не означают, что авторы демо-историй участвовали в событии.</p>' +
      '<div class="mh-v16-section-label"><span>01</span> ЧЕЛОВЕЧЕСКИЕ УРОКИ</div>'+themeButtons(event) +
      '<div class="mh-v16-section-label"><span>02</span> ИСТОРИЧЕСКИЕ ПАРАЛЛЕЛИ</div>'+
      '<div class="mh-v16-related-grid">'+related.map(e=>'<button type="button" class="mh-v16-related-card" data-mh-event="'+e.id+'"><b>'+escape(e.year)+'</b><strong>'+escape(e.short)+'</strong><small>'+e.themes.filter(t=>event.themes.includes(t)).map(t=>escape(THEME_NAMES[t])).join(' · ')+'</small><span aria-hidden="true">↗</span></button>').join('')+'</div>'+
      '<a class="mh-v16-source-link" href="'+escape(event.url)+'" target="_blank" rel="noopener noreferrer">ИСТОЧНИК СОБЫТИЯ · '+escape(event.source)+' ↗</a></div>';
  }
  
  let panelExpanded = false;
  function renderPanel() {
    const event = EVENT_BY_ID[state.activeEvent];
    panel.classList.toggle('is-expanded',panelExpanded);
    window.MarketSignalDirector?.setEvent(event);
    panel.innerHTML = '<button type="button" class="mh-panel-grip" data-mh-panel-toggle aria-expanded="'+panelExpanded+'"><span><small>FINANCIAL HISTORY / '+event.year+'</small><strong>'+escape(event.name)+'</strong></span><em>'+(panelExpanded?'СВЕРНУТЬ ↓':'ПОДРОБНЕЕ ↑')+'</em></button>' +
      '<div class="mh-panel-top"><span>◈ EVENT CORE / RESEARCH</span><span>'+String(EVENTS.length).padStart(2,'0')+' / SOURCED EVENTS</span></div>' +
      '<nav class="mh-core-tabs" aria-label="Исследование истории"><button type="button" data-mh-mode="events" aria-pressed="'+(state.mode === 'events')+'" class="'+(state.mode === 'events'?'is-active':'')+'">СОБЫТИЯ</button><button type="button" data-mh-mode="connections" aria-pressed="'+(state.mode === 'connections')+'" class="'+(state.mode === 'connections'?'is-active':'')+'">СВЯЗИ</button></nav>' +
      timeline() + '<div class="mh-event-peek"><strong>'+escape(event.metric)+'</strong><span>'+escape(event.metricLabel)+'</span><small>'+escape(event.scope)+'</small></div>' +
      '<div class="mh-panel-body">' + (state.mode === 'connections' ? connectionMarkup(event) : eventMarkup(event)) + '</div>' +
      '<p class="mh-disclaimer">Исторические факты снабжены источниками. Символические связи — тематические, не доказательство причинности и не свидетельства реальных трейдеров.</p>';
    const rail=panel.querySelector('.mh-timeline'),current=rail?.querySelector('.is-active');
    if(rail&&current&&!panelExpanded){
      rail.scrollLeft=Math.max(0,current.offsetLeft-rail.offsetLeft-rail.clientWidth/2+current.offsetWidth/2);
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
      EVENTS.filter(other=>other.id!==selected.id&&other.themes.some(t=>selected.themes.includes(t))).slice(0,4).forEach(other => {
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
      button.className = 'mh-beacon' + (event.featured ? ' is-featured' : ' is-archive') + (event.id === state.activeEvent ? ' is-active' : '');
      button.dataset.mhBeacon = event.id;
      button.setAttribute('aria-label',event.year + ': ' + event.name + '. Выбрать историческое событие');
      button.setAttribute('aria-pressed',String(event.id === state.activeEvent));
      button.innerHTML = '<span aria-hidden="true" class="mh-beacon-ring"></span><span class="mh-beacon-year">' + event.year + '</span>';
      layer.append(button);
    });
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
    if (mode === 'people') panelExpanded = false;
    // Keep the current panel state when switching Events / Connections.
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
    if (update) updateUrl();
  }
  function selectEvent(id) {
    if (!EVENT_BY_ID[id]) return;
    state.activeEvent = id;
    // Scene-first: choosing a year focuses its archive star; dossier is optional.
    renderPanel();
    renderBeacons();
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
  layer.addEventListener('click', event => {
    const beacon = event.target instanceof Element ? event.target.closest('[data-mh-beacon]') : null;
    if (!beacon) return;
    event.stopPropagation();
    selectEvent(beacon.dataset.mhBeacon);
  });
  app.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if(target.closest('[data-mh-panel-toggle]')) { panelExpanded = !panelExpanded; renderPanel(); return; }
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
    get events() { return EVENTS.map(({id,year,date,name,themes,url,p,featured})=>({id,year,date,name,themes:[...themes],url,p:[...p],featured})); },
    setMode, selectEvent, measure
  });
})();