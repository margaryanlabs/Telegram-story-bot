/* Vetogram Play stats: read-only verified history + explicit public ranking consent.
   No chat access, raw Telegram IDs in UI, local score submissions or fake data. */
(() => {
  'use strict';
  const root=document.querySelector('.screen[data-screen="play"]');
  if(!root)return;
  const $=selector=>root.querySelector(selector);
  const status=$('#vpStatsState'),container=$('#vpStatsContent');
  const refresh=$('#vpStatsRefresh'),alias=$('#vpProfileAlias');
  const consent=$('#vpLeaderboardConsent'),history=$('#vpMatchHistory');
  const leaders=$('#vpLeaderboard'),leadersStatus=$('#vpLeadersState');
  const leadersButton=$('#vpLeadersRefresh');
  if(!refresh||!consent||!container)return;
  const tg=window.Telegram?.WebApp;
  let configured=false,busy=false,consentBusy=false,leadersBusy=false;
  const setStatus=(value)=>{if(status)status.textContent=value;};
  const setLeadersStatus=(value)=>{if(leadersStatus)leadersStatus.textContent=value;};
  const visible=()=>root.classList?.contains('active')&&!document.hidden;
  const count=value=>Math.max(0,Number(value)||0);
  const setText=(sel,value)=>{const el=$(sel);if(el)el.textContent=String(value);};
  const setDisabled=()=>{
    refresh.disabled=!configured||busy||consentBusy||!tg?.initData;
    consent.disabled=!configured||busy||consentBusy||!tg?.initData;
    if(leadersButton)leadersButton.disabled=!configured||leadersBusy||!tg?.initData;
  };
  async function call(view,body){
    if(!tg?.initData)throw new Error('Открой Vetogram внутри Telegram.');
    const response=await fetch(view?'/api/play-stats?view='+encodeURIComponent(view):'/api/play-stats',{
      method:body?'POST':'GET',
      cache:'no-store',
      credentials:'same-origin',
      headers:{'x-telegram-init-data':tg.initData,...(body?{'content-type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json().catch(()=>({ok:false}));
    if(!response.ok||!data?.ok)throw new Error(data?.message||'Игровая статистика временно недоступна.');
    return data;
  }
  function addLine(parent,first,second,description){
    const row=document.createElement('div');
    row.className='vp-stat-line';
    const left=document.createElement('div');
    const primary=document.createElement('strong');
    primary.textContent=first;
    left.appendChild(primary);
    if(description){
      const small=document.createElement('small');
      small.textContent=description;
      left.appendChild(small);
    }
    const right=document.createElement('span');
    right.textContent=second;
    row.appendChild(left);row.appendChild(right);
    parent.appendChild(row);
  }
  function renderMine(data){
    if(!data?.profile||!data?.stats||!Array.isArray(data.history))return;
    container.hidden=false;
    if(alias)alias.textContent=data.profile.alias;
    consent.checked=data.profile.leaderboardVisible===true;
    setText('#vpStatGames',count(data.stats.games));
    setText('#vpStatWins',count(data.stats.wins));
    setText('#vpStatDraws',count(data.stats.draws));
    setText('#vpStatPoints',count(data.stats.points));
    history?.replaceChildren();
    if(!data.history.length){
      addLine(history,'Нет завершённых онлайн-партий','—','Сыграй с другом, чтобы история появилась.');
    }else{
      data.history.slice(0,20).forEach(item=>{
        const title=item.result==='win'?'Победа':item.result==='draw'?'Ничья':'Поражение';
        const date=new Date(item.finishedAt);
        const when=Number.isNaN(date.getTime())?'Дата неизвестна':date.toLocaleDateString('ru-RU');
        addLine(history,title,item.result==='win'?'+3':item.result==='draw'?'+1':'0', 'Раунд '+count(item.round)+' · '+item.seat+' · '+when);
      });
    }
  }
  function renderLeaders(data){
    leaders?.replaceChildren();
    if(!Array.isArray(data?.leaders))return;
    if(!data.leaders.length){
      setLeadersStatus('Рейтинг пока пуст. В нём показываются только игроки, согласившиеся участвовать и сыгравшие минимум 3 раунда.');
      return;
    }
    data.leaders.slice(0,20).forEach((player,index)=>{
      addLine(leaders,(index+1)+'. '+String(player.alias),'★ '+count(player.points),'Партий: '+count(player.games)+' · Побед: '+count(player.wins));
    });
    setLeadersStatus('Топ '+data.leaders.length+' игроков по подтверждённым результатам.');
  }
  async function loadMine(){
    if(!configured||busy||!visible())return;
    busy=true;setDisabled();setStatus('Загружаем подтверждённые результаты…');
    try{
      const data=await call('mine');
      renderMine(data);
      setStatus('История и профиль получены с сервера.');
    }catch(error){
      setStatus(error?.message||'Не удалось загрузить профиль.');
    }finally{busy=false;setDisabled();}
  }
  async function loadLeaders(){
    if(!configured||leadersBusy||!visible())return;
    leadersBusy=true;setDisabled();setLeadersStatus('Загружаем рейтинг…');
    try{renderLeaders(await call('leaders'));}
    catch(error){setLeadersStatus(error?.message||'Рейтинг временно недоступен.');}
    finally{leadersBusy=false;setDisabled();}
  }
  async function detect(){
    if(!visible())return;
    try{
      const response=await fetch('/api/play-room?health=1',{cache:'no-store',credentials:'same-origin'});
      const data=await response.json();
      configured=Boolean(response.ok&&data?.configured===true);
    }catch{configured=false;}
    setDisabled();
    if(!configured){
      container.hidden=true;
      setStatus('Профили и рейтинг будут доступны после подключения отдельной базы Neon.');
      setLeadersStatus('');
      leaders?.replaceChildren();
    }else if(!tg?.initData){
      container.hidden=true;
      setStatus('Для просмотра личной статистики открой Vetogram внутри Telegram.');
    }else if(visible()){
      void loadMine();
    }
  }
  refresh.addEventListener('click',()=>{void loadMine();});
  leadersButton?.addEventListener('click',()=>{void loadLeaders();});
  consent.addEventListener('change',async()=>{
    if(!configured||consentBusy)return;
    const value=consent.checked;
    consentBusy=true;setDisabled();
    setStatus('Сохраняем настройку приватности…');
    try {
      const updated=await call(null,{action:'leaderboard_visibility',visible:value});
      consent.checked=updated.profile?.leaderboardVisible===true;
      setStatus(consent.checked?'Публичный рейтинг включён. Отображается только игровой псевдоним.':'Профиль скрыт из публичного рейтинга.');
      leaders?.replaceChildren();
      setLeadersStatus('Рейтинг можно обновить кнопкой «Показать».');
    }catch(error){
      consent.checked=!value;
      setStatus(error?.message||'Не удалось сохранить настройку.');
    }finally{consentBusy=false;setDisabled();}
  });
  window.addEventListener('veto:screen-changed',event=>{if(event?.detail?.screen==='play')void detect();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible())void detect();});
  setDisabled();
  if(visible())void detect();
})();
