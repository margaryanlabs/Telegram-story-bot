(() => {
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);
  const UI_STATE_KEY = 'veto-relay-ui-state-v4';
  const LEGACY_OPENED_KEY = 'veto-relay:last-opened';

  let s = {
    configured:null,
    count:0,
    busy:false,
    relay:null,
    health:null,
    alternatives:false,
    opened:0,
    error:null,
    enabled:false,
    activatedAt:0,
    pendingDisable:false,
  };

  function loadUiState() {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_STATE_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        s.enabled = Boolean(saved.enabled);
        s.activatedAt = Number(saved.activatedAt || 0) || 0;
        s.opened = Number(saved.opened || 0) || 0;
        s.pendingDisable = Boolean(saved.pendingDisable);
        if (saved.relay && typeof saved.relay === 'object') s.relay = saved.relay;
        if (saved.health) s.health = saved.health;
      }
    } catch {}
    if (!s.opened) {
      try { s.opened = Number(sessionStorage.getItem(LEGACY_OPENED_KEY) || 0) || 0; } catch {}
    }
  }

  function saveUiState() {
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify({
        enabled:s.enabled,
        activatedAt:s.activatedAt,
        opened:s.opened,
        pendingDisable:s.pendingDisable,
        relay:s.relay ? {
          id:s.relay.id || null,
          label:s.relay.label || null,
          region:s.relay.region || null,
          latencyMs:Number.isFinite(Number(s.relay.latencyMs)) ? Number(s.relay.latencyMs) : null,
          reachable:s.relay.reachable === true,
        } : null,
        health:s.health || null,
        updatedAt:Date.now(),
      }));
    } catch {}
  }

  loadUiState();

  function toast(message) {
    const el = $('toast'); if (!el) return;
    el.textContent = String(message || 'Relay error'); el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function haptic(type='light') {
    try { tg?.HapticFeedback?.impactOccurred(type); } catch {}
  }

  function successHaptic() {
    try { tg?.HapticFeedback?.notificationOccurred('success'); } catch {}
  }

  function relayErrorMessage(error) {
    const code = String(error?.data?.error || error?.code || error?.message || '');
    if (navigator.onLine === false) return 'Нет обычного интернета. Подключи Wi‑Fi или мобильную сеть.';
    if (/AbortError|timeout/i.test(code)) return 'Relay отвечает слишком долго. Попробуй снова или открой Emergency Access.';
    if (/telegram_auth_required/i.test(code)) return 'Сессия Mini App устарела. Закрой и заново открой VETO Telegram.';
    if (/relay_not_configured/i.test(code)) return 'Relay Mesh временно не настроен.';
    if (/relay_unavailable/i.test(code)) return 'Ни один Relay сейчас не подтверждён. Попробуй другой маршрут или Emergency Access.';
    return error?.message || 'Relay временно недоступен';
  }

  async function api(action, payload = {}) {
    if (!tg?.initData) {
      const error = new Error('Открой VETO Telegram внутри Telegram или используй Emergency Access');
      error.code = 'telegram_auth_required';
      throw error;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), action === 'status' ? 7000 : 10000);
    try {
      const response = await fetch('/api/relay', {
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':tg.initData},
        body:JSON.stringify({action,...payload}),
        cache:'no-store',
        signal:controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        const e = new Error(data?.message || data?.error || 'Relay временно недоступен');
        e.data = data; throw e;
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') error.code = 'timeout';
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function openTelegramLink(url) {
    if (!url) throw new Error('Telegram link не получен');
    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else location.href = url;
    } catch {
      location.href = url;
    }
  }

  function openEmergencyAccess() {
    const url = new URL('/relay.html', location.origin).toString();
    try {
      if (tg?.openLink) tg.openLink(url, { try_instant_view:false });
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      location.href = url;
    }
  }

  function showSuccessEffect() {
    const overlay = $('relaySuccessOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
    clearTimeout(showSuccessEffect.timer);
    showSuccessEffect.timer = setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(() => { overlay.hidden = true; }, 320);
    }, 2200);
  }

  function markEnabled(relay, health) {
    s.enabled = true;
    s.pendingDisable = false;
    s.activatedAt = Date.now();
    s.opened = Date.now();
    if (relay) s.relay = relay;
    if (health) s.health = health;
    try { sessionStorage.setItem(LEGACY_OPENED_KEY, String(s.opened)); } catch {}
    saveUiState();
    successHaptic();
    showSuccessEffect();
  }

  function markDisabledLocal() {
    s.enabled = false;
    s.pendingDisable = false;
    s.activatedAt = 0;
    saveUiState();
    render();
  }

  function render() {
    const pill=$('relayStatusPill'), power=$('relayPowerButton');
    if (!pill || !power) return;
    const pt=pill.querySelector('span'), strong=power.querySelector('strong'), small=power.querySelector('small');
    const active = Boolean(s.enabled);
    const hero = $('relayHero');
    const home = $('relayHomePrimary');
    const proof = $('relayConnectedProof');
    const disable = $('relayDisableButton');
    const globalBadge = $('relayGlobalBadge');

    hero?.classList.toggle('relay-active', active);
    home?.classList.toggle('relay-active', active);
    pill.classList.toggle('connected', active);
    pill.classList.toggle('ready',!active && s.configured===true&&!s.error);
    pill.classList.toggle('warn',!active && (s.configured===false||Boolean(s.error)));
    power.disabled=s.busy||(!active && s.configured===false);
    power.classList.toggle('busy',s.busy);
    power.classList.toggle('connected',active);

    if (proof) proof.hidden = !active;
    if (disable) disable.hidden = !active;
    if (globalBadge) globalBadge.hidden = !active;

    let title='Relay выключен';
    let text='VETO проверит доступные маршруты и передаст лучший в Telegram.';
    let a='Подключить Telegram Relay';
    let b='Автоматически выбрать лучший маршрут';
    let p='Проверяю Relay';

    if (active) {
      title='ПОДКЛЮЧЕНО · VETO Relay';
      text='VETO запомнил Relay как включённый на этом устройстве. Telegram продолжает использовать сохранённый proxy после закрытия Mini App.';
      a='Relay включён · Переподключить';
      b=s.relay?.region ? 'Активный маршрут · ' + s.relay.region : 'Проверить и обновить маршрут';
      p='RELAY ON';
    } else if(s.busy){
      title='Ищу лучший маршрут…'; text='VETO проверяет relay-узлы и выбирает лучший route.';
      a='Проверка Relay…'; b='Автовыбор маршрута'; p='Проверяю маршруты';
    } else if(s.configured===false){
      title='Нужны relay-узлы'; text='Production сейчас не видит MTProxy nodes.';
      a='Relay пока недоступен'; b='Открой Emergency Access'; p='Relay не настроен';
    } else if(s.error){
      title='Relay временно недоступен'; text=s.error;
      a='Попробовать снова'; b='VETO заново проверит mesh'; p='Повторная проверка'; power.disabled=false;
    } else if(s.relay){
      title='Маршрут готов'; text='Маршрут выбран. Нажми кнопку, чтобы передать его в Telegram.';
      a='Подключить этот маршрут'; b=s.health==='verified'?'Узел доступен с VETO edge':'Если не подключится — смени маршрут';
      p=s.health==='verified'?'Маршрут проверен':'Маршрут выдан';
    } else if(s.configured){
      text='Доступно маршрутов: '+(s.count||1)+'. VETO выберет лучший при подключении.';
      p='Relay Mesh готов';
    }

    pt.textContent=p;
    $('relayPowerState').textContent=title;
    $('relayStateText').textContent=text;
    strong.textContent=a;
    small.textContent=b;

    const r=s.relay;
    $('relayRouteLabel').textContent=r?.label||'Автовыбор';
    $('relayRouteId').textContent=r?.id?'route · '+r.id:'ещё не выбран';
    $('relayRouteRegion').textContent=r?.region||'AUTO';
    $('relayRouteLatency').textContent=Number.isFinite(Number(r?.latencyMs))?Math.round(Number(r.latencyMs))+' ms':'—';
    $('relayRouteHealth').textContent=active ? 'ON' : s.health==='verified'?'Verified':s.health==='degraded'?'Degraded':'—';
    $('relayRotateButton').hidden=!(r&&s.alternatives);

    if($('homeRelayState')) $('homeRelayState').textContent=active?'RELAY ON · '+(r?.region||'AUTO'):s.configured===false?'Нужно настроить':s.error?'Проверить Relay':'Telegram-only маршрут';
    if($('homeRelayPrimaryState')) $('homeRelayPrimaryState').textContent=active?'RELAY ON':s.configured===false?'Нужно настроить':s.error?'Проверить Relay':'Mesh готов';
    if($('relayGlobalBadgeRoute')) $('relayGlobalBadgeRoute').textContent=r?.region||'AUTO';
    if($('relayHomeTitle')) $('relayHomeTitle').textContent=active?'VETO Relay включён':'Telegram не подключается?';
    if($('relayHomeText')) $('relayHomeText').textContent=active
      ? 'Режим сохранён на этом устройстве. Telegram должен продолжать использовать proxy после закрытия VETO.'
      : 'Включи отдельный маршрут только для Telegram. Остальной интернет телефона не меняется.';
    if($('homeRelayPrimaryButtonTitle')) $('homeRelayPrimaryButtonTitle').textContent=active?'RELAY ON · Управлять':'Включить Telegram Relay';
    if($('homeRelayPrimaryButtonText')) $('homeRelayPrimaryButtonText').textContent=active
      ? (r?.label ? r.label+' · '+(r?.region||'AUTO') : 'Открыть Private Relay')
      : 'Открыть Private Relay';
  }

  async function status(silent=true){
    if(!tg?.initData){
      s={...s,configured:false,error:'Открой VETO Telegram внутри Telegram.'};
      render();
      return;
    }
    try{
      const d=await api('status');
      s={...s,configured:Boolean(d.configured),count:Number(d.nodeCount||0),alternatives:Boolean(d.canRotate),error:null};
    } catch(e) {
      const message=relayErrorMessage(e);
      s={...s,error:message};
      if(!silent)toast(message);
    }
    render();
  }

  function openRoute(data) {
    const url = data?.tgUrl || data?.connectUrl;
    if(!url) throw new Error('Telegram proxy link не получен');
    markEnabled(data?.relay || s.relay, data?.routeHealth || s.health);
    render();
    openTelegramLink(url);
  }

  async function connect(rotate=false){
    if(s.busy)return;
    s.busy=true; s.error=null; render(); haptic('medium');
    try{
      const d=await api(rotate?'rotate':'connect',{exclude:rotate&&s.relay?.id?[s.relay.id]:[]});
      s={...s,configured:true,relay:d.relay||null,health:d.routeHealth||null,alternatives:Boolean(d.alternatives),error:null};
      openRoute(d);
    }catch(e){
      const message=relayErrorMessage(e);
      s={...s,configured:e?.data?.configured===false?false:s.configured,error:message};
      toast(message);
    }finally{
      s.busy=false; render();
    }
  }

  function openDisableSettings() {
    s.pendingDisable = true;
    saveUiState();
    render();
    haptic('medium');
    toast('Открыл Telegram Proxy → Use Proxy. Выключи переключатель там.');
    try {
      openTelegramLink('tg://settings/data/proxy/use-proxy');
    } catch {
      openTelegramLink('tg://settings/data/proxy');
    }
  }

  function confirmDisableSheet() {
    if (!s.pendingDisable || !$('sheetContent') || !$('sheet')) return;
    $('sheetContent').innerHTML =
      '<span class="kicker">RELAY CONTROL</span>'+
      '<div class="feature-guide-title"><span>○</span><h2>Relay выключен в Telegram?</h2></div>'+
      '<p>Telegram управляет proxy локально и не отдаёт Mini App фактический ON/OFF статус. Если ты выключил <b>Use Proxy</b>, подтверди — VETO тоже сбросит зелёный статус.</p>'+
      '<div class="sheet-actions">'+
      '<button class="accent" data-relay-disable-confirm="yes">Да, выключен</button>'+
      '<button data-relay-disable-confirm="no">Оставить RELAY ON</button>'+
      '</div>';
    $('sheetBackdrop').hidden=false;
    $('sheet').hidden=false;
  }

  function closeSheet(){
    if($('sheet'))$('sheet').hidden=true;
    if($('sheetBackdrop'))$('sheetBackdrop').hidden=true;
  }

  function openScreen(){
    document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen==='relay'));
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    $('actionDock')?.classList.add('hidden');
    closeSheet();
    scrollTo({top:0,behavior:'smooth'});
    status(true);
  }

  function guide(){
    if(!$('sheetContent'))return openScreen();
    $('sheetContent').innerHTML='<span class="kicker">PRIVATE RELAY</span><div class="feature-guide-title"><span>⇄</span><h2>Резервный маршрут только для Telegram</h2></div><p>VETO выбирает MTProxy route и передаёт его нативному Telegram. Это не VPN для всего телефона.</p><div class="feature-guide-facts"><div><span>Зачем</span><strong>Резервный путь при нестабильном или ограниченном соединении.</strong></div><div><span>Что нужно</span><strong>Доступ к сообщениям не нужен.</strong></div></div><div class="sheet-actions"><button class="accent" data-relay-action="open">Открыть Private Relay</button><button data-relay-action="close">Закрыть</button></div>';
    $('sheetBackdrop').hidden=false;
    $('sheet').hidden=false;
  }

  $('homeRelayCard')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();guide();},true);
  document.querySelectorAll('[data-open-screen="relay"]').forEach(x=>x.addEventListener('click',()=>setTimeout(()=>status(true),0)));
  $('relayPowerButton')?.addEventListener('click',()=>connect(false));
  $('relayDisableButton')?.addEventListener('click',openDisableSettings);
  $('relayRotateButton')?.addEventListener('click',()=>connect(true));
  $('relayRefreshButton')?.addEventListener('click',()=>status(false));
  $('relayEmergencyButton')?.addEventListener('click',openEmergencyAccess);
  $('relayEmergencyHomeButton')?.addEventListener('click',openEmergencyAccess);

  $('sheet')?.addEventListener('click',e=>{
    const action=e.target.closest('[data-relay-action]')?.dataset?.relayAction;
    if(action==='open')openScreen();
    if(action==='close')closeSheet();

    const disable=e.target.closest('[data-relay-disable-confirm]')?.dataset?.relayDisableConfirm;
    if(disable==='yes'){ markDisabledLocal(); closeSheet(); toast('VETO Relay отмечен как выключенный'); }
    if(disable==='no'){ s.pendingDisable=false; saveUiState(); render(); closeSheet(); }
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible' && s.pendingDisable){
      setTimeout(confirmDisableSheet,350);
    }
  });

  window.addEventListener('pageshow',()=>{ render(); if(s.pendingDisable) setTimeout(confirmDisableSheet,500); });

  render();
  if(tg?.initData)status(true);
})();