/* Vetogram Play rooms: verified, server-authoritative 2-player game.
   No mock room IDs, no fake multiplayer, no chat or Business permissions. */
(() => {
  'use strict';
  const root=document.querySelector('.screen[data-screen="play"]');
  if(!root)return;
  const $=selector=>root.querySelector(selector);
  const create=$('#vpRoomCreate'),join=$('#vpRoomJoin'),codeInput=$('#vpRoomCodeInput');
  const availability=$('#vpRoomAvailability'),session=$('#vpRoomSession');
  const labelCode=$('#vpRoomCode'),labelSeat=$('#vpRoomSeat'),board=$('#vpRoomBoard');
  const status=$('#vpRoomStatus'),refreshButton=$('#vpRoomRefresh'),exitButton=$('#vpRoomExit');
  const copyButton=$('#vpRoomCopy');
  if(!create||!join||!board)return;
  const tg=window.Telegram?.WebApp;
  const STORAGE_KEY='vetogram:play:room-code:v1';
  const normalize=value=>String(value||'').trim().toUpperCase().replace(/[\s-]/g,'');
  const valid=code=>/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code);
  let configured=false,room=null,busy=false,pollId=null;
  const inform=text=>{if(status)status.textContent=text;};
  const state=text=>{if(availability)availability.textContent=text;};
  const playable=()=>root.classList.contains('active')&&!document.hidden;
  function setBusy(yes) {
    busy=Boolean(yes);
    create.disabled=busy||!configured||!tg?.initData;
    join.disabled=busy||!configured||!tg?.initData;
    if(refreshButton)refreshButton.disabled=busy||!room;
    if(copyButton)copyButton.disabled=busy||!room;
  }
  function remember(code) {try{window.localStorage?.setItem(STORAGE_KEY,code);}catch{}}
  function clearRemembered(){try{window.localStorage?.removeItem(STORAGE_KEY);}catch{}}
  function stopPoll() {if(pollId!==null)window.clearInterval(pollId);pollId=null;}
  function ensurePoll(){
    stopPoll();
    if(!room||!playable()||!tg?.initData)return;
    pollId=window.setInterval(()=>{
      if(!busy&&room&&playable())void fetchRoom({silent:true});
    },4000);
  }
  const errors={
    auth_required:'Авторизация устарела. Закрой и снова открой Vetogram в Telegram.',
    not_configured:'Сетевые комнаты ещё не подключены к базе данных.',
    unavailable:'Сервер игрового клуба пока недоступен.',
    invalid_code:'Проверь 8-значный код комнаты.',
    not_found:'Комната не найдена. Проверь код или создай новую.',
    too_many_rooms:'Сейчас можно иметь до пяти активных комнат.',
    conflict:'Игра обновилась. Получаем последние ходы…',
    full:'Комната занята.',
    expired:'Комната уже истекла.',
    not_your_turn:'Подожди своего хода.',
    occupied:'Эта клетка уже занята.',
  };
  async function request(action,payload={}) {
    if(!tg?.initData)throw Object.assign(new Error('Требуется вход через Telegram.'),{code:'auth_required'});
    const method=action==='view'?'GET':'POST';
    const url=action==='view'?'/api/play-room?code='+encodeURIComponent(payload.code):'/api/play-room';
    const response=await fetch(url,{
      method,cache:'no-store',credentials:'same-origin',
      headers:{'x-telegram-init-data':tg.initData,...(method==='POST'?{'content-type':'application/json'}:{})},
      ...(method==='POST'?{body:JSON.stringify({action,...payload})}:{})
    });
    const data=await response.json().catch(()=>({ok:false,error:'unavailable'}));
    if(!response.ok||!data?.ok)throw Object.assign(new Error(data?.message||errors[data?.error]||'Игровой сервер недоступен.'),{code:data?.error||'unavailable'});
    return data.room;
  }
  function render() {
    session.hidden=!room;
    if(!room){board.replaceChildren();setBusy(false);return;}
    labelCode.textContent=room.code;
    labelSeat.textContent=room.seat;
    const outcome=room.winner;
    if(room.status==='waiting')inform('Ожидаем второго игрока. Отправь другу код или ссылку.');
    else if(room.status==='expired')inform('Время комнаты истекло. Создай новую.');
    else if(room.status==='finished')inform(outcome==='draw'?'Ничья!':outcome===room.seat?'Победа! 🎉':'Победил второй игрок.');
    else inform(room.turn===room.seat?'Твой ход — выбери клетку.':'Ход соперника — ждём.');
    board.replaceChildren();
    for(let cell=0;cell<9;cell++){
      const button=document.createElement('button');
      button.type='button';
      button.className='vp-room-cell';
      const symbol=room.board[cell];
      button.textContent=symbol==='.'?'·':symbol;
      button.dataset.mark=symbol==='.'?'empty':symbol;
      const allowed=room.status==='active'&&room.turn===room.seat&&symbol==='.'&&!busy;
      button.disabled=!allowed;
      button.setAttribute('aria-label','Клетка '+(cell+1)+(symbol==='.'?' свободна':' — '+symbol));
      button.addEventListener('click',()=>{void move(cell);});
      board.appendChild(button);
    }
    setBusy(busy);
  }
  async function refreshAvailability() {
    if(!playable())return;
    try{
      const response=await fetch('/api/play-room?health=1',{cache:'no-store',credentials:'same-origin'});
      const data=await response.json();
      configured=Boolean(response.ok&&data?.configured===true);
      if(!configured)state('Сетевой режим в разработке: Neon ещё не подключён. Локальные игры доступны выше.');
      else if(!tg?.initData)state('Сервер настроен. Для комнат открой Vetogram внутри Telegram.');
      else state('Настройка сервера обнаружена. Можно попробовать создать игровую комнату.');
    }catch{
      configured=false;
      state('Сетевые комнаты пока недоступны. Локальные игры работают без сервера.');
    }
    setBusy(false);
  }
  async function run(action,payload,onSuccess) {
    if(busy)return;
    busy=true;setBusy(true);
    let failure='';
    let retryAfterConflict=false;
    try {
      const next=await request(action,payload);
      room=next;
      if(codeInput)codeInput.value=room.code;
      remember(room.code);
      render();
      ensurePoll();
      onSuccess?.(room);
    }catch(error){
      retryAfterConflict=error?.code==='conflict'&&Boolean(room);
      failure=errors[error?.code]||error?.message||'Не удалось выполнить действие.';
    }finally{
      busy=false;
      render();
      if(failure)inform(failure);
      if(retryAfterConflict)void fetchRoom({silent:true});
    }
  }
  async function fetchRoom({silent=false}={}){
    if(!room||busy)return;
    const original=room.code;
    if(!silent){busy=true;setBusy(true);}
    try {
      const next=await request('view',{code:original});
      if(room?.code!==original)return;
      if(!room||room.version!==next.version||room.status!==next.status) {
        room=next;
        render();
      }
    }catch(error){
      const reason=errors[error?.code]||error?.message||'Нет связи с игровой комнатой.';
      if(error?.code==='expired'||error?.code==='not_found')stopPoll();
      if(!silent){busy=false;render();inform(reason);}
    }finally{if(!silent&&busy){busy=false;render();}}
  }
  async function move(cell){
    if(!room||busy||!Number.isInteger(cell)||cell<0||cell>8)return;
    const current=room;
    if(current.status!=='active'||current.turn!==current.seat||current.board[cell]!=='.')return;
    await run('move',{code:current.code,version:current.version,cell});
  }
  create.addEventListener('click',()=>{void run('create',{});});
  join.addEventListener('click',()=>{
    const code=normalize(codeInput?.value);
    if(!valid(code)){inform('Код должен содержать 8 букв или цифр.');return;}
    void run('join',{code});
  });
  refreshButton?.addEventListener('click',()=>{void fetchRoom();});
  exitButton?.addEventListener('click',()=>{
    stopPoll();room=null;clearRemembered();render();
    state(configured?'Закрыт просмотр комнаты. Партия на сервере остаётся.':'Сетевые комнаты пока недоступны.');
  });
  copyButton?.addEventListener('click',async()=>{
    if(!room)return;
    const url=new URL('/',window.location.origin);
    url.searchParams.set('screen','play');
    url.searchParams.set('room',room.code);
    const text=url.toString();
    try {
      if(window.navigator?.share) {
        await window.navigator.share({title:'Сыграем в Vetogram Play?',text:'Код комнаты: '+room.code,url:text});
        return;
      }
    }catch(error){if(error?.name==='AbortError')return;}
    try{
      if(window.navigator?.clipboard?.writeText){await window.navigator.clipboard.writeText(text);inform('Ссылка на комнату скопирована.');return;}
    }catch{}
    if(codeInput){codeInput.value=room.code;codeInput.focus();codeInput.select();}
    inform('Скопируй код комнаты вручную: '+room.code);
  });
  window.addEventListener('veto:screen-changed',event=>{
    if(event?.detail?.screen==='play'){
      void refreshAvailability();
      if(room){void fetchRoom({silent:true});ensurePoll();}
    }else stopPoll();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopPoll();
    else if(playable()){if(room){void fetchRoom({silent:true});ensurePoll();}else void refreshAvailability();}
  });
  try {
    const params=new URLSearchParams(window.location.search);
    const suggested=normalize(params.get('room'));
    if(valid(suggested)&&codeInput)codeInput.value=suggested;
    else {
      const saved=normalize(window.localStorage?.getItem(STORAGE_KEY));
      if(valid(saved)&&codeInput)codeInput.value=saved;
    }
  }catch{}
  render();
  if(playable())void refreshAvailability();
})();
