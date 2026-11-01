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
  // Telegram's native Close/menu chrome overlays the top of mobile Mini Apps.
  // Scope extra topbar clearance to an actual signed Telegram WebView only.
  if (window.Telegram?.WebApp?.initData) root.classList.add('v4-telegram-webview');
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
  // .control-activity can be nested below the home screen: its parent, not
  // the screen, owns the insertion point. A wrong parent throws NotFoundError
  // and aborts the rest of the experience controller on Telegram WebView.
  if (home && resume && activity && home.contains(resume) && home.contains(activity)) {
    activity.before(resume);
  }
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
    title:'Подключить Anti-Delete', description:'Выбор личных чатов прямо в Vetogram',
    className:'v4-privacy-setup', open:true});
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

  // V4.1 Vault: real archived evidence comes before setup marketing.
  // Move the *original* statistics and filter actions; existing handlers,
  // owner-scoped data and IDs remain authoritative. Never clone private data.
  const vaultScreen = screens('privacy');
  const vaultHero = vaultScreen && $('.ghost-command-card', vaultScreen);
  const vaultStats = vaultScreen && $('.ghost-health-grid', vaultScreen);
  const vaultEvidence = vaultScreen && byId('privacyEvidenceBar');
  const vaultActions = vaultScreen && $('.ghost-quick-grid', vaultScreen);
  if (vaultHero && vaultStats && vaultActions) {
    vaultStats.classList.add('v4-vault-overview');
    vaultActions.classList.add('v4-vault-actions');
    vaultHero.after(vaultStats);
    // Ground the next action in a real last-success timestamp, not a
    // misleading fixed 'Protected' status or an illustration.
    if (vaultEvidence) {
      vaultStats.after(vaultEvidence);
      vaultEvidence.after(vaultActions);
    } else {
      vaultStats.after(vaultActions);
    }
  }

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

  // Voice Studio: indicators must reflect the real recorder, not a decorative
  // equalizer saying "processing" when the microphone has never been enabled.
  // The existing recorder owns the classes: live, recording, is-requesting-mic.
  function voiceCaptureState(node) {
    if (node?.classList?.contains('recording')) return ['recording','● ИДЁТ ЗАПИСЬ'];
    if (node?.classList?.contains('live')) return ['live','● МИКРОФОН ВКЛЮЧЁН'];
    if (node?.classList?.contains('is-requesting-mic')) return ['requesting','◌ ЗАПРОС ДОСТУПА'];
    return ['off','◌ МИКРОФОН ВЫКЛЮЧЕН'];
  }
  const voiceMicState = byId('voiceMicState');
  const voiceMonitorCard = voiceMicState?.closest('.veto-voice-monitor-card');
  const voiceSignal = voiceMonitorCard && $('.veto-voice-signal', voiceMonitorCard);
  if (voiceMicState && voiceMonitorCard && voiceSignal) {
    const syncVoiceSignal = () => {
      const [state, label] = voiceCaptureState(voiceMicState);
      voiceMonitorCard.dataset.captureState = state;
      if (voiceSignal.textContent !== label) voiceSignal.textContent = label;
    };
    new MutationObserver(syncVoiceSignal).observe(voiceMicState,{
      attributes:true,attributeFilter:['class'],childList:true,characterData:true,subtree:true
    });
    syncVoiceSignal();
  }

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
        const ui=(key,ru)=>typeof window==='undefined' ? ru :
          (window.VetogramI18n?.t?.(key,ru)||ru);
        summary.textContent = ui('aiOtherModes','Другие режимы');
        const actions = document.createElement('div');
        actions.className = 'v4-ai-mode-actions';
        extra.append(summary, actions);
        modeRail.append(extra);
        secondaryModes.forEach(button => actions.append(button));
        // A secondary mode must remain identifiable when the extra-mode
        // disclosure is closed. The text is the *actual pressed mode*, never
        // a fabricated AI state. Allow users to close the list manually.
        const defaultSummary = () => ui('aiOtherModes','Другие режимы');
        let lastSelected = '';
        const syncSelected = () => {
          const selected = secondaryModes.find(button =>
            button.getAttribute('aria-pressed') === 'true');
          const mode = selected?.dataset.vtaiMode || '';
          const name = selected?.textContent?.replace(/^[^\p{L}\p{N}]+/u,'').trim() || '';
          summary.textContent = mode ? ui('aiModePrefix','Режим: ') + name : defaultSummary();
          summary.setAttribute('aria-label',mode
            ? ui('aiModeAriaPrefix','Текущий режим: ') + name + ui('aiModeAriaSuffix','. Открыть список режимов')
            : ui('aiOtherModesAria','Показать остальные режимы VETO AI'));
          extra.dataset.selectedMode = mode;
          if(mode!==lastSelected){
            extra.open=Boolean(mode);
            lastSelected=mode;
          }
        };
        modeRail.addEventListener('click', () => queueMicrotask(syncSelected));
        const modeObserver=new MutationObserver(syncSelected);
        secondaryModes.forEach(button=>modeObserver.observe(button,{
          attributes:true,attributeFilter:['aria-pressed']
        }));
        // Mutations of primary modes are not required here: the AI
        // controller updates the secondary aria-pressed flags on each switch.
        // A language change updates real mode buttons without changing
        // their aria-pressed attributes, so explicitly refresh the summary.
        if(typeof window!=='undefined')
          window.addEventListener('vetogram:locale-changed',syncSelected);
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

  // The actual thread previously exposed seven equally weighted header icons,
  // squeezing the name down to almost nothing on phones and the folded Fold.
  // Keep Back, identity, Telegram link and Search immediate; move secondary
  // actions into a native keyboard-accessible disclosure without cloning them.
  const threadView=byId('telegramThreadView');
  const threadBar=threadView && $('.veto-mirror-thread-bar',threadView);
  // The new messenger ships an accessible menu in HTML. Do not create a
  // second V4 disclosure or move its existing action buttons out of it.
  // Preserve the V4 fallback only for older pages without native markup.
  if(threadBar && !byId('v4ThreadMore') && !byId('telegramThreadActions')){
    const menu=document.createElement('details');
    menu.id='v4ThreadMore';
    menu.className='v4-thread-more';
    const summary=document.createElement('summary');
    summary.className='v4-thread-more-trigger';
    summary.textContent='···';
    summary.setAttribute('aria-label','Дополнительные действия с перепиской');
    summary.setAttribute('title','Действия с перепиской');
    const tools=document.createElement('div');
    tools.className='v4-thread-more-panel';
    tools.setAttribute('role','group');
    tools.setAttribute('aria-label','Инструменты открытого чата');
    menu.append(summary,tools);
    const secondary=[
      threadBar.querySelector('[data-open-screen="ai"]'),
      byId('telegramThreadReplyAI'),
      byId('telegramThreadBriefAI'),
      byId('telegramThreadRefresh')
    ].filter(Boolean);
    secondary.forEach(button=>{
      // Existing handlers and access checks are unchanged by DOM relocation.
      button.classList.add('v4-thread-menu-action');
      button.setAttribute('title',button.getAttribute('aria-label')||'Действие с чатом');
      const caption=document.createElement('span');
      caption.className='v4-thread-menu-caption';
      caption.textContent=button.getAttribute('aria-label')||'Действие с чатом';
      button.append(caption);
      tools.append(button);
    });
    threadBar.append(menu);
    tools.addEventListener('click',event=>{
      if(event.target.closest('button'))menu.open=false;
    });
    document.addEventListener('pointerdown',event=>{
      if(menu.open && !menu.contains(event.target))menu.open=false;
    },{passive:true});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && menu.open &&
         byId('sheet')?.hidden!==false &&
         !document.querySelector('dialog[open]')){
        event.preventDefault();menu.open=false;summary.focus();
      }
    });
    window.addEventListener('veto:screen-changed',()=>{menu.open=false;});
    if(threadView){
      new MutationObserver(()=>{if(threadView.hidden)menu.open=false;})
        .observe(threadView,{attributes:true,attributeFilter:['hidden']});
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
    engine.classList.remove('v4-studio-focus','v4-studio-tools-open','v4-layer-direct-edit');
    document.body.classList.remove('v4-lock-scroll');
    const button = byId('v4CanvasFocus');
    if (button) { button.textContent = '⤢ На весь экран'; button.setAttribute('aria-pressed','false'); }
    const tools = byId('v4CanvasTools');
    if (tools) { tools.setAttribute('aria-expanded','false'); tools.hidden = true; }
    const closeInspector = byId('v4InspectorClose');
    if (closeInspector) closeInspector.hidden = true;
    // A screen transition has already hidden the editor; returning focus
    // to an element within a hidden screen strands keyboard users.
    if(engine.classList.contains('active') && lastFocus?.isConnected)
      lastFocus.focus({preventScroll:true});
    lastFocus=null;
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
    const inspectorClose=document.createElement('button');
    inspectorClose.id='v4InspectorClose';
    inspectorClose.type='button';
    inspectorClose.className='se-button v4-inspector-close';
    inspectorClose.textContent='× Закрыть инструменты';
    inspectorClose.hidden=true;
    controls.prepend(inspectorClose);
    const closeTools=()=>{
      engine.classList.remove('v4-studio-tools-open','v4-layer-direct-edit');
      toolButton.setAttribute('aria-expanded','false');
      inspectorClose.hidden=true;
      toolButton.focus({preventScroll:true});
    };
    inspectorClose.addEventListener('click',closeTools);
    // Selecting a live canvas text layer opens its actual settings directly.
    // We never duplicate editor controls or create unsaved shadow state.
    window.addEventListener('vetogram:story-layer-selected',()=>{
      if(!focusActive || !engine.classList.contains('active'))return;
      engine.classList.add('v4-studio-tools-open','v4-layer-direct-edit');
      toolButton.setAttribute('aria-expanded','true');
      inspectorClose.hidden=false;
      byId('seTabLayers')?.click();
      byId('seLayerText')?.focus({preventScroll:true});
      announce('Выбран текстовый слой. Можно изменить текст, стиль и размер.');
    });
    window.addEventListener('vetogram:story-heading-selected',()=>{
      if(!focusActive || !engine.classList.contains('active'))return;
      engine.classList.add('v4-studio-tools-open');
      engine.classList.remove('v4-layer-direct-edit');
      toolButton.setAttribute('aria-expanded','true');
      inspectorClose.hidden=false;
      byId('seTabText')?.click();
      byId('seTitle')?.focus({preventScroll:true});
      announce('Редактирование заголовка истории.');
    });
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
      inspectorClose.hidden=!open;
      if (open) {
        inspectorClose.focus({preventScroll:true});
      } else toolButton.focus({preventScroll:true});
    });
    // While choosing a tool, keep the canvas visible; closing tools returns to creation.
    controls.addEventListener('click', event => {
      if (focusActive && event.target.closest('[data-se-tool]')) {
        engine.classList.add('v4-studio-tools-open');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && focusActive &&
          byId('sheet')?.hidden!==false &&
          !document.querySelector('dialog[open]')) {
        event.preventDefault();
        if (engine.classList.contains('v4-studio-tools-open')) closeTools();
        else exitFocus();
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
