(() => {
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);
  const UI_STATE_KEY = 'veto-connect-ui-state-v5';
  const LEGACY_KEYS = ['veto-relay-ui-state-v4'];
  const LEGACY_OPENED_KEY = 'veto-relay:last-opened';

  let s = {
    configured:null,count:0,busy:false,relay:null,health:null,alternatives:false,
    opened:0,error:null,enabled:false,activatedAt:0,failoverBusy:false,
    pendingRelay:null,pendingHealth:null,pendingAt:0,failedIds:[],
  };

  function loadUiState() {
    let saved = null;
    for (const key of [UI_STATE_KEY, ...LEGACY_KEYS]) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (parsed && typeof parsed === 'object') { saved = parsed; break; }
      } catch {}
    }
    if (saved) {
      s.enabled = Boolean(saved.enabled);
      s.activatedAt = Number(saved.activatedAt || 0) || 0;
      s.opened = Number(saved.opened || 0) || 0;
      if (saved.relay && typeof saved.relay === 'object') s.relay = saved.relay;
      if (saved.health) s.health = saved.health;
      if (saved.pendingRelay && typeof saved.pendingRelay === 'object') s.pendingRelay = saved.pendingRelay;
      s.pendingHealth = saved.pendingHealth || null;
      s.pendingAt = Number(saved.pendingAt || 0) || 0;
      if (s.pendingAt && Date.now() - s.pendingAt > 10 * 60 * 1000) {
        s.pendingRelay = null;
        s.pendingHealth = null;
        s.pendingAt = 0;
      }
    }
    if (!s.opened) {
      try { s.opened = Number(sessionStorage.getItem(LEGACY_OPENED_KEY) || 0) || 0; } catch {}
    }
  }

  function saveUiState() {
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify({
        enabled:s.enabled,activatedAt:s.activatedAt,opened:s.opened,
        relay:s.relay ? {
          id:s.relay.id||null,label:s.relay.label||null,region:s.relay.region||null,
          latencyMs:Number.isFinite(Number(s.relay.latencyMs))?Number(s.relay.latencyMs):null,
          reachable:s.relay.reachable===true,
        } : null,
        health:s.health||null,
        pendingRelay:s.pendingRelay ? {
          id:s.pendingRelay.id||null,label:s.pendingRelay.label||null,region:s.pendingRelay.region||null,
          latencyMs:Number.isFinite(Number(s.pendingRelay.latencyMs))?Number(s.pendingRelay.latencyMs):null,
          reachable:s.pendingRelay.reachable===true,
        } : null,
        pendingHealth:s.pendingHealth||null,pendingAt:s.pendingAt||0,updatedAt:Date.now(),
      }));
    } catch {}
  }

  loadUiState();

  function toast(message) {
    const el=$('toast'); if(!el)return;
    el.textContent=String(message||'Ошибка'); el.classList.add('show');
    clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),3000);
  }

  function haptic(type='light'){ try{tg?.HapticFeedback?.impactOccurred(type);}catch{} }
  function successHaptic(){ try{tg?.HapticFeedback?.notificationOccurred('success');}catch{} }

  function relayErrorMessage(error) {
    const code=String(error?.data?.error||error?.code||error?.message||'');
    if(navigator.onLine===false)return 'Нет интернета. Подключи Wi‑Fi или мобильную сеть.';
    if(/AbortError|timeout/i.test(code))return 'Связь отвечает слишком долго. Попробуй ещё раз.';
    if(/telegram_auth_required/i.test(code))return 'Открой VETO заново из Telegram.';
    if(/relay_not_configured/i.test(code))return 'Защита временно недоступна.';
    if(/relay_unavailable/i.test(code))return 'Сейчас не удалось найти рабочий путь. Попробуй ещё раз.';
    return error?.message||'Не удалось включить защиту.';
  }

  async function api(action,payload={}) {
    if(!tg?.initData){
      const e=new Error('Открой VETO из Telegram или используй аварийный доступ');
      e.code='telegram_auth_required'; throw e;
    }
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),action==='status'?7000:10000);
    try{
      const response=await fetch('/api/relay',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':tg.initData},
        body:JSON.stringify({action,...payload}),
        cache:'no-store',signal:controller.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.ok){
        const e=new Error(data?.message||data?.error||'Защита временно недоступна');
        e.data=data; throw e;
      }
      return data;
    }catch(error){
      if(error?.name==='AbortError')error.code='timeout';
      throw error;
    }finally{clearTimeout(timer);}
  }

  function openTelegramLink(primaryUrl,fallbackUrl){
    const primary=String(primaryUrl||'').trim();
    const fallback=String(fallbackUrl||'').trim();
    if(!primary&&!fallback)throw new Error('Telegram link не получен');

    // Telegram Mini Apps handle HTTPS t.me links more consistently than raw tg://
    // deep links, so prefer the official t.me proxy URL and keep tg:// as fallback.
    if(primary){
      try{
        if(tg?.openTelegramLink&&/^https:\/\/t\.me\//i.test(primary)){
          tg.openTelegramLink(primary);
          return true;
        }
        location.href=primary;
        return true;
      }catch{}
    }

    if(fallback){
      try{
        location.href=fallback;
        return true;
      }catch{}
    }

    throw new Error('Не удалось открыть настройки proxy в Telegram');
  }

  function openEmergencyAccess(){
    const url=new URL('/relay.html',location.origin).toString();
    try{ if(tg?.openLink)tg.openLink(url,{try_instant_view:false}); else window.open(url,'_blank','noopener,noreferrer'); }
    catch{ location.href=url; }
  }

  function showSuccessEffect(){
    const overlay=$('relaySuccessOverlay'); if(!overlay)return;
    overlay.hidden=false;
    requestAnimationFrame(()=>overlay.classList.add('show'));
    clearTimeout(showSuccessEffect.timer);
    showSuccessEffect.timer=setTimeout(()=>{
      overlay.classList.remove('show');
      setTimeout(()=>{overlay.hidden=true;},320);
    },2100);
  }

  function markEnabled(relay,health){
    s.enabled=true;s.activatedAt=Date.now();s.opened=Date.now();
    if(relay)s.relay=relay;if(health)s.health=health;
    s.pendingRelay=null;s.pendingHealth=null;s.pendingAt=0;s.failedIds=[];
    try{sessionStorage.setItem(LEGACY_OPENED_KEY,String(s.opened));}catch{}
    saveUiState();successHaptic();showSuccessEffect();
  }

  function markPending(relay,health){
    s.enabled=false;
    s.pendingRelay=relay||null;
    s.pendingHealth=health||null;
    s.pendingAt=Date.now();
    if(relay)s.relay=relay;
    if(health)s.health=health;
    saveUiState();
    render();
  }

  function markDisabledLocal(){
    s.enabled=false;s.activatedAt=0;s.error=null;
    s.pendingRelay=null;s.pendingHealth=null;s.pendingAt=0;
    saveUiState();render();
  }

  function render(){
    const pill=$('relayStatusPill'),power=$('relayPowerButton');
    if(!pill||!power)return;
    const pt=pill.querySelector('span'),strong=power.querySelector('strong'),small=power.querySelector('small');
    const active=Boolean(s.enabled),r=s.relay;
    const pending=Boolean(s.pendingRelay&&!active);

    $('relayHero')?.classList.toggle('relay-active',active);
    $('relayHomePrimary')?.classList.toggle('relay-active',active);
    pill.classList.toggle('connected',active);
    pill.classList.toggle('ready',!active&&s.configured===true&&!s.error);
    pill.classList.toggle('warn',!active&&(s.configured===false||Boolean(s.error)));
    power.disabled=s.busy||(!active&&s.configured===false);
    power.classList.toggle('busy',s.busy);
    power.classList.toggle('connected',active);
    if($('relayConnectedProof'))$('relayConnectedProof').hidden=!active;
    if($('relayDisableButton'))$('relayDisableButton').hidden=!active;
    if($('relayGlobalBadge'))$('relayGlobalBadge').hidden=!active;
    if($('relayPendingConfirm'))$('relayPendingConfirm').hidden=!pending;

    let title='Защита выключена',text='Нажми один раз — VETO сам выберет рабочий путь.',a='Защитить Telegram',b='VETO всё выберет автоматически',p='Готово';
    let simple='Готово к включению',simpleText='VETO автоматически выберет лучший доступный путь.';

    if(s.pendingRelay&&!active){
      title='Подтверди подключение в Telegram';
      text='Telegram открыл настройки proxy. Включи маршрут и вернись сюда.';
      a='Открыть Telegram ещё раз';b='Если окно proxy не открылось — нажми ещё раз';p='ПРОВЕРКА';
      simple='Проверь Telegram';simpleText='После подключения вернись и подтверди, что Telegram работает.';
      power.disabled=false;
    }else if(active){
      title='ЗАЩИТА ВКЛЮЧЕНА';
      text='Защита включена и сохранена на этом устройстве.';
      a='Защита включена · Проверить'; b=r?.region?'Активный регион · '+r.region:'Проверить связь'; p='ВКЛЮЧЕНО';
      simple='Защита включена'; simpleText=r?.region?'Telegram защищён · '+r.region:'Telegram защищён';
    }else if(s.failoverBusy){
      title='Восстанавливаю связь…';text='Текущий путь недоступен. VETO переключается на запасной.';
      a='Переключаю…';b='Обычно занимает несколько секунд';p='ВОССТАНОВЛЕНИЕ';
      simple='Переключаю путь';simpleText='Ищу рабочий запасной вариант.';
    }else if(s.busy){
      title='Ищу рабочий путь…';text='Проверяю доступные варианты.';
      a='Проверяю…';b='Ничего выбирать не нужно';p='ПРОВЕРКА';
      simple='Проверяю связь';simpleText='Выбираю лучший доступный путь.';
    }else if(s.configured===false){
      title='Защита временно недоступна';text='Попробуй аварийный доступ.';
      a='Недоступно';b='Открой аварийный доступ';p='НЕДОСТУПНО';
      simple='Нужна помощь';simpleText='Открой аварийный доступ ниже.';
    }else if(s.error){
      title='Не удалось проверить связь';text=s.error;
      a='Попробовать снова';b='VETO повторит проверку';p='НУЖНА ПРОВЕРКА';
      simple='Нужна проверка';simpleText=s.error;power.disabled=false;
    }

    pt.textContent=p;
    $('relayPowerState').textContent=title;
    $('relayStateText').textContent=text;
    strong.textContent=a;small.textContent=b;

    $('relayRouteLabel').textContent=r?.label||'Автовыбор';
    $('relayRouteId').textContent=r?.id?'route · '+r.id:'ещё не выбран';
    $('relayRouteRegion').textContent=r?.region||'АВТО';
    $('relayRouteLatency').textContent=Number.isFinite(Number(r?.latencyMs))?Math.round(Number(r.latencyMs))+' ms':'—';
    $('relayRouteHealth').textContent=active?'ON':s.health==='verified'?'OK':s.health==='degraded'?'Нестабильно':'—';
    $('relayRotateButton').hidden=!(r&&s.alternatives);

    if($('relaySimpleStatus'))$('relaySimpleStatus').textContent=simple;
    if($('relaySimpleStatusText'))$('relaySimpleStatusText').textContent=simpleText;
    if($('homeRelayState'))$('homeRelayState').textContent=active?'ЗАЩИТА ВКЛЮЧЕНА':pending?'Проверь подключение':s.configured===false?'Недоступно':'Защита Telegram';
    if($('homeRelayPrimaryState'))$('homeRelayPrimaryState').textContent=active?'ВКЛЮЧЕНО':pending?'Нужно подтвердить':s.configured===false?'Недоступно':'Готово к включению';
    if($('relayGlobalBadgeRoute'))$('relayGlobalBadgeRoute').textContent=r?.region||'АВТО';
    if($('relayHomeTitle'))$('relayHomeTitle').textContent=active?'Telegram защищён':pending?'Telegram заработал?':'Telegram работает нестабильно?';
    if($('relayHomeText'))$('relayHomeText').textContent=active
      ? 'Защита включена. Закрывай VETO — статус сохранится на этом устройстве.'
      : pending
        ? 'Вернись в VETO после включения proxy и спокойно подтверди результат на экране защиты.'
        : 'Включи защиту одним нажатием. VETO сам выберет рабочий путь только для Telegram.';
    if($('homeRelayPrimaryButtonTitle'))$('homeRelayPrimaryButtonTitle').textContent=active?'ЗАЩИТА ВКЛЮЧЕНА':pending?'Проверить подключение':'Защитить Telegram';
    if($('homeRelayPrimaryButtonText'))$('homeRelayPrimaryButtonText').textContent=active
      ? (r?.region?'Активно · '+r.region:'Управлять защитой')
      : pending
        ? 'Без всплывающих окон'
        : 'Одно нажатие';
  }

  async function status(silent=true){
    if(!tg?.initData){s={...s,configured:false,error:'Открой VETO из Telegram.'};render();return;}
    try{
      const d=await api('status');
      s={...s,configured:Boolean(d.configured),count:Number(d.nodeCount||0),alternatives:Boolean(d.canRotate),error:null};
    }catch(e){
      const message=relayErrorMessage(e);s={...s,error:message};
      if(!silent)toast(message);
    }
    render();
  }

  async function healthCheck({autoFailover=true}={}){
    if(!s.enabled||!s.relay?.id||s.failoverBusy)return;
    try{
      const d=await api('health',{currentId:s.relay.id});
      if(d.active?.reachable){
        s.health='verified';
        if(Number.isFinite(Number(d.active.latencyMs)))s.relay={...s.relay,latencyMs:Number(d.active.latencyMs),reachable:true};
        saveUiState();render();return;
      }
      if(autoFailover&&d.shouldFailover){
        s.failoverBusy=true;render();
        toast('Связь ухудшилась. Переключаю на запасной путь…');
        await connect(true,{failover:true});
      }else{
        s.health='degraded';saveUiState();render();
        toast('Связь нестабильна. Нажми «Проверить».');
      }
    }catch{}
  }

  function openRoute(data,{failover=false}={}){
    const httpsUrl=data?.connectUrl;
    const tgUrl=data?.tgUrl;
    if(!httpsUrl&&!tgUrl)throw new Error('Telegram link не получен');

    // Open first; only persist "pending" after the Telegram handoff was attempted.
    openTelegramLink(httpsUrl,tgUrl);
    markPending(data?.relay||s.relay,data?.routeHealth||s.health);
    s.failoverBusy=false;render();
    if(failover)toast('Запасной путь открыт. Проверь Telegram и подтверди результат.');
  }

  async function connect(rotate=false,{failover=false}={}){
    if(s.busy)return;
    s.busy=true;s.error=null;render();haptic('medium');
    try{
      const excluded=[...new Set([
        ...(s.failedIds||[]),
        ...(rotate&&s.relay?.id?[s.relay.id]:[]),
      ].filter(Boolean))].slice(0,8);
      const d=await api(rotate?'rotate':'connect',{exclude:excluded});
      s={...s,configured:true,relay:d.relay||null,health:d.routeHealth||null,alternatives:Boolean(d.alternatives),error:null};
      openRoute(d,{failover});
    }catch(e){
      s.failoverBusy=false;
      const message=relayErrorMessage(e);s={...s,configured:e?.data?.configured===false?false:s.configured,error:message};
      toast(message);
    }finally{s.busy=false;render();}
  }

  function rejectPendingRelay(){
    const failedId=s.pendingRelay?.id;
    if(failedId&&!s.failedIds.includes(failedId))s.failedIds.push(failedId);
    s.pendingRelay=null;s.pendingHealth=null;s.pendingAt=0;s.enabled=false;
    saveUiState();render();closeSheet();
    if(s.count>0&&s.failedIds.length>=s.count){
      s.error='Текущие Relay-маршруты недоступны из этой сети. Нужен другой узел.';
      render();
      toast('Оба маршрута не прошли проверку этой сети.');
      return;
    }
    toast('Этот путь не подходит. Переключаю на запасной…');
    connect(true,{failover:true});
  }

  function openDisableGuide(){
    if(!$('sheetContent')||!$('sheet'))return;
    $('sheetContent').innerHTML=
      '<span class="kicker">ОТКЛЮЧИТЬ ЗАЩИТУ</span>'+
      '<div class="feature-guide-title"><span>○</span><h2>3 простых шага</h2></div>'+
      '<div class="relay-disable-steps">'+
        '<div><b>1</b><span><strong>Открой Telegram → Настройки</strong><small>Settings</small></span></div>'+
        '<div><b>2</b><span><strong>Данные и память</strong><small>Data and Storage</small></span></div>'+
        '<div><b>3</b><span><strong>Настройки прокси → выключи «Использовать прокси»</strong><small>Proxy Settings → Use Proxy OFF</small></span></div>'+
      '</div>'+
      '<p class="relay-disable-note">Telegram не даёт Mini App права выключить proxy напрямую, поэтому последний переключатель нужно нажать внутри Telegram.</p>'+
      '<div class="sheet-actions">'+
        '<button class="accent" data-relay-disable-confirm="yes">Я выключил</button>'+
        '<button data-relay-try-settings="1">Попробовать открыть настройки Telegram</button>'+
        '<button data-relay-disable-confirm="no">Отмена</button>'+
      '</div>';
    $('sheetBackdrop').hidden=false;$('sheet').hidden=false;
  }

  function tryOpenProxySettings(){
    try{openTelegramLink('tg://settings/data/proxy');}
    catch{toast('Открой Telegram → Настройки → Данные и память → Настройки прокси');}
  }

  function closeSheet(){if($('sheet'))$('sheet').hidden=true;if($('sheetBackdrop'))$('sheetBackdrop').hidden=true;}

  function openScreen(){
    document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen==='relay'));
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    $('actionDock')?.classList.add('hidden');closeSheet();scrollTo({top:0,behavior:'smooth'});
    status(true).then(()=>healthCheck({autoFailover:true}));
  }

  function guide(){
    if(!$('sheetContent'))return openScreen();
    $('sheetContent').innerHTML=
      '<span class="kicker">ЗАЩИТА TELEGRAM</span>'+
      '<div class="feature-guide-title"><span>◉</span><h2>Одно нажатие</h2></div>'+
      '<p>VETO сам выбирает рабочий путь только для Telegram. Остальные приложения телефона не меняются.</p>'+
      '<div class="feature-guide-facts">'+
        '<div><span>Что делать</span><strong>Нажми «Защитить Telegram» — больше ничего выбирать не нужно.</strong></div>'+
        '<div><span>Если Telegram не открывается</span><strong>Используй «Аварийный доступ» с главного экрана.</strong></div>'+
      '</div>'+
      '<div class="sheet-actions"><button class="accent" data-relay-action="open">Открыть защиту</button><button data-relay-action="close">Закрыть</button></div>';
    $('sheetBackdrop').hidden=false;$('sheet').hidden=false;
  }

  $('homeRelayCard')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();guide();},true);
  document.querySelectorAll('[data-open-screen="relay"]').forEach(x=>x.addEventListener('click',()=>setTimeout(()=>status(true).then(()=>s.enabled?healthCheck({autoFailover:true}):null),0)));
  $('relayPowerButton')?.addEventListener('click',()=>{
    if(s.pendingRelay){
      // A failed Telegram handoff must not trap the user in a stale pending state.
      // Re-request the route and open the official t.me proxy link again.
      s.pendingRelay=null;s.pendingHealth=null;s.pendingAt=0;
      saveUiState();render();
      return connect(false);
    }
    if(s.enabled)return healthCheck({autoFailover:true}).then(()=>toast('Защита проверена'));
    return connect(false);
  });
  $('relayPendingYes')?.addEventListener('click',()=>{
    if(!s.pendingRelay)return;
    const relay=s.pendingRelay;
    const health=s.pendingHealth;
    markEnabled(relay,health);
    render();
    toast('Подключение подтверждено на этом устройстве.');
  });
  $('relayPendingNo')?.addEventListener('click',()=>{
    if(s.pendingRelay)rejectPendingRelay();
  });
  $('relayDisableButton')?.addEventListener('click',openDisableGuide);
  $('relayRotateButton')?.addEventListener('click',()=>connect(true));
  $('relayRefreshButton')?.addEventListener('click',()=>status(false).then(()=>healthCheck({autoFailover:true})));
  $('relayEmergencyButton')?.addEventListener('click',openEmergencyAccess);
  $('relayEmergencyHomeButton')?.addEventListener('click',openEmergencyAccess);

  $('sheet')?.addEventListener('click',e=>{
    const action=e.target.closest('[data-relay-action]')?.dataset?.relayAction;
    if(action==='open')openScreen();
    if(action==='close')closeSheet();
    const disable=e.target.closest('[data-relay-disable-confirm]')?.dataset?.relayDisableConfirm;
    if(disable==='yes'){markDisabledLocal();closeSheet();toast('Защита отмечена как выключенная');}
    if(disable==='no'){closeSheet();}
    if(e.target.closest('[data-relay-try-settings]'))tryOpenProxySettings();
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    render();
    if(s.enabled)setTimeout(()=>healthCheck({autoFailover:true}),500);
  });
  window.addEventListener('pageshow',()=>{
    render();
    if(s.enabled)setTimeout(()=>healthCheck({autoFailover:true}),700);
  });

  render();
  if(tg?.initData)status(true).then(()=>s.enabled?healthCheck({autoFailover:true}):null);
})();