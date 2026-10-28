/* VETOGRAM Universe: one route owner, persistent audio, lazy module documents.
 * Existing Messenger, Privacy, Stories and account controllers stay authoritative. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),root=document.documentElement;
 root.classList.add('vetogram-universe');
 const definitions=Object.freeze({music:{title:'Музыка',path:'/music-module.html'},cinema:{title:'Кино',path:'/cinema.html'},books:{title:'Книги',path:'/books.html'}});
 const frames=new Map();let activeModule='',screen=document.querySelector('.screen.active')?.dataset.screen||'home';
 let identity=String(window.Telegram?.WebApp?.initData||''),lastAudio=null,lastTrackId='';
 const theme=()=>root.dataset.vetoTheme||'graphite';
 function context(){const api=window.Telegram?.WebApp;return {initData:String(api?.initData||''),user:api?.initDataUnsafe?.user||null,theme:theme()};}
 // This API is read synchronously by our same-origin module adapter only.
 window.VetogramUniverse=Object.freeze({context,open:(name,page,id)=>openModule(name,page,id)});
 const send=(name,message)=>frames.get(name)?.element.contentWindow?.postMessage({channel:'vetogram-universe',...message},location.origin);
 function visibility(){for(const name of frames.keys())send(name,{action:'visible',visible:screen==='media'&&activeModule===name});}
 function chrome(){
  const show=!!lastAudio && !(screen==='media'&&activeModule==='music');
  $('v6MiniPlayer').hidden=!show;
  root.classList.toggle('v6-has-audio',show);
  root.classList.toggle('v6-module-open',screen==='media'&&!!activeModule);
 }
 function moduleStatus(text,retry=false){$('v6ModuleStatus').textContent=text;$('v6ModuleStatus').hidden=!text;$('v6ModuleRetry').hidden=!retry;}
 function destroyMedia(){
  for(const item of frames.values()){clearTimeout(item.timer);item.element.src='about:blank';item.element.remove();}
  frames.clear();activeModule='';lastAudio=null;
  $('v6NowTitle').textContent='';$('v6NowArtist').textContent='';$('v6NowStatus').textContent='';
  $('v6AccountName').textContent=[context().user?.first_name,context().user?.last_name].filter(Boolean).join(' ')||'Аккаунт, оформление и инструменты.';
  showHub();chrome();lastTrackId='';$('v61Player').hidden=true;root.classList.remove('v61-player-open');
  if(typeof window.dispatchEvent==='function'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('vetogram:identity-change'));
 }
 function checkIdentity(){const current=String(window.Telegram?.WebApp?.initData||'');if(current!==identity){identity=current;destroyMedia();}}
 function showHub(){
  activeModule='';$('v6MediaHome').hidden=false;$('v6MediaStage').hidden=true;
  for(const item of frames.values())item.element.hidden=true;
  moduleStatus('');visibility();chrome();
 }
 function openModule(name,page,id){
  checkIdentity();const definition=definitions[name];if(!definition)return;
  window.VetoTelegramNavigate?.('media');activeModule=name;
  $('v6MediaHome').hidden=true;$('v6MediaStage').hidden=false;$('v6ModuleTitle').textContent=definition.title;
  document.querySelectorAll('.v6-module-switch [data-v6-module]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.v6Module===name)));
  if(!frames.has(name)){
   const element=document.createElement('iframe');element.title='VETOGRAM · '+definition.title;
   element.className='v6-module-frame';element.allow='autoplay; fullscreen; picture-in-picture';
   element.setAttribute('referrerpolicy','same-origin');
   const item={element,ready:false,page,entryId:id,lastPage:page||'',lastEntryId:id||'',timer:0};frames.set(name,item);
   const film=id||new URLSearchParams(location.search).get('film');
   element.src=definition.path+'?universe=1'+(name==='cinema'&&film&&/^[A-Za-z0-9_-]{1,200}$/.test(film)?'&film='+encodeURIComponent(film):'');
   $('v6Frames').append(element);
   item.timer=setTimeout(()=>{if(!item.ready && activeModule===name)moduleStatus('Раздел не ответил. Можно повторить загрузку или вернуться в чаты.',true);},18000);
   element.addEventListener('error',()=>{if(activeModule===name)moduleStatus('Раздел не загрузился. Повтори попытку.',true);});
  }
  const item=frames.get(name);if(page){item.page=page;item.lastPage=page;}if(id){item.entryId=id;item.lastEntryId=id;}
  moduleStatus(item.ready?'':'Открываем '+definition.title.toLowerCase()+'…');
  for(const [key,entry]of frames)entry.element.hidden=key!==name;
  if(item.ready && item.page){send(name,{action:'page',page:item.page});item.page=null;}
  if(item.ready && item.entryId){send(name,{action:'open-item',id:item.entryId});item.entryId=null;}
  visibility();chrome();
 }
 $('v6MediaBack').onclick=showHub;
 $('v6ModuleRetry').onclick=()=>{
  const name=activeModule,item=frames.get(name);if(!item)return;
  const page=item.lastPage,id=item.lastEntryId;
  clearTimeout(item.timer);item.element.src='about:blank';item.element.remove();frames.delete(name);
  if(name==='music'){
   lastAudio=null;lastTrackId='';closePlayer();
   $('v6NowTitle').textContent='';$('v6NowArtist').textContent='';
  }
  openModule(name,page,id);
 };
 document.querySelectorAll('[data-v6-module]').forEach(button=>button.addEventListener('click',()=>openModule(button.dataset.v6Module,button.dataset.v6Page)));
 $('v6Account').onclick=()=>$('profileButton')?.click();
 $('v6Appearance').onclick=()=>$('vetoGlobalThemeToggle')?.click();
 let playerReturnFocus=null;
 const closePlayer=()=>{
  const wasOpen=!$('v61Player').hidden;
  $('v61Player').hidden=true;root.classList.remove('v61-player-open');
  if(wasOpen)playerReturnFocus?.focus?.({preventScroll:true});
  playerReturnFocus=null;
 };
 $('v6NowOpen').onclick=()=>{
  checkIdentity();
  if(!lastAudio)return; // Never open an empty or stale full-screen player.
  playerReturnFocus=document.activeElement||$('v6NowOpen');
  $('v61Player').hidden=false;root.classList.add('v61-player-open');
  $('v61PlayerClose').focus?.({preventScroll:true});
 };
 $('v61PlayerClose').onclick=closePlayer;
 $('v61PlayerMusic').onclick=()=>{closePlayer();openModule('music');};
 document.addEventListener('keydown',event=>{
  const overlay=$('v61Player');
  if(overlay.hidden)return;
  if(event.key==='Escape'){event.preventDefault?.();closePlayer();return;}
  if(event.key!=='Tab')return;
  const controls=Array.from(overlay.querySelectorAll?.('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')||[]);
  if(!controls.length){event.preventDefault?.();overlay.focus?.();return;}
  const first=controls[0],last=controls[controls.length-1],active=document.activeElement;
  if(event.shiftKey&&(active===first||!overlay.contains?.(active))){event.preventDefault?.();last.focus?.();}
  else if(!event.shiftKey&&(active===last||!overlay.contains?.(active))){event.preventDefault?.();first.focus?.();}
 });
 document.querySelectorAll('[data-v6-audio]').forEach(button=>button.onclick=()=>{checkIdentity();send('music',{action:'audio',command:button.dataset.v6Audio});});
 $('v6NowSeek').onchange=()=>send('music',{action:'seek',value:Number($('v6NowSeek').value)/1000});
 $('v61PlayerSeek').onchange=()=>send('music',{action:'seek',value:Number($('v61PlayerSeek').value)/1000});
 const format=value=>Number.isFinite(value)?Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0'):'0:00';
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.data?.channel!=='vetogram-media')return;
  const pair=[...frames].find(([,item])=>item.element.contentWindow===event.source);if(!pair)return;
  checkIdentity();if(!frames.has(pair[0]))return;
  const [name,item]=pair,message=event.data;
  if(message.type==='ready'){
   clearTimeout(item.timer);item.ready=true;
   if(activeModule===name)moduleStatus('');
   send(name,{action:'theme',theme:theme()});
   if(item.page){send(name,{action:'page',page:item.page});item.page=null;}
   if(item.entryId){send(name,{action:'open-item',id:item.entryId});item.entryId=null;}
   visibility();
  }
  if(message.type==='failed'){clearTimeout(item.timer);if(activeModule===name)moduleStatus('Ошибка раздела. Чаты и остальные функции доступны.',true);}
  if(message.type==='open-item-status'&&message.ok===false&&activeModule===name){
   moduleStatus('Этот сохранённый материал не найден или его источник сейчас недоступен. Попробуй открыть его из каталога.',false);
  }
  if(message.type==='navigate' && message.target==='hub')showHub();
  if(name==='music'&&message.type==='music-library'&&Array.isArray(message.items)&&typeof window.dispatchEvent==='function'&&typeof CustomEvent!=='undefined'){
   const items=message.items.slice(0,250).filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').map(x=>({
    kind:'music',id:x.id.slice(0,220),title:x.title.slice(0,150),
    subtitle:String(x.subtitle||'').slice(0,110),at:0,progress:0,source:'saved',
    description:String(x.description||'').slice(0,24)
   }));
   window.dispatchEvent(new CustomEvent('vetogram:music-library',{detail:{items}}));
  }
  if(name==='cinema'&&message.type==='library'&&Array.isArray(message.items)&&typeof window.dispatchEvent==='function'&&typeof CustomEvent!=='undefined'){
   const items=message.items.slice(0,120).filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').map(x=>({
    kind:'cinema',id:x.id.slice(0,220),title:x.title.slice(0,150),
    subtitle:String(x.subtitle||'').slice(0,110),at:Number(x.at)||0,progress:Number(x.progress)||0,
    source:['saved','progress','recent'].includes(x.source)?x.source:'recent'
   }));
   window.dispatchEvent(new CustomEvent('vetogram:media-library',{detail:{items}}));
  }
  if(message.type==='recent' && message.item && message.item.kind===name &&
     typeof message.item.title==='string' && typeof message.item.id==='string' &&
     typeof window.dispatchEvent==='function' && typeof CustomEvent!=='undefined'){
   window.dispatchEvent(new CustomEvent('vetogram:media-recent',{detail:{
    kind:name,id:message.item.id.slice(0,220),title:message.item.title.slice(0,150),
    subtitle:String(message.item.subtitle||'').slice(0,110),progress:message.item.progress
   }}));
  }
  if(name==='music' && message.type==='audio'){
   const data=message.state;
   if(!data || typeof data.title!=='string' || !data.title){
    lastAudio=null;lastTrackId='';
    closePlayer();
    $('v61PlayerTitle').textContent='Твоя музыка';$('v61PlayerArtist').textContent='';
    $('v6NowTitle').textContent='';$('v6NowArtist').textContent='';
    chrome();return;
   }
   lastAudio=data;
   if(data.id && data.title && !data.error && data.id!==lastTrackId){
    lastTrackId=String(data.id);
    if(typeof window.dispatchEvent==='function'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('vetogram:media-recent',{detail:{
     kind:'music',id:String(data.id).slice(0,220),title:data.title.slice(0,150),subtitle:String(data.artist||'').slice(0,110)
    }}));
   }
   $('v6NowTitle').textContent=data.title.slice(0,150);$('v6NowArtist').textContent=String(data.artist||'').slice(0,100);
   $('v6NowPlay').textContent=data.playing?'Ⅱ':'▶';$('v6NowPlay').setAttribute('aria-label',data.playing?'Пауза':'Воспроизвести');
   $('v6NowSeek').disabled=!Number.isFinite(data.duration)||data.duration<=0;
   $('v6NowSeek').value=String(data.duration>0?Math.round(data.position/data.duration*1000):0);
   $('v6NowTime').textContent=format(data.position);
   $('v6NowStatus').textContent=data.error?'Аудио недоступно':data.waiting?'Загружаем аудио':'';
   $('v6NowPlay').disabled=!!data.error;
   $('v61PlayerTitle').textContent=data.title.slice(0,150);
   $('v61PlayerArtist').textContent=String(data.artist||'').slice(0,100);
   $('v61PlayerPlay').textContent=data.playing?'Ⅱ':'▶';
   $('v61PlayerPlay').setAttribute('aria-label',data.playing?'Пауза':'Воспроизвести');
   $('v61PlayerPlay').disabled=!!data.error;
   $('v61PlayerClock').textContent=format(data.position);
   $('v61PlayerSeek').disabled=!Number.isFinite(data.duration)||data.duration<=0;
   $('v61PlayerSeek').value=String(data.duration>0?Math.round(data.position/data.duration*1000):0);
   chrome();
  }
  if(name==='cinema' && message.type==='video-playing')send('music',{action:'audio',command:'pause'});
 });
 window.addEventListener('veto:screen-changed',event=>{
  checkIdentity();const incoming=event.detail?.screen||'home';
  if(incoming!==screen&&!$('v61Player').hidden)closePlayer();
  screen=incoming;visibility();chrome();
 });
 new MutationObserver(()=>{for(const name of frames.keys())send(name,{action:'theme',theme:theme()});}).observe(root,{attributes:true,attributeFilter:['data-veto-theme']});
 // An account switch invalidates every in-flight media document and Blob URL.
 window.addEventListener('focus',checkIdentity);
 document.addEventListener('visibilitychange',checkIdentity);
 setInterval(checkIdentity,1000);
 const user=context().user;
 if(user)$('v6AccountName').textContent=[user.first_name,user.last_name].filter(Boolean).join(' ')||'Твой аккаунт Telegram';
 const requested=new URLSearchParams(location.search).get('screen');
 if(definitions[requested])openModule(requested);
 chrome();
})();
