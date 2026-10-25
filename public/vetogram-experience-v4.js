/* VETOGRAM V4 Experience: progressive disclosure and focus editor.
 * Moves existing DOM nodes; does not duplicate controls, API calls, consent, or owner data.
 * No local persistence, no automatic Telegram/AI/publish actions.
 */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.v4Experience === 'ready') return;
  root.dataset.v4Experience = 'ready';
  root.classList.add('vetogram-v4');
  const byId = id => document.getElementById(id);
  const $ = (selector, base = document) => base.querySelector(selector);
  const screens = name => $('[data-screen="' + name + '"]');
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const announce = (message) => {
    const status = byId('v4ExperienceStatus');
    if (status) status.textContent = message;
  };

  function progressive({scope, selector, title, description = '', className = '', open = false}) {
    const owner = screens(scope);
    const content = owner && $(selector, owner);
    if (!owner || !content || content.closest('.v4-disclosure')) return null;
    const disclosure = document.createElement('details');
    disclosure.className = 'v4-disclosure ' + className;
    disclosure.open = open;
    const summary = document.createElement('summary');
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    summary.append(titleEl);
    if (description) {
      const hint = document.createElement('small');
      hint.textContent = description;
      summary.append(hint);
    }
    const body = document.createElement('div');
    body.className = 'v4-disclosure-body';
    content.before(disclosure);
    disclosure.append(summary, body);
    body.append(content); // keep original IDs, controllers and listeners
    return disclosure;
  }

  // Home: first action remains the real connected chat or explicit connection flow.
  progressive({scope:'home', selector:'.vg33-tools-panel',
    title:'Все инструменты', description:'Истории, голос, ИИ, защита и аналитика',
    className:'v4-home-toolbox'});
  const home = screens('home');
  const resume = home && byId('vg26Resume');
  const activity = home && $('.control-activity', home);
  if (home && resume && activity) home.insertBefore(resume, activity);
  const mission = byId('vg27Mission');
  if (mission) mission.setAttribute('aria-label', 'Проверенные статусы Telegram и защиты');

  // Messenger: keep chat/search immediately accessible; long connection guide is secondary.
  // The V3 messenger already provides its own native connection disclosure.
  // Do not nest a second details element around that same onboarding controller.
  const chatGuide = byId('telegramMirrorAccessDrawer') || progressive({scope:'telegram',
    selector:'.veto-mirror-access-center', title:'Подключение и безопасность',
    description:'Управление доступом к Telegram', className:'v4-chat-setup'});
  progressive({scope:'telegram', selector:'.veto-mirror-privacy-note',
    title:'Как защищаются сообщения', description:'Архив и ограничения',
    className:'v4-chat-explain'});
  progressive({scope:'telegram', selector:'.vg26-inbox-shortcuts',
    title:'Действия с перепиской', description:'AI-ответ, архив и новая история',
    className:'v4-chat-shortcuts'});
  // The explicit connection CTA remains visible until Telegram confirms
  // ownership. Do not override the native drawer's own open/close state.

  // Privacy: one explicit setup route, not an instructional wall on every visit.
  const privacySetup = progressive({scope:'privacy', selector:'#privacyBusinessOnboarding',
    title:'Настроить Anti-Delete', description:'Подключение бота и выбор разрешённых чатов',
    className:'v4-privacy-setup'});
  if (privacySetup) {
    byId('privacyEnableAllButton')?.addEventListener('click', () => { privacySetup.open = true; });
  }

  // Privacy: the archive and verified events stay visible; setup/backup explanations are opt-in.
  progressive({scope:'privacy', selector:'.ghost-archive-promise',
    title:'Как работает архив', description:'Условия сохранения сообщений',
    className:'v4-privacy-explain'});
  progressive({scope:'privacy', selector:'.ghost-backup-panel',
    title:'Резервная копия переписок', description:'Дополнительное сохранение истории',
    className:'v4-privacy-backup'});

  // Story publication: the media picker and audience are primary; fine controls stay available.
  progressive({scope:'publish', selector:'#privacyBlock',
    title:'Дополнительные настройки публикации', description:'Точный контроль истории',
    className:'v4-publish-advanced'});

  // Audience: avoid a second onboarding wall while preserving real setup buttons.
  progressive({scope:'viewers', selector:'#viewerSyncCard',
    title:'Подключение аналитики', description:'Разрешения и подробности',
    className:'v4-viewers-setup'});

  // Analytics keeps verified metrics/timelines in view; exports are secondary.
  progressive({scope:'analytics', selector:'.evidence-export-card',
    title:'Экспорт аналитики', description:'Файл CSV по запросу',
    className:'v4-analytics-export'});

  // Relay power/status stay visible; technical facts are disclosed only when needed.
  progressive({scope:'relay', selector:'.relay-consumer-facts',
    title:'Как работает Relay', description:'Резервный доступ и ограничения',
    className:'v4-relay-facts'});

  // Sticker creation: show the actual input and editable stage instead of an introductory landing.
  progressive({scope:'studio', selector:'.studio-hero',
    title:'Как создаются стикеры', description:'Процесс и возможности',
    className:'v4-sticker-guide'});
  progressive({scope:'studio', selector:'.brand-pack-card',
    title:'Бренд-наборы', description:'Расширенное создание набора',
    className:'v4-sticker-brand'});

  // Voice keeps mic, live spectrum, effects and recorder exposed; documentation is secondary.
  progressive({scope:'voice', selector:'.veto-voice-footnote',
    title:'О приватности записи', description:'Что происходит со звуком',
    className:'v4-voice-info'});

  // AI: direct dialogue is primary; advanced task and approval consoles are optional.
  const ai = screens('ai');
  const aiRoot = ai && $('#vtaiRoot', ai);
  if (aiRoot) {
    const modeRail = $('.vtai-modes', aiRoot);
    if (modeRail) {
      const secondaryModes = Array.from(modeRail.querySelectorAll('[data-vtai-mode]'))
        .filter(button => !['chat','translate','reply'].includes(button.dataset.vtaiMode));
      if (secondaryModes.length) {
        const extra = document.createElement('details');
        extra.className = 'v4-ai-modes-extra';
        const summary = document.createElement('summary');
        summary.textContent = 'Другие режимы';
        const actions = document.createElement('div');
        actions.className = 'v4-ai-mode-actions';
        extra.append(summary, actions);
        modeRail.append(extra);
        secondaryModes.forEach(button => actions.append(button));
        const syncSelected = () => {
          if (secondaryModes.some(button => button.getAttribute('aria-pressed') === 'true'))
            extra.open = true;
        };
        modeRail.addEventListener('click', () => queueMicrotask(syncSelected));
        syncSelected();
      }
    }
    const advancedIds = [
      'vtaiTasksPanel', 'vtaiRemindersPanel', 'vtaiFocusPanel', 'vtaiAgentControl'
    ];
    const modules = [
      ...advancedIds.map(byId),
      $('[aria-label="VETO Approval Center"]', aiRoot),
      $('[aria-label="VETO AI Memory"]', aiRoot)
    ].filter(node => node && aiRoot.contains(node));
    if (modules.length) {
      const disclosure = document.createElement('details');
      disclosure.className = 'v4-disclosure v4-ai-workspace';
      const summary = document.createElement('summary');
      const heading = document.createElement('strong');
      heading.textContent = 'Мои задачи и память';
      const note = document.createElement('small');
      note.textContent = 'Напоминания, разрешения и расширенные действия';
      summary.append(heading, note);
      const body = document.createElement('div');
      body.className = 'v4-disclosure-body';
      modules[0].before(disclosure);
      disclosure.append(summary,body);
      modules.forEach(node => body.append(node));
      // Ensure externally focused controls are not stranded inside a closed panel.
      disclosure.addEventListener('focusin', () => { disclosure.open = true; });
      // Opening a task mode or receiving a genuinely pending approval reveals
      // the existing real workspace instead of leaving controls inaccessible.
      aiRoot.addEventListener('click', event => {
        const mode = event.target.closest('[data-vtai-mode]')?.dataset.vtaiMode;
        if (mode === 'brief') disclosure.open = true;
      });
      const pending = byId('vtaiApprovalCount');
      if (pending) {
        const revealPending = () => {
          if (Number(pending.textContent?.trim()) > 0) disclosure.open = true;
        };
        new MutationObserver(revealPending).observe(pending,{childList:true,characterData:true,subtree:true});
        revealPending();
      }
    }
  }

  // Immersive canvas is the *real* editor canvas, not a mock or exported screenshot.
  const engine = byId('seEngine');
  const stage = engine && $('.se-stage', engine);
  const canvasActions = engine && $('.noir-canvas-actions', engine);
  const controls = engine && $('.se-controls', engine);
  let lastFocus = null;
  let focusActive = false;
  const exitFocus = () => {
    if (!focusActive) return;
    focusActive = false;
    engine.classList.remove('v4-studio-focus','v4-studio-tools-open');
    document.body.classList.remove('v4-lock-scroll');
    const button = byId('v4CanvasFocus');
    if (button) { button.textContent = '⤢ На весь экран'; button.setAttribute('aria-pressed','false'); }
    const tools = byId('v4CanvasTools');
    if (tools) { tools.setAttribute('aria-expanded','false'); tools.hidden = true; }
    if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true});
    announce('Обычный режим редактора');
  };
  if (stage && canvasActions && controls) {
    const focusButton = document.createElement('button');
    focusButton.id = 'v4CanvasFocus';
    focusButton.type = 'button';
    focusButton.className = 'se-button v4-focus-button';
    focusButton.textContent = '⤢ На весь экран';
    focusButton.setAttribute('aria-pressed','false');
    focusButton.setAttribute('aria-label','Открыть редактор истории на весь экран');
    const toolButton = document.createElement('button');
    toolButton.id = 'v4CanvasTools';
    toolButton.type = 'button';
    toolButton.className = 'se-button v4-tools-button';
    toolButton.textContent = 'Инструменты';
    toolButton.setAttribute('aria-expanded','false');
    controls.id = controls.id || 'v4StudioControls';
    toolButton.setAttribute('aria-controls', controls.id);
    toolButton.hidden = true;
    canvasActions.append(focusButton, toolButton);
    function enterFocus() {
      lastFocus = document.activeElement;
      focusActive = true;
      engine.classList.add('v4-studio-focus');
      document.body.classList.add('v4-lock-scroll');
      focusButton.textContent = '× Закрыть';
      focusButton.setAttribute('aria-pressed','true');
      toolButton.hidden = false;
      focusButton.focus({preventScroll:true});
      announce('Полноэкранный редактор. Нажми «Инструменты» для настроек.');
    }
    focusButton.addEventListener('click', () => focusActive ? exitFocus() : enterFocus());
    toolButton.addEventListener('click', () => {
      const open = engine.classList.toggle('v4-studio-tools-open');
      toolButton.setAttribute('aria-expanded',String(open));
      if (open) {
        const selected = $('[role="tab"][aria-selected="true"]', controls);
        selected?.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});
      } else focusButton.focus({preventScroll:true});
    });
    // While choosing a tool, keep the canvas visible; closing tools returns to creation.
    controls.addEventListener('click', event => {
      if (focusActive && event.target.closest('[data-se-tool]')) {
        engine.classList.add('v4-studio-tools-open');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && focusActive) {
        event.preventDefault();
        exitFocus();
      }
    });
    window.addEventListener('veto:screen-changed', event => {
      if (event.detail?.screen !== 'story-engine') exitFocus();
    });
  }

  const accessibleStatus = document.createElement('div');
  accessibleStatus.id = 'v4ExperienceStatus';
  accessibleStatus.className = 'v4-sr-only';
  accessibleStatus.setAttribute('role','status');
  accessibleStatus.setAttribute('aria-live','polite');
  document.body.append(accessibleStatus);
})();
