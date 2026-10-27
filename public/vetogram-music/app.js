/* VETOGRAM MUSIC / standalone music-only app · no Telegram account or DRM scraping.
   All third-party playbacks use official open Audius links. Personal files stay in IndexedDB. */
(()=>{
"use strict";
const $=id=>document.getElementById(id),audio=$("audio");
const API="https://api.audius.co/v1",STORE_KEY="vetogram-music-favorites-v1",
 IMPORTS_KEY="vetogram-music-imported-v1",THEME_KEY="vetogram-music-theme-v1";
const MAX_FILES=30,MAX_FILE_BYTES=60*1024*1024,MAX_LIBRARY_BYTES=350*1024*1024;
const state={route:"home",trending:[],latest:[],search:[],liked:[],local:[],imports:[],
 queue:[],queueIndex:-1,current:null,routeTitle:"Для тебя",shuffle:false,repeat:"all",
 libraryTab:"liked",theme:"ember",db:null,dbReady:false,sourceUrl:"",objectUrls:new Map(),
 sleepTimeout:0,timer:null,fetchAbort:null,lastPlayingType:null};
const clean=(v,n=160)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,n);
const norm=v=>clean(v,260).toLocaleLowerCase("ru-RU").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const safeUrl=u=>{try{const p=new URL(String(u));return p.protocol==="https:"?p.href:"";}catch{return"";}};
const e=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
const stored=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||"null");return v??fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{notice("Хранилище устройства недоступно — коллекция не сохранена.");return false}};
const time=sec=>Number.isFinite(sec)&&sec>=0?Math.floor(sec/60)+":"+String(Math.floor(sec%60)).padStart(2,"0"):"0:00";
let toastTimeout;
function notice(msg){const node=$("toast");node.textContent=msg;node.classList.add("visible");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove("visible"),4600);}
function formatTrack(raw){
 if(!raw||!raw.id||!raw.title||raw.is_stream_gated||raw.is_unlisted||raw.is_delete)return null;
 const artwork=safeUrl(raw.artwork?.["480x480"]||raw.artwork?.["150x150"]||"");
 const artist=clean(raw.user?.name||raw.user?.handle||"Audius artist",100);
 return {id:"audius:"+clean(raw.id,125),providerId:clean(raw.id,125),
 title:clean(raw.title,140),artist,artwork,kind:"audius",duration:Math.max(0,Number(raw.duration)||0),
 source:safeUrl(raw.permalink)||"https://audius.co/",isGated:false};
}
function localRecord(row){
 return {id:row.id,title:clean(row.name,135),artist:clean(row.artist||"Мои файлы",100),
 artwork:"",kind:"local",duration:0,source:"",size:row.size||0};
}
function dataValues(arr){return Array.isArray(arr)?arr.filter(x=>x&&typeof x.id==="string"&&typeof x.title==="string"&&["audius","local"].includes(x.kind)).slice(0,300).map(x=>({id:clean(x.id,180),providerId:clean(x.providerId||"",130),title:clean(x.title,140),artist:clean(x.artist,100),artwork:safeUrl(x.artwork),kind:x.kind,source:safeUrl(x.source)})):[];}
state.liked=dataValues(stored(STORE_KEY,[]));
state.imports=Array.isArray(stored(IMPORTS_KEY,[]))?stored(IMPORTS_KEY,[]).slice(0,250).filter(x=>x&&typeof x.title==="string"&&typeof x.artist==="string").map(x=>({id:clean(x.id,200),title:clean(x.title,130),artist:clean(x.artist,100)})):[];
state.theme=["ember","aurora","noir"].includes(stored(THEME_KEY,"ember"))?stored(THEME_KEY,"ember"):"ember";
function loved(t){return Boolean(t&&state.liked.some(x=>x.id===t.id));}
function renderCounts(){
 $("statLiked").textContent=state.liked.length;$("statLocal").textContent=state.local.length;
 $("statImported").textContent=state.imports.length;$("sideLikedCount").textContent=state.liked.length;
}
function toggleLike(t){
 if(!t)return;
 const next=state.liked.filter(x=>x.id!==t.id);if(next.length===state.liked.length)next.unshift(t);
 if(save(STORE_KEY,next.map(({id,providerId,title,artist,artwork,kind,source})=>({id,providerId,title,artist,artwork,kind,source}))))state.liked=next;
 renderCounts();renderLibrary();renderPlayer();renderTrending();renderLatest();if(state.route==="search")renderSearchResults();
}
function showRoute(route){
 if(!["home","search","library","import"].includes(route))route="home";
 state.route=route;
 for(const id of ["home","search","library","import"]){
  $(id+"Page").classList.toggle("active",id===route);
  document.querySelectorAll('[data-route="'+id+'"]').forEach(x=>x.classList.toggle("selected",route===id));
 }
 $("pageHeading").textContent={home:"Для тебя",search:"Поиск",library:"Моя музыка",import:"Добавить музыку"}[route];
 try{history.replaceState(null,"","#"+route)}catch{}
 if(route==="library")renderLibrary();
 window.scrollTo({top:0,behavior:"instant"});
}
document.querySelectorAll("[data-route]").forEach(btn=>btn.addEventListener("click",()=>showRoute(btn.dataset.route)));
$("sidePlaylist").addEventListener("click",()=>{state.libraryTab="liked";showRoute("library")});
$("avatar").addEventListener("click",()=>showRoute("library"));
$("topSearch").addEventListener("click",()=>{showRoute("search");$("searchInput").focus()});
$("topUpload").addEventListener("click",()=>showRoute("import"));
$("heroDiscover").addEventListener("click",()=>showRoute("search"));
$("heroLocal").addEventListener("click",()=>showRoute("import"));
$("editorialImport").addEventListener("click",()=>showRoute("import"));
document.addEventListener("keydown",ev=>{
 if(ev.key==="Escape"&&!$("studio").classList.contains("hidden"))closeStudio();
 if(ev.key==="/"&&!["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){ev.preventDefault();showRoute("search");$("searchInput").focus()}
});
function photo(url,cls,icon="♫"){
 const div=e("div",cls),src=safeUrl(url);
 if(src){const img=e("img");img.src=src;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>img.remove();div.append(img)}
 div.append(e("span","",icon));return div;
}
function trackCard(t,group){
 const card=e("article","track-card");
 const art=photo(t.artwork,"track-art");
 const overlay=e("span","play-overlay","▶");art.append(overlay);
 const play=e("button","",null);play.type="button";play.setAttribute("aria-label","Слушать "+t.title);
 play.style.cssText="position:absolute;inset:0;background:transparent;border:0;z-index:2;cursor:pointer";
 play.addEventListener("click",()=>playFrom(group,t.id));art.append(play);
 card.append(art,e("strong","",t.title),e("small","",t.artist));
 const heart=e("button","card-like"+(loved(t)?" is-liked":""),loved(t)?"♥":"♡");
 heart.type="button";heart.setAttribute("aria-label",loved(t)?"Убрать из избранного":"Нравится");heart.onclick=()=>toggleLike(t);
 card.append(heart);return card;
}
function songRow(t,group,index,imported=false){
 const row=e("div","song-row"+(state.current?.id===t.id?" current":""));
 const pic=photo(t.artwork,"song-art",t.kind==="local"?"♫":String(index+1).padStart(2,"0"));row.append(pic);
 const name=e("div","song-name");name.append(e("b","",t.title),e("small","",t.artist));row.append(name);
 const actions=e("div","song-actions");
 if(imported){
  const search=e("button","song-play","⌕");search.title="Найти доступную версию на Audius";
  search.onclick=()=>{showRoute("search");$("searchInput").value=t.artist+" "+t.title;performSearch($("searchInput").value)};
  actions.append(search);
  const remove=e("button","heart","×");remove.title="Удалить из списка";
  remove.onclick=()=>{state.imports=state.imports.filter(x=>x.id!==t.id);save(IMPORTS_KEY,state.imports);renderLibrary();renderCounts()};
  actions.append(remove);
 }else{
  const heart=e("button","heart"+(loved(t)?" active":""),loved(t)?"♥":"♡");
  heart.type="button";heart.setAttribute("aria-label","Сохранить "+t.title);heart.onclick=()=>toggleLike(t);
  const play=e("button","song-play","▶");play.type="button";play.setAttribute("aria-label","Слушать "+t.title);
  play.onclick=()=>playFrom(group,t.id);
  actions.append(heart,play);
 }
 row.append(actions);return row;
}
function renderTrending(){
 const box=$("trendingGrid");box.replaceChildren();
 if(!state.trending.length){box.append(e("div","loading-card","Каталог Audius пока недоступен. Добавь свои треки или повтори попытку."));return}
 for(const t of state.trending.slice(0,10))box.append(trackCard(t,state.trending));
}
function renderLatest(){
 const box=$("latestList");box.replaceChildren();
 if(!state.latest.length){box.append(e("div","loading-line","Новинки пока не загрузились. Можно начать с поиска или собственных файлов."));return}
 state.latest.slice(0,10).forEach((t,i)=>box.append(songRow(t,state.latest,i)));
}
function renderSearchResults(){
 const box=$("searchResults");box.replaceChildren();
 if(!state.search.length){const empty=e("div","empty-state");empty.append(e("span","empty-symbol","⌕"),e("strong","","Пока ничего не найдено"),e("p","","Попробуй другого исполнителя. Свои файлы можно добавить отдельно."));box.append(empty);return}
 state.search.forEach((t,i)=>box.append(songRow(t,state.search,i)));
}
function renderLibrary(){
 const tabs=document.querySelectorAll("[data-library-tab]");
 tabs.forEach(b=>b.classList.toggle("selected",b.dataset.libraryTab===state.libraryTab));
 const list=$("libraryResults");list.replaceChildren();
 let data=[],imported=false;
 if(state.libraryTab==="liked")data=state.liked;
 if(state.libraryTab==="local")data=state.local.map(localRecord);
 if(state.libraryTab==="imported"){data=state.imports;imported=true}
 if(!data.length){
  const empty=e("div","empty-state");
  empty.append(e("span","empty-symbol",state.libraryTab==="local"?"♫":"♡"),
   e("strong","",state.libraryTab==="local"?"Добавь свои аудиофайлы":state.libraryTab==="imported"?"Перенеси плейлист":"Собирай любимые записи"),
   e("p","",state.libraryTab==="local"?"Файлы сохраняются только в этом браузере.":state.libraryTab==="imported"?"Вставь названия из VK или Яндекса — без логина и пароля.":"Нажимай ♡ рядом с треками."));
  const button=e("button","button-primary","Добавить музыку ↗");button.onclick=()=>showRoute("import");empty.append(button);list.append(empty);return
 }
 data.forEach((t,i)=>list.append(songRow(t,data,i,imported)));
}
document.querySelectorAll("[data-library-tab]").forEach(b=>b.onclick=()=>{state.libraryTab=b.dataset.libraryTab;renderLibrary()});
function apiUrl(type,query){
 if(type==="trending")return API+"/tracks/trending?"+new URLSearchParams({limit:"20",time:"week"});
 if(type==="latest")return API+"/tracks/latest?"+new URLSearchParams({limit:"20"});
 return API+"/tracks/search?"+new URLSearchParams({query:query||"",limit:"35"});
}
async function getMusic(type,query,controller){
 const ctrl=controller||new AbortController(),id=setTimeout(()=>ctrl.abort(),13000);
 try{
  const response=await fetch(apiUrl(type,query),{signal:ctrl.signal,headers:{Accept:"application/json"},credentials:"omit"});
  if(!response.ok)throw Error("Audius ответил "+response.status);
  const body=await response.json();
  if(!Array.isArray(body.data))throw Error("Каталог вернул неизвестный формат");
  return body.data.map(formatTrack).filter(Boolean);
 }finally{clearTimeout(id)}
}
async function loadFeatured(){
 $("trendingStatus").textContent="Запрашиваем Audius…";
 const result=await Promise.allSettled([getMusic("trending"),getMusic("latest")]);
 if(result[0].status==="fulfilled"){
  state.trending=result[0].value;
  $("trendingStatus").textContent=state.trending.length+" треков · Audius";
 }else $("trendingStatus").textContent="Источник временно недоступен";
 if(result[1].status==="fulfilled")state.latest=result[1].value;
 renderTrending();renderLatest();
 if(!state.trending.length&&!state.latest.length)notice("Audius недоступен. Собственные файлы можно слушать без каталога.");
}
$("reloadDiscovery").onclick=loadFeatured;
async function performSearch(query){
 const q=clean(query,100);
 if(q.length<2){$("searchStatus").textContent="Введите минимум два символа";return}
 if(state.fetchAbort)state.fetchAbort.abort();
 const ctrl=new AbortController();state.fetchAbort=ctrl;
 state.search=[];
 $("searchStatus").textContent="Ищем «"+q+"»…";
 const box=$("searchResults");box.replaceChildren();
 const waiting=e("div","loading-line","Запрашиваем Audius…");box.append(waiting);
 try{
  const result=await getMusic("search",q,ctrl);if(state.fetchAbort!==ctrl)return;
  state.search=result;$("searchStatus").textContent="Найдено "+result.length+" · Audius";renderSearchResults();
 }catch(err){if(state.fetchAbort!==ctrl)return;
  $("searchStatus").textContent=err?.name==="AbortError"?"Поиск прерван":"Источник недоступен";
  box.replaceChildren(e("div","loading-line","Не удалось загрузить результаты. Попробуй ещё раз."));
 }finally{if(state.fetchAbort===ctrl)state.fetchAbort=null}
}
$("searchForm").onsubmit=ev=>{ev.preventDefault();performSearch($("searchInput").value)};
document.querySelectorAll("[data-search]").forEach(x=>x.onclick=()=>{showRoute("search");$("searchInput").value=x.dataset.search;performSearch(x.dataset.search)});
function currentArray(){return state.queue}
function playFrom(list,id){
 const tracks=list.filter(t=>t&&!t.isGated&&!t.disabled);
 const pos=tracks.findIndex(t=>t.id===id);
 if(pos<0)return notice("Запись недоступна.");
 state.queue=tracks;state.queueIndex=pos;
 playTrack(tracks[pos]);
}
function playbackSrc(t){
 if(t.kind==="audius")return API+"/tracks/"+encodeURIComponent(t.providerId||t.id.replace(/^audius:/,""))+"/stream";
 if(t.kind==="local"){
  const file=state.local.find(x=>x.id===t.id);
  if(!file?.blob)return "";
  if(state.objectUrls.has(t.id))return state.objectUrls.get(t.id);
  const uri=URL.createObjectURL(file.blob);state.objectUrls.set(t.id,uri);return uri;
 }
 return "";
}
let activation=0;
function playTrack(t){
 if(!t)return;
 state.current=t;++activation;
 audio.pause();audio.removeAttribute("src");audio.load();
 $("player").classList.remove("hidden");
 const src=playbackSrc(t);
 if(!src){notice("Аудиофайл недоступен на этом устройстве.");return}
 audio.src=src;audio.load();renderPlayer();
 // Keep play() directly inside the user click handler: iOS WebView can reject
 // play requests performed after an awaited IndexedDB or network operation.
 audio.play().catch(()=>notice(t.kind==="audius"?"Трек недоступен в этом браузере или регионе. Попробуй другой трек.":"Формат файла не поддерживается устройством."));
 updateMediaSession(t);
 if(state.route==="library")renderLibrary();
}
function next(direction,ended=false){
 if(!state.queue.length)return;
 if(ended&&state.repeat==="one"){audio.currentTime=0;audio.play().catch(()=>{});return}
 if(ended&&state.repeat==="off"&&state.queueIndex===state.queue.length-1){audio.pause();return}
 if(state.shuffle&&direction>0&&state.queue.length>1){
  let i=Math.floor(Math.random()*(state.queue.length-1));if(i>=state.queueIndex)i++;
  state.queueIndex=i;
 }else state.queueIndex=(state.queueIndex+direction+state.queue.length)%state.queue.length;
 playTrack(state.queue[state.queueIndex]);
}
function togglePlay(){
 if(!state.current){if(state.trending[0])playFrom(state.trending,state.trending[0].id);else notice("Выбери запись или добавь свою музыку.");return}
 if(audio.paused)audio.play().catch(()=>notice("Не удалось запустить трек. Выбери другую запись."));
 else audio.pause();
}
function renderPlayer(){
 const t=state.current;if(!t)return;
 $("playerTitle").textContent=t.title;$("playerArtist").textContent=t.artist;
 $("playerSource").textContent=t.kind==="local"?"МОЙ ФАЙЛ":"AUDIUS";
 $("miniHeart").textContent=loved(t)?"♥":"♡";
 $("studioHeart").textContent=loved(t)?"♥ В избранном":"♡ Сохранить";
 $("studioTitle").textContent=t.title;$("studioArtist").textContent=t.artist;
 $("studioTrackSource").textContent=t.kind==="local"?"Личный аудиофайл":"Audius · независимая музыка";
 $("studioSource").textContent=t.kind==="local"?"YOUR MUSIC":"AUDIUS LIVE";
 const pic=safeUrl(t.artwork);
 $("openStudioArt").style.backgroundImage=pic?"url('"+pic+"')":"linear-gradient(135deg,#f6acae,#56517a)";
 $("studioArtwork").style.backgroundImage=pic?"url('"+pic+"')":"linear-gradient(120deg,var(--a),var(--b),#51456c)";
 $("studioArtwork").firstElementChild.style.opacity=pic?"0":"1";
 const playing=!audio.paused&&!audio.ended&&!!audio.src;
 $("playButton").textContent=playing?"Ⅱ":"▶";$("studioPlay").textContent=playing?"Ⅱ":"▶";
 $("playButton").setAttribute("aria-label",playing?"Пауза":"Воспроизведение");
 $("studio").dataset.playing=String(playing);
 $("shuffleButton").classList.toggle("is-on",state.shuffle);
 $("repeatButton").classList.toggle("is-on",state.repeat!=="off");
 $("repeatButton").textContent=state.repeat==="one"?"↻¹":"↻";
 $("repeatButton").title="Повтор: "+({all:"все",one:"одна",off:"выключен"})[state.repeat];
 progress();
}
function progress(){
 const d=audio.duration||state.current?.duration||0,c=audio.currentTime||0;
 const ratio=d&&Number.isFinite(d)?Math.max(0,Math.min(1000,c/d*1000)):0;
 $("seek").value=String(ratio);$("studioSeek").value=String(ratio);
 $("currentTime").textContent=time(c);$("studioTime").textContent=time(c);
 $("duration").textContent=time(d);$("studioDuration").textContent=time(d);
 if("mediaSession" in navigator&&navigator.mediaSession.setPositionState&&Number.isFinite(audio.duration)&&audio.duration>0){
  try{navigator.mediaSession.setPositionState({duration:audio.duration,position:Math.min(c,audio.duration),playbackRate:audio.playbackRate})}catch{}
 }
}
function seek(value){if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(value)/1000}
$("seek").oninput=ev=>seek(ev.target.value);
$("studioSeek").oninput=ev=>seek(ev.target.value);
$("playButton").onclick=togglePlay;$("studioPlay").onclick=togglePlay;
$("prevButton").onclick=()=>next(-1);$("studioPrev").onclick=()=>next(-1);
$("nextButton").onclick=()=>next(1);$("studioNext").onclick=()=>next(1);
$("shuffleButton").onclick=()=>{state.shuffle=!state.shuffle;renderPlayer();notice(state.shuffle?"Перемешивание включено":"Перемешивание выключено")};
$("repeatButton").onclick=()=>{state.repeat=state.repeat==="all"?"one":state.repeat==="one"?"off":"all";renderPlayer()};
$("miniHeart").onclick=()=>toggleLike(state.current);$("studioHeart").onclick=()=>toggleLike(state.current);
function setVolume(v){const n=Math.max(0,Math.min(100,Number(v)||0));audio.volume=n/100;$("volume").value=String(n);$("studioVolume").value=String(n);}
$("volume").oninput=ev=>setVolume(ev.target.value);$("studioVolume").oninput=ev=>setVolume(ev.target.value);
$("studioSpeed").onchange=ev=>{audio.playbackRate=Number(ev.target.value)||1};
$("studioSleep").onchange=ev=>{
 clearTimeout(state.timer);
 const mins=Number(ev.target.value);state.sleepTimeout=mins?Date.now()+mins*60000:0;
 if(mins){state.timer=setTimeout(()=>{audio.pause();$("studioSleep").value="0";notice("Таймер сна остановил воспроизведение.")},mins*60000);notice("Таймер сна: "+mins+" минут.")}
 else notice("Таймер сна выключен.");
};
function openStudio(){
 if(!state.current&&state.trending[0]){notice("Выбери трек, затем включи полноэкранный плеер.");return}
 $("studio").classList.remove("hidden");document.body.style.overflow="hidden";
 renderPlayer();telegramBack();
}
function closeStudio(){$("studio").classList.add("hidden");document.body.style.overflow="";telegramBack();}
$("openStudio").onclick=openStudio;$("openStudioArt").onclick=openStudio;$("studioClose").onclick=closeStudio;
function setTheme(value){
 state.theme=value;$("studio").dataset.theme=value;save(THEME_KEY,value);
 document.querySelectorAll("[data-theme]").forEach(b=>b.classList.toggle("selected",b.dataset.theme===value));
}
document.querySelectorAll("[data-theme]").forEach(btn=>btn.onclick=()=>setTheme(btn.dataset.theme));
setTheme(state.theme);
for(let i=0;i<45;i++){
 const b=e("i"),h=16+Math.round(Math.abs(Math.sin(i*1.54)+Math.cos(i*.73))*39);
 b.style.setProperty("--height",h+"%");b.style.setProperty("--delay",(-(i*.07)%1.4)+"s");
 $("visualizer").append(b);
}
for(const evt of ["play","pause","ended","loadedmetadata","durationchange"]){
 audio.addEventListener(evt,()=>{
  if(evt==="ended"){next(1,true);return}
  renderPlayer();
 })
}
audio.addEventListener("timeupdate",progress);
audio.addEventListener("error",()=>{
 if(!state.current||!audio.src)return;
 notice("Аудио не загрузилось. Источник или формат может быть недоступен на этом устройстве.");
});
function updateMediaSession(t){
 if(!("mediaSession" in navigator))return;
 try{navigator.mediaSession.metadata=new MediaMetadata({
  title:t.title,artist:t.artist,album:"Vetogram Music",
  artwork:t.artwork?[{src:t.artwork,sizes:"480x480"}]:[]
 });}catch{}
}
if("mediaSession" in navigator){
 for(const [action,fn] of Object.entries({
  play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),previoustrack:()=>next(-1),nexttrack:()=>next(1),
  seekto:d=>{if(Number.isFinite(d.seekTime))audio.currentTime=Math.max(0,Math.min(d.seekTime,audio.duration||0));},
  seekbackward:()=>{audio.currentTime=Math.max(0,audio.currentTime-10)},
  seekforward:()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+10)}
 })){try{navigator.mediaSession.setActionHandler(action,fn)}catch{}}
}
setVolume(80);
async function openDb(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error("IndexedDB недоступен"));
  const request=indexedDB.open("vetogram-music-local-v1",1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("files"))db.createObjectStore("files",{keyPath:"id"})};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
