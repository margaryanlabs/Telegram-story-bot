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
   duration:Number.isFinite(audio.duration)?audio.duration:0,position:audio.currentTime||0,error:!!audio.error,waiting:audio.readyState<3&&!audio.paused}:null});
 }
 function applyTheme(value){
  document.documentElement.dataset.universeTheme=['pearl','linen','slate','graphite'].includes(value)?value:'graphite';
  document.body.classList.toggle('cinema-light',['pearl','linen'].includes(value));
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent || event.origin!==location.origin || event.data?.channel!=='vetogram-universe')return;
  const data=event.data;
  if(data.action==='theme')applyTheme(data.theme);
  if(data.action==='page'&&['library','import','home','search'].includes(data.page))window.VetogramMusic?.showPage(data.page);
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
 document.addEventListener('vetogram:library-change',update);
 document.addEventListener('vetogram:audio-error',update);
 if(window.VetogramModuleError || (audio&&!window.VetogramMusic))send({type:'failed'});
 else{ready=true;send({type:'ready',scope});update();}
})();
