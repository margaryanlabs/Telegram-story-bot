(() => {
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);
  let s = { configured:null, count:0, busy:false, relay:null, health:null, alternatives:false, opened:0, error:null };
  try { s.opened = Number(sessionStorage.getItem('veto-relay:last-opened') || 0) || 0; } catch {}

  function toast(message) {
    const el = $('toast'); if (!el) return;
    el.textContent = String(message || 'Relay error'); el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  async function api(action, payload = {}) {
    if (!tg?.initData) throw new Error('Открой VETO Telegram внутри Telegram');
    const response = await fetch('/api/relay', {
      method:'POST',
      headers:{'content-type':'application/json','x-telegram-init-data':tg.initData},
      body:JSON.stringify({action,...payload}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      const e = new Error(data?.message || data?.error || 'Relay временно недоступен');
      e.data = data; throw e;
    }
    return data;
  }

  const recent = () => Date.now() - Number(s.opened || 0) < 15 * 60 * 1000;

  function render() {
    const pill=$('relayStatusPill'), power=$('relayPowerButton');
    if (!pill || !power) return;
    const pt=pill.querySelector('span'), strong=power.querySelector('strong'), small=power.querySelector('small');
    pill.classList.toggle('ready',s.configured===true&&!s.error);
    pill.classList.toggle('warn',s.configured===false||Boolean(s.error));
    power.disabled=s.busy||s.configured===false; power.classList.toggle('busy',s.busy);

    let title='Relay выключен', text='VETO проверит доступные маршруты и передаст лучший в Telegram.', a='Подключить Telegram Relay', b='Автоматически выбрать лучший маршрут', p='Проверяю Relay';
    if(s.busy){title='Ищу лучший маршрут…';text='VETO проверяет relay-узлы и выбирает лучший route.';a='Проверка Relay…';b='Автовыбор маршрута';p='Проверяю маршруты';}
    else if(s.configured===false){title='Нужны relay-узлы';text='Код готов, но production ещё не получил MTProxy nodes.';a='Relay пока недоступен';b='Нужно добавить VETO_RELAY_NODES';p='Relay не настроен';}
    else if(s.error){title='Relay временно недоступен';text=s.error;a='Попробовать снова';b='VETO заново проверит mesh';p='Повторная проверка';power.disabled=false;}
    else if(s.relay){title=recent()?'Telegram получил маршрут':'Маршрут готов';text=recent()?'VETO открыл нативное окно proxy. Убедись, что Telegram показывает подключение.':'Маршрут выбран. Нажми кнопку, чтобы передать его в Telegram.';a=recent()?'Открыть настройку снова':'Подключить этот маршрут';b=s.health==='verified'?'Узел доступен с VETO edge':'Если не подключится — смени маршрут';p=s.health==='verified'?'Маршрут проверен':'Маршрут выдан';}
    else if(s.configured){text='Доступно маршрутов: '+(s.count||1)+'. VETO выберет лучший при подключении.';p='Relay Mesh готов';}
    pt.textContent=p; $('relayPowerState').textContent=title; $('relayStateText').textContent=text; strong.textContent=a; small.textContent=b;

    const r=s.relay;
    $('relayRouteLabel').textContent=r?.label||'Автовыбор';
    $('relayRouteId').textContent=r?.id?'route · '+r.id:'ещё не выбран';
    $('relayRouteRegion').textContent=r?.region||'AUTO';
    $('relayRouteLatency').textContent=Number.isFinite(Number(r?.latencyMs))?Math.round(Number(r.latencyMs))+' ms':'—';
    $('relayRouteHealth').textContent=s.health==='verified'?'Verified':s.health==='degraded'?'Degraded':'—';
    $('relayRotateButton').hidden=!(r&&s.alternatives);
    if($('homeRelayState')) $('homeRelayState').textContent=s.configured===false?'Нужно настроить':recent()?'Маршрут выдан Telegram':'Telegram-only маршрут';
    if($('homeRelayPrimaryState')) $('homeRelayPrimaryState').textContent=s.configured===false?'Нужно настроить':recent()?'Маршрут выдан':s.error?'Проверить Relay':'Mesh готов';
  }

  async function status(silent=true){
    if(!tg?.initData){s={...s,configured:false,error:'Открой VETO Telegram внутри Telegram.'};render();return;}
    try{const d=await api('status');s={...s,configured:Boolean(d.configured),count:Number(d.nodeCount||0),alternatives:Boolean(d.canRotate),error:null};}
    catch(e){s={...s,error:e.message};if(!silent)toast(e.message);} render();
  }

  function openRoute(url){
    if(!url)throw new Error('Telegram proxy link не получен');
    if(tg?.openTelegramLink)tg.openTelegramLink(url);else location.assign(url);
    s.opened=Date.now();try{sessionStorage.setItem('veto-relay:last-opened',String(s.opened));}catch{} render();
  }

  async function connect(rotate=false){
    if(s.busy)return;s.busy=true;s.error=null;render();
    try{
      const d=await api(rotate?'rotate':'connect',{exclude:rotate&&s.relay?.id?[s.relay.id]:[]});
      s={...s,configured:true,relay:d.relay||null,health:d.routeHealth||null,alternatives:Boolean(d.alternatives),error:null};
      openRoute(d.connectUrl);
    }catch(e){s={...s,configured:e?.data?.configured===false?false:s.configured,error:e.message};toast(e.message);}
    finally{s.busy=false;render();}
  }

  function closeSheet(){if($('sheet'))$('sheet').hidden=true;if($('sheetBackdrop'))$('sheetBackdrop').hidden=true;}
  function openScreen(){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen==='relay'));document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));$('actionDock')?.classList.add('hidden');closeSheet();scrollTo({top:0,behavior:'smooth'});status(true);}
  function guide(){if(!$('sheetContent'))return openScreen();$('sheetContent').innerHTML='<span class="kicker">PRIVATE RELAY</span><div class="feature-guide-title"><span>⇄</span><h2>Резервный маршрут только для Telegram</h2></div><p>VETO выбирает MTProxy route и передаёт его нативному Telegram. Это не VPN для всего телефона.</p><div class="feature-guide-facts"><div><span>Зачем</span><strong>Резервный путь при нестабильном или ограниченном соединении.</strong></div><div><span>Что нужно</span><strong>Доступ к сообщениям не нужен.</strong></div></div><div class="sheet-actions"><button class="accent" data-relay-action="open">Открыть Private Relay</button><button data-relay-action="close">Закрыть</button></div>';$('sheetBackdrop').hidden=false;$('sheet').hidden=false;}

  $('homeRelayCard')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();guide();},true);
  document.querySelectorAll('[data-open-screen="relay"]').forEach(x=>x.addEventListener('click',()=>setTimeout(()=>status(true),0)));
  $('relayPowerButton')?.addEventListener('click',()=>connect(false));
  $('relayRotateButton')?.addEventListener('click',()=>connect(true));
  $('relayRefreshButton')?.addEventListener('click',()=>status(false));
  $('sheet')?.addEventListener('click',e=>{const a=e.target.closest('[data-relay-action]')?.dataset?.relayAction;if(a==='open')openScreen();if(a==='close')closeSheet();});
  render(); if(tg?.initData)status(true);
})();