function databaseGet(id){
 return new Promise((resolve,reject)=>{
  if(!state.db)return resolve(null);
  const tx=state.db.transaction("files","readonly"),req=tx.objectStore("files").get(id);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
 });
}
function databaseAll(){
 return new Promise((resolve,reject)=>{
  if(!state.db)return resolve([]);
  const tx=state.db.transaction("files","readonly"),req=tx.objectStore("files").getAll();
  req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
 });
}
function databasePut(rec){
 return new Promise((resolve,reject)=>{
  if(!state.db)return reject(new Error("No IndexedDB"));
  const tx=state.db.transaction("files","readwrite");tx.objectStore("files").put(rec);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
}
async function initLibrary(){
 try{state.db=await openDb();state.dbReady=true;
  const rows=await databaseAll();state.local=rows.map(x=>({id:x.id,name:x.name,artist:x.artist,size:x.size,blob:x.blob,at:x.at}));
  renderCounts();
 }catch{state.db=null;state.dbReady=false;notice("Локальное хранение файлов недоступно. Включи хранилище браузера.");}
}
function chooseFiles(){$("audioPicker").click()}
$("chooseFile").onclick=chooseFiles;
$("audioPicker").addEventListener("change",async()=>{
 const files=Array.from($("audioPicker").files||[]).slice(0,MAX_FILES);$("audioPicker").value="";
 if(!files.length)return;
 const currentBytes=state.local.reduce((sum,x)=>sum+(Number(x.size)||0),0);
 let added=0,used=currentBytes;
 for(const file of files){
  if(!file.size||file.size>MAX_FILE_BYTES){notice("Пропущен слишком большой или пустой файл: "+clean(file.name,60));continue}
  if(!file.type.startsWith("audio/")&&!/\.(mp3|m4a|aac|ogg|wav|opus|flac)$/i.test(file.name))continue;
  if(used+file.size>MAX_LIBRARY_BYTES){notice("Общий размер библиотеки ограничен 350 МБ.");break}
  const name=clean(file.name.replace(/\.(mp3|m4a|aac|ogg|wav|opus|flac)$/i,""),130),id="local:"+String(Date.now())+":"+Math.random().toString(36).slice(2);
  let artist="Мои файлы",title=name;
  if(name.includes(" - ")){const [a,...rest]=name.split(" - ");artist=clean(a,100);title=clean(rest.join(" - "),130)}
  const rec={id,name:title,artist,size:file.size,at:Date.now(),blob:file};
  try{await databasePut(rec);state.local.push(rec);added++;used+=file.size}
  catch{state.local.push(rec);added++;used+=file.size;notice("Файл добавлен на сеанс, но сохранение после перезапуска недоступно.")}
 }
 renderCounts();renderLibrary();if(added){state.libraryTab="local";showRoute("library");notice("Добавлено личных файлов: "+added);}
});
function parsePlaylist(raw){
 const seen=new Set(),out=[];
 for(const line of String(raw||"").split(/\r?\n/)){
  const x=line.replace(/^\s*\d+[.)]\s*/,"").trim();
  const m=x.match(/^(.{2,110}?)\s+[—–-]\s+(.{1,160})$/);if(!m)continue;
  const artist=clean(m[1],100),title=clean(m[2],135),key=norm(artist+" "+title);
  if(seen.has(key))continue;seen.add(key);
  out.push({id:"import:"+key.slice(0,175),artist,title});if(out.length>=200)break;
 }
 return out;
}
$("importList").onclick=()=>{
 const list=parsePlaylist($("playlistText").value);
 if(!list.length)return notice("Формат: Исполнитель — Название. Каждая песня с новой строки.");
 const map=new Map(state.imports.map(x=>[x.id,x]));
 let added=0;for(const t of list)if(!map.has(t.id)&&map.size<250){map.set(t.id,t);added++}
 const next=[...map.values()];
 if(save(IMPORTS_KEY,next))state.imports=next;
 state.libraryTab="imported";renderCounts();showRoute("library");
 notice("Импортировано названий: "+added+". Аудиофайлы других сервисов не копировались.");
};
function telegramBack(){
 const tg=window.Telegram?.WebApp;
 if(!tg?.initData)return;
 try{if($("studio").classList.contains("hidden"))tg.BackButton?.hide();else tg.BackButton?.show()}catch{}
}
try{
 const tg=window.Telegram?.WebApp;
 if(tg&&typeof tg.initData==="string"&&tg.initData){
  tg.ready();tg.expand();tg.setHeaderColor?.("#0b0b12");tg.setBackgroundColor?.("#0b0b12");
  const applyInsets=()=>{
   const sa=tg.contentSafeAreaInset||tg.safeAreaInset||{};
   document.documentElement.style.setProperty("--tg-safe-top",Math.min(120,Math.max(0,Number(sa.top)||0))+"px");
   document.documentElement.style.setProperty("--tg-safe-bottom",Math.min(120,Math.max(0,Number(sa.bottom)||0))+"px");
  };
  applyInsets();tg.onEvent?.("safeAreaChanged",applyInsets);tg.onEvent?.("contentSafeAreaChanged",applyInsets);
  tg.BackButton?.onClick?.(()=>{if(!$("studio").classList.contains("hidden"))closeStudio()});
  telegramBack();
 }
}catch{}
window.addEventListener("pagehide",()=>{for(const url of state.objectUrls.values())URL.revokeObjectURL(url);state.objectUrls.clear();});
window.addEventListener("hashchange",()=>{
 const route=location.hash.replace("#","");if(["home","search","library","import"].includes(route))showRoute(route);
});
const initial=location.hash.slice(1);showRoute(["home","search","library","import"].includes(initial)?initial:"home");
renderCounts();renderLibrary();loadFeatured();initLibrary();
window.VetogramMusic=Object.freeze({
 version:"1.0.0",getState:()=>({route:state.route,playing:!audio.paused,current:state.current?.title||null,liked:state.liked.length,local:state.local.length}),
 search:performSearch,openPlayer:openStudio,parsePlaylist
});
})();