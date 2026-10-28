/* Personal Telegram music in the existing Music player. No public file URLs. */
(()=>{
 'use strict';
 const music=window.VetogramMusic;if(!music)return;
 const dom=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const library=document.querySelector('[data-view="library"]');if(!library)return;
 const box=dom('section');box.className='v6-telegram-library';box.setAttribute('aria-label','Личная музыка из Telegram');
 box.append(dom('h3','Из Telegram'));
 const status=dom('p','Отправь боту свой MP3/M4A, затем обнови список. Бот получает только отправленные ему файлы.');status.setAttribute('role','status');
 const actions=dom('div');actions.className='v6-telegram-actions';
 const add=dom('button','Добавить из Telegram'),refresh=dom('button','Обновить список'),more=dom('button','Ещё треки');
 for(const button of [add,refresh,more])button.type='button';more.hidden=true;
 actions.append(add,refresh,more);const rows=dom('div');box.append(status,actions,rows);library.prepend(box);
 // The import action belongs to the same existing library, not a new website.
 const importPanel=document.querySelector('[data-view="import"]');
 if(importPanel){const button=dom('button','Добавить из Telegram');button.type='button';button.className='primary-btn';button.onclick=()=>{music.showPage('library');box.scrollIntoView({block:'start'});add.click();};importPanel.prepend(button);}
 let tracks=[],busy=false,controller=null,blobUrl='',identity=String(window.VetogramMediaContext?.initData||'');
 async function request(body,signal){
  const initData=String(window.VetogramMediaContext?.initData||'');
  if(!initData)throw Error('Открой VETOGRAM из своего Telegram для доступа к личной коллекции. Файлы с устройства доступны и здесь.');
  const response=await fetch('/api/music-library',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,initData}),signal:signal||AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.message||(response.status===401?'Сессия Telegram истекла. Открой приложение заново.':'Библиотека сейчас недоступна. Повтори позже.'));}
  return response;
 }
 add.onclick=()=>{
  const api=window.Telegram?.WebApp;
  // Request our own bot's public username from an authenticated backend instead
  // of hardcoding an unrelated/dedicated music bot or trusting user input.
  request({action:'bot'}).then(r=>r.json()).then(data=>{
   if(!/^[A-Za-z0-9_]{5,32}$/.test(data.username||''))throw Error('Адрес бота пока недоступен. Отправь MP3/M4A в чат бота, из которого открыл VETOGRAM.');
   const url='https://t.me/'+data.username;
   if(api?.openTelegramLink)api.openTelegramLink(url);else window.open(url,'_blank','noopener,noreferrer');
  }).catch(error=>{status.textContent=error.message;});
 };
 const artworkCache=new Map(),artworkQueue=[];let artworkWorkers=0;
 function pumpArtwork(){
  while(artworkWorkers<2&&artworkQueue.length){
   const {track,cover}=artworkQueue.shift();if(!cover.isConnected)continue;
   const cached=artworkCache.get(track.id);
   if(cached){paintArtwork(cover,cached);continue;}
   artworkWorkers++;
   request({action:'artwork',id:track.id}).then(r=>r.blob()).then(blob=>{
    if(identity!==String(window.VetogramMediaContext?.initData||''))return;
    const url=URL.createObjectURL(blob);artworkCache.set(track.id,url);if(cover.isConnected)paintArtwork(cover,url);
   }).catch(()=>{}).finally(()=>{artworkWorkers--;pumpArtwork();});
  }
 }
 function paintArtwork(cover,url){const image=dom('img');image.src=url;image.alt='';cover.replaceChildren(image);}
 const coverObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){coverObserver.unobserve(entry.target);const track=tracks.find(t=>t.id===entry.target.dataset.track);if(track)artworkQueue.push({track,cover:entry.target});}
  pumpArtwork();
 }):null;
 function draw(){
  coverObserver?.disconnect();artworkQueue.length=0;rows.replaceChildren();
  for(const track of tracks){
   const row=dom('article');row.className='v6-telegram-track';
   const cover=dom('span','♫');cover.className='v6-telegram-cover';cover.setAttribute('aria-hidden','true');
   const info=dom('div');info.append(dom('strong',track.title),dom('small',track.artist));
   const play=dom('button',track.downloadable?'▶':'В Telegram');play.type='button';play.disabled=!track.downloadable;
   play.setAttribute('aria-label',track.downloadable?'Воспроизвести: '+track.title:'Файл доступен в чате Telegram');play.onclick=()=>music.play(track,tracks.filter(t=>t.downloadable));
   const like=dom('button',music.liked().some(t=>t.id===track.id)?'♥':'♡');like.type='button';like.setAttribute('aria-label','В избранное: '+track.title);like.onclick=()=>{music.toggleLike(track);draw();};
   row.append(cover,info,like,play);rows.append(row);
   if(track.hasArtwork){cover.dataset.track=track.id;coverObserver?.observe(cover);}
  }
 }
 async function load(append=false){
  if(busy)return;busy=true;refresh.disabled=true;more.disabled=true;
  const signed=String(window.VetogramMediaContext?.initData||'');
  status.textContent='Обновляем личную библиотеку…';
  try{
   const response=await request({action:'list',offset:append?tracks.length:0});const data=await response.json();
   if(signed!==String(window.VetogramMediaContext?.initData||''))return;
   tracks=append?[...tracks,...data.tracks]:data.tracks;draw();more.hidden=tracks.length>=data.total;
   status.textContent=data.total?'Твоих записей: '+data.total+'. Файлы до 20 МБ можно слушать здесь.':'Пока пусто. Отправь боту MP3/M4A, который вправе хранить и использовать.';
  }catch(error){status.textContent=error.message;}finally{busy=false;refresh.disabled=false;more.disabled=false;}
 }
 refresh.onclick=()=>load();more.onclick=()=>load(true);
 async function play(track,collection,generation){
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  status.textContent='Подключаем «'+track.title+'»…';
  try{
   const response=await request({action:'stream',id:track.id},signal);const blob=await response.blob();
   if(signal.aborted || music.generation()!==generation || identity!==String(window.VetogramMediaContext?.initData||''))return;
   if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(blob);
   // Core accepts Blob URLs only for an explicitly resolved personal record.
   music.play({...track,url:blobUrl},collection);status.textContent='';
  }catch(error){if(!signal.aborted){status.textContent=error.message;document.dispatchEvent(new CustomEvent('vetogram:audio-error'));}}
 }
 document.addEventListener('vetogram:library-change',draw);
 window.addEventListener('pagehide',()=>{controller?.abort();if(blobUrl)URL.revokeObjectURL(blobUrl);coverObserver?.disconnect();for(const url of artworkCache.values())URL.revokeObjectURL(url);});
 window.VetogramTelegramLibrary=Object.freeze({play,refresh:load,tracks:()=>tracks.slice()});
 document.querySelectorAll('[data-page="library"]').forEach(button=>button.addEventListener('click',()=>{if(!tracks.length)load();}));
})();
