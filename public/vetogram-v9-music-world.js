/* Vetogram V9 / World Music: real Audius discovery, one existing audio controller.
 * No invented global ranking, no streaming of metadata-only copyrighted hits. */
(()=>{
 'use strict';
 const V=window.VetogramMusic;
 const root=document.getElementById('v9MusicWorld');
 if(!V||!root||typeof V.trending!=='function'||typeof V.play!=='function')return;
 const $=id=>document.getElementById(id);
 const title=$('v9WorldTitle'),artist=$('v9WorldArtist'),art=$('v9WorldArt');
 const index=$('v9WorldIndex'),status=$('v9WorldStatus'),cards=$('v9WorldTracks');
 const play=$('v9WorldPlay'),like=$('v9WorldLike'),retry=$('v9WorldRetry');
 const prev=$('v9WorldPrev'),next=$('v9WorldNext'),catalog=$('v9WorldCatalog');
 const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const failed=new Set(),badArtwork=new Set();
 let tracks=[],selected=0,hover=false,loading=true;
 const node=(tag,cls,value)=>{
   const el=document.createElement(tag);
   if(cls)el.className=cls;
   if(value!==undefined)el.textContent=String(value);
   return el;
 };
 const safeArt=value=>{
   try{
     const u=new URL(String(value||''));
     const host=u.hostname.toLowerCase();
     return u.protocol==='https:'&&!u.username&&!u.password&&
       (host==='audius.co'||host.endsWith('.audius.co')||
        host==='audiuscdn.com'||host.endsWith('.audiuscdn.com')||
        host==='audius.network'||host.endsWith('.audius.network'))?u.href:'';
   }catch{return''}
 };
 const valid=t=>t?.source==='audius'&&/^audius:[a-zA-Z0-9_-]{1,120}$/.test(t.id||'')&&
   typeof t.title==='string'&&t.title.trim()&&typeof t.artist==='string'&&t.artist.trim();
 const current=()=>tracks[selected]||null;
 function cover(target,track,cls){
   target.replaceChildren();
   const url=safeArt(track?.artwork);
   if(!url||badArtwork.has(url)){
     target.append(node('span',cls+'-fallback',String(track?.title||'V').slice(0,1).toUpperCase()));
     return;
   }
   const img=node('img',cls+'-image');
   img.src=url;img.alt='';img.decoding='async';img.loading=target===art?'eager':'lazy';
   img.onerror=()=>{
     badArtwork.add(url);
     if(img.parentNode===target)cover(target,track,cls);
   };
   target.append(img);
 }
 function render(){
   const track=current();
   root.setAttribute('aria-busy',String(loading));
   play.disabled=!track;like.disabled=!track;prev.disabled=tracks.length<2;next.disabled=tracks.length<2;
   title.textContent=track?.title||'Музыка, которую можно включить';
   artist.textContent=track?.artist||'Загружаем записи Audius';
   index.textContent=tracks.length?String(selected+1).padStart(2,'0')+' / '+String(tracks.length).padStart(2,'0'):'00 / 00';
   if(track){
     cover(art,track,'v9-world');
     play.setAttribute('aria-label','Слушать '+track.title+' — '+track.artist);
     like.setAttribute('aria-label','Добавить в избранное '+track.title);
   }else{
     art.replaceChildren(node('span','v9-world-fallback','♫'));
     play.setAttribute('aria-label','Нет доступной записи');
     like.setAttribute('aria-label','Нет доступной записи');
   }
   cards.replaceChildren();
   if(loading&&!tracks.length){
     for(let i=0;i<4;i++){const box=node('div','v9-world-skeleton');box.setAttribute('aria-hidden','true');cards.append(box)}
   }else if(!tracks.length){
     cards.append(node('p','v9-world-empty','Источник пока не ответил. Можно повторить запрос или открыть личную библиотеку.'));
   }else{
     const fragment=document.createDocumentFragment();
     tracks.slice(0,12).forEach((item,i)=>{
       const button=node('button','v9-world-track'+(i===selected?' is-selected':''));button.type='button';
       button.setAttribute('aria-label','Выбрать '+item.title+' — '+item.artist);
       button.setAttribute('aria-pressed',String(i===selected));
       const picture=node('span','v9-world-track-cover');cover(picture,item,'v9-world-track');
       const details=node('span','v9-world-track-details');
       details.append(node('strong','',item.title),node('small','',item.artist));
       button.append(picture,details,node('span','v9-world-track-arrow','↗'));
       button.onclick=()=>{choose(i);playCurrent()};
       fragment.append(button);
     });
     cards.append(fragment);
   }
 }
 function choose(i){
   if(!tracks.length)return;
   selected=(i+tracks.length)%tracks.length;
   render();
 }
 function refresh(){
   const available=V.trending();
   const incoming=Array.isArray(available)?available:[];
   const unique=new Set();
   tracks=incoming.filter(t=>{
     if(!valid(t)||failed.has(t.id)||unique.has(t.id))return false;
     unique.add(t.id);return true;
   }).slice(0,12);
   if(selected>=tracks.length)selected=0;
   loading=false;
   status.textContent=tracks.length
     ? 'Audius Trending · '+tracks.length+' доступных записей. Это подборка Audius, не мировой чарт. Реальный запуск подтверждает плеер.'
     : 'Список пока пуст. Проверь соединение или повтори загрузку.';
   render();
 }
 function playCurrent(){
   const track=current();
   if(!track)return;
   // No second HTMLAudioElement: existing V9 native player owns playback/queue.
   V.play(track,tracks);
   status.textContent='Запускаем '+track.title+' через встроенный плеер. Ожидаем подтверждения звука…';
 }
 play.onclick=playCurrent;
 like.onclick=()=>{const t=current();if(t&&typeof V.toggleLike==='function')V.toggleLike(t)};
 prev.onclick=()=>choose(selected-1);next.onclick=()=>choose(selected+1);
 catalog.onclick=()=>{V.showPage('catalog');window.VetogramCatalog?.selectPreset?.('world')};
 retry.onclick=()=>{
   loading=true;status.textContent='Повторная загрузка Audius…';render();
   if(typeof V.refreshTrending==='function')V.refreshTrending();
 };
 document.addEventListener('vetogram:music-trending',event=>{
   if(event.detail?.status==='ready')refresh();
   else if(event.detail?.status==='error'){loading=false;refresh();status.textContent='Audius сейчас недоступен. Попробуй обновить подборку.'}
 });
 document.addEventListener('vetogram:audio-error',event=>{
   const id=String(event.detail?.trackId||'');
   if(!id.startsWith('audius:'))return;
   if(tracks.some(t=>t.id===id)){
     failed.add(id);refresh();
     status.textContent='Этот поток не воспроизвёлся — убрали его из подборки на время сеанса.';
   }
 });
 document.addEventListener('vetogram:audio-playing',event=>{
   const id=String(event.detail?.trackId||'');
   const t=tracks.find(x=>x.id===id);
   if(t)status.textContent='▶ Подтверждено воспроизведение: '+t.title+' · Audius';
 });
 root.addEventListener('pointerenter',()=>{hover=true});
 root.addEventListener('pointerleave',()=>{hover=false});
 // Rotate cover only. Never autoplay music or interrupt the active track.
 const timer=window.setInterval(()=>{
   if(!tracks.length||media?.matches||hover||root.contains(document.activeElement)||
      document.visibilityState!=='visible')return;
   choose(selected+1);
 },12000);
 window.addEventListener('pagehide',()=>window.clearInterval(timer),{once:true});
 root.hidden=false;
 document.documentElement.classList.add('v9-world-ready');
 refresh();
 if(!tracks.length){loading=true;status.textContent='Загружаем реальные записи Audius…';render()}
 window.VetogramV9WorldMusic=Object.freeze({
   state:()=>({count:tracks.length,selected,loading,failed:failed.size}),
   refresh
 });
})();