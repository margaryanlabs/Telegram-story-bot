/* Narrow, validated lifecycle and playback bridge for the three bundled modules. */
(()=>{
 'use strict';
 if(!window.VetogramMediaContext?.embedded)return;
 const send=message=>parent.postMessage({channel:'vetogram-media',...message},location.origin);
 const audio=document.getElementById('audio'),video=document.getElementById('cinemaVideo');
 const scope=window.VetogramMediaContext.scope;
 let ready=false;
 function update(){
  if(!audio)return;
  const track=window.VetogramMusic?.now();
  send({type:'audio',state:track?{title:track.title,artist:track.artist,playing:!audio.paused&&!audio.ended&&!audio.error,
   id:String(track.id||'').slice(0,220),duration:Number.isFinite(audio.duration)?audio.duration:0,position:audio.currentTime||0,error:!!audio.error,waiting:audio.readyState<3&&!audio.paused}:null});
 }
 function applyTheme(value){
  document.documentElement.dataset.universeTheme=['pearl','linen','slate','graphite'].includes(value)?value:'graphite';
  document.body.classList.toggle('cinema-light',['pearl','linen'].includes(value));
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent || event.origin!==location.origin || event.data?.channel!=='vetogram-universe')return;
  const data=event.data;
  if(data.action==='theme')applyTheme(data.theme);
  if(data.action==='page'&&['library','import','home','search'].includes(data.page)){
   window.VetogramMusic?.showPage(data.page);
   if(data.page==='search'){
    window.VetogramCinema?.openTab?.('search');
    document.getElementById('bookSearch')?.focus?.();
   }
   if(data.page==='import')window.VetogramBooks?.showImport?.();
  }
  if(data.action==='open-item'&&typeof data.id==='string'&&data.id.length<=220){
    let opened=false;
    if(window.VetogramCinema?.openFilm)opened=window.VetogramCinema.openFilm(data.id)===true;
    else if(window.VetogramBooks?.openSavedByKey)opened=window.VetogramBooks.openSavedByKey(data.id)===true;
    else if(window.VetogramMusic?.openSavedById)opened=window.VetogramMusic.openSavedById(data.id)===true;
    send({type:'open-item-status',ok:opened});
  }
  if(data.action==='visible'&&!data.visible){
   video?.pause();
   // Pause official embedded video through the existing controller so hidden
   // frames cannot keep a film playing behind Chats. Reading state is retained.
   const close=document.getElementById('cinemaPlayerClose');
   if(close && !document.getElementById('cinemaPlayer')?.classList.contains('hidden'))close.click();
  }
  if(data.action==='audio'&&audio){
   if(data.command==='toggle')document.getElementById('miniPlay')?.click();
   if(data.command==='pause')audio.pause();
   if(data.command==='previous')document.getElementById('miniPrev')?.click();
   if(data.command==='next')document.getElementById('miniNext')?.click();
  }
  if(data.action==='seek'&&audio&&Number.isFinite(audio.duration)&&audio.duration>0&&Number.isFinite(data.value))audio.currentTime=audio.duration*Math.max(0,Math.min(1,data.value));
 });
 document.querySelectorAll('a[href="/"],a[href="/studio.html"],a.back-link').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();send({type:'navigate',target:'hub'});}));
 for(const event of ['playing','pause','ended','timeupdate','loadedmetadata','waiting','error','emptied'])audio?.addEventListener(event,update);
 document.getElementById('cinemaDetailsWatch')?.addEventListener('click',()=>send({type:'video-playing'}));
 video?.addEventListener('playing',()=>send({type:'video-playing'}));
 window.addEventListener('vetogram:cinema-playing',()=>send({type:'video-playing'}));
 function sendMusicLibrary(){
  const items=window.VetogramMusic?.getLibrary?.();
  if(Array.isArray(items))send({type:'music-library',items:items.slice(0,250)});
 }
 document.addEventListener('vetogram:library-change',()=>{update();sendMusicLibrary();});
 document.addEventListener('vetogram:audio-error',update);
 let libraryTimer=0;
 function sendCinemaLibrary(){
  const list=window.VetogramCinema?.getLibrary?.();
  if(Array.isArray(list))send({type:'library',items:list.slice(0,120)});
 }
 document.addEventListener('vetogram:cinema-library-change',()=>{
  clearTimeout(libraryTimer);libraryTimer=setTimeout(sendCinemaLibrary,400);
 });
 for(const [eventName,kind] of [['vetogram:cinema-opened','cinema'],['vetogram:book-progress','books']]){
  document.addEventListener(eventName,event=>{
   const item=event.detail;
   if(!item||typeof item.id!=='string'||typeof item.title!=='string')return;
   send({type:'recent',item:{kind,id:item.id.slice(0,220),title:item.title.slice(0,150),
     subtitle:String(item.subtitle||'').slice(0,110),progress:Number(item.progress)||0}});
  });
 }
 if(window.VetogramModuleError || (audio&&!window.VetogramMusic))send({type:'failed'});
 else{ready=true;send({type:'ready',scope});update();sendCinemaLibrary();sendMusicLibrary();}
})();
