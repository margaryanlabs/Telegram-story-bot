/* Vetogram Music beta. Real user-imported audio + open Audius discovery + Radio Browser.
   Metadata import does not transfer protected Yandex/VK recordings.
   No Telegram sessions, scraping, credentials or remote uploads. */
(()=>{
"use strict";
const $=id=>document.getElementById(id),$$=q=>Array.from(document.querySelectorAll(q));
const audio=$("audio"),app=$("app"),MAX_FILE=30*1048576,MAX_BATCH=120*1048576;
const scope=window.VetogramMediaContext?.scope||"device";
const key="vetogram-music-v1:"+scope,DB_NAME="vetogram-music-private-v1:"+scope,STORE="tracks";
let playbackGeneration=0;
const moods={chill:"chill",electronic:"electronic","hip-hop":"hip hop"};
const state={page:"home",tracks:[],search:[],radios:[],local:[],liked:[],metadata:[],streams:[],queue:[],index:-1,now:null,shuffle:false,repeat:"all",mood:"ember",source:"",playRequested:false,localUrls:[],activeController:null,radioController:null,sleepDeadline:0,sleepTimer:null,db:null};
const dom=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
const clean=(v,n=120)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,n);
const safe=(url)=>{try{const u=new URL(String(url));return u.protocol==="https:"?u.href:""}catch{return""}};
const format=s=>!Number.isFinite(s)||s<0?"0:00":Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
const send=(msg)=>{const e=$("globalToast");e.textContent=msg;e.classList.add("visible");clearTimeout(send.timer);send.timer=setTimeout(()=>e.classList.remove("visible"),4200)};
const jLoad=(k,fallback)=>{try{const x=JSON.parse(localStorage.getItem(k)||"null");return x===null?fallback:x}catch{return fallback}};
const persist=()=>{try{localStorage.setItem(key,JSON.stringify({liked:state.liked.slice(0,250).map(x=>({id:x.id,title:x.title,artist:x.artist,source:x.source,artwork:x.artwork||"",stream: ["radio","stream","archive","ccmixter","openverse"].includes(x.source)?safe(x.stream):undefined,permalink:["archive","ccmixter","openverse"].includes(x.source)?safe(x.permalink):undefined,license:["archive","ccmixter","openverse"].includes(x.source)?String(x.license||""):undefined,license_url:["archive","ccmixter","openverse"].includes(x.source)?safe(x.license_url):undefined})),metadata:state.metadata.slice(0,300),streams:state.streams.slice(0,150).map(x=>({id:x.id,title:x.title,artist:x.artist,stream:x.stream,source:"stream"})),mood:state.mood}));return true}catch{send("Локальное хранилище недоступно");return false}};
const saved=jLoad(key,{});state.liked=Array.isArray(saved.liked)?saved.liked.slice(0,250):[];
state.metadata=Array.isArray(saved.metadata)?saved.metadata.slice(0,300):[];
state.streams=Array.isArray(saved.streams)?saved.streams.slice(0,150).filter(x=>x&&x.source==="stream"&&safe(x.stream)&&x.title&&x.artist).map(x=>({
 id:clean(x.id,240),source:"stream",title:clean(x.title,120),artist:clean(x.artist,80),stream:safe(x.stream),artwork:""
})):[];
state.mood=saved.mood==="aurora"?"aurora":"ember";
document.documentElement.dataset.ambient=state.mood;
const unique=list=>{const s=new Set();return list.filter(x=>{if(!x?.id||s.has(x.id))return false;s.add(x.id);return true;})};
function showPage(page){
 if(!["home","search","charts","catalog","archive","mixter","library","radio","import"].includes(page))return;
 if(state.page!==page){
  // Stop provider playback before hiding its page, never run YouTube in background.
  const previous=document.querySelector('[data-view="'+state.page+'"]');
  previous?.querySelectorAll("iframe").forEach(frame=>frame.remove());
  document.dispatchEvent(new CustomEvent("vetogram:page-leave",{detail:{page:state.page}}));
 }
 state.page=page;
 $$(".page").forEach(el=>el.classList.toggle("active",el.dataset.view===page));
 $$("[data-page]").forEach(el=>{el.classList.toggle("active",el.dataset.page===page);if(el.dataset.page===page)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current")});
 $("crumbName").textContent=({home:"MUSIC",search:"ПОИСК",charts:"ЧАРТЫ",catalog:"КАТАЛОГ",archive:"БИБЛИОТЕКА",mixter:"ТРЕКИ",library:"МОЯ МУЗЫКА",radio:"РАДИО",import:"ДОБАВИТЬ"}[page]);
 window.scrollTo({top:0,behavior:"instant"});
 if(page==="library")renderLibrary();
 if(page==="home")renderHome();
 if(page==="radio"&&!state.radios.length)radioSearch("Russia");
 if(page==="search")setTimeout(()=>$("searchInput").focus({preventScroll:true}),60);
 if(page==="charts")document.dispatchEvent(new CustomEvent("vetogram:charts-open"));
 if(page==="catalog")document.dispatchEvent(new CustomEvent("vetogram:catalog-open"));
 if(page==="archive")document.dispatchEvent(new CustomEvent("vetogram:archive-open"));
 if(page==="mixter")document.dispatchEvent(new CustomEvent("vetogram:mixter-open"));
}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
$("quickSearch").onclick=()=>showPage("search");$("heroExplore").onclick=()=>{showPage("catalog");window.VetogramCatalog?.selectPreset?.("ru")};
$("themeSwitch").onclick=()=>{state.mood=state.mood==="ember"?"aurora":"ember";document.documentElement.dataset.ambient=state.mood;persist();send(state.mood==="aurora"?"Атмосфера Aurora":"Атмосфера Ember")};
const songId=x=>String(x?.id||"");
function favorited(t){return state.liked.some(x=>x.id===songId(t))}
function toggleLike(track){if(!track)return;const pos=state.liked.findIndex(x=>x.id===track.id);
 if(pos>=0)state.liked.splice(pos,1);
 else state.liked.unshift({...track,blob:undefined,url:undefined});
 persist();renderLibrary();renderHome();renderSearch();syncPlayer();
}
function row(track,index,context){
 const e=dom("article","track-row"+(state.now?.id===track.id?" active":""));
 const no=dom("span","track-number",String(index+1).padStart(2,"0"));
 const cover=dom("div","track-cover","♫"),url=safe(track.artwork);
 if(url){const img=dom("img");img.src=url;img.alt="";img.loading="lazy";img.addEventListener("error",()=>img.remove());cover.append(img)}
 const main=dom("div","track-info");main.append(dom("b","",track.title||"Без названия"),dom("small","",track.artist||"Неизвестный исполнитель"));
 const tag=dom("span","source-tag",track.source==="local"?"МОЙ ФАЙЛ":track.source==="stream"?"ПО ССЫЛКЕ":track.source==="demo"?"ОРИГИНАЛЬНОЕ ДЕМО":track.source==="radio"?"LIVE RADIO":track.source==="archive"?"ARCHIVE · CC":track.source==="ccmixter"?"CCMIXTER · CC":track.source==="openverse"?"♫ · CC":track.source==="metadata"?"ТОЛЬКО СПИСОК":"AUDIUS");
 const like=dom("button","track-btn like",favorited(track)?"♥":"♡");
 like.type="button";like.title=favorited(track)?"Убрать из избранного":"В избранное";like.setAttribute("aria-label",like.title);
 like.onclick=()=>toggleLike(track);
 const play=dom("button","track-btn play",track.source==="metadata"?"⌕":state.now?.id===track.id&&!audio.paused?"Ⅱ":"▶");
 play.type="button";play.setAttribute("aria-label",track.source==="metadata"?"Найти в Audius":"Воспроизвести");
 play.onclick=()=>{
  if(track.source==="metadata"){showPage("search");$("searchInput").value=track.artist+" "+track.title;runSearch($("searchInput").value);return}
  let pool=context==="search"?state.search:context==="home"?unique([...state.local,...state.tracks]):context==="liked"?state.liked:context==="local"?state.local:context==="streams"?state.streams:[track];
  if(track.source==="local")pool=state.local;
  if(track.source==="stream")pool=state.streams;
  if(track.source==="demo")pool=unique([...demoTracks,...state.tracks]);
  playTrack(track,pool);
 };
 const share=dom("button","track-btn share","↗");share.type="button";share.title="Поделиться в Telegram";
 share.setAttribute("aria-label","Поделиться: "+track.title);
 share.onclick=()=>window.VetogramMusicSocial?.shareTrack?.(track)||send("Обнови страницу для открытия меню поделиться");
 e.append(no,cover,main,tag,like,play,share);
 if(track.source==="local"||track.source==="stream"){
  const actions=dom("div","personal-actions");
  for(const [name,symbol,cb] of [
   ["Выше","↑",()=>track.source==="local"?window.VetogramMusic?.moveLocal(track.id,-1):window.VetogramMusic?.moveStream(track.id,-1)],
   ["Ниже","↓",()=>track.source==="local"?window.VetogramMusic?.moveLocal(track.id,1):window.VetogramMusic?.moveStream(track.id,1)],
   ["Удалить","×",()=>{if(confirm("Удалить «"+track.title+"» из своей библиотеки?")){
     if(track.source==="local")window.VetogramMusic?.removeLocal(track.id).catch(()=>send("Не удалось удалить файл из хранилища"));
     else window.VetogramMusic?.removeStream(track.id);
   }}]]){
   const button=dom("button","personal-action",symbol);button.type="button";button.title=name;
   button.setAttribute("aria-label",name+": "+track.title);button.onclick=cb;actions.append(button);
  }
  e.append(actions);
 }
 return e;
}
function paintRows(target,tracks,context,empty){
 const box=$(target);box.replaceChildren();
 if(!tracks.length){box.append(dom("div","empty-state",empty));return}
 tracks.slice(0,context==="home"?8:80).forEach((t,i)=>box.append(row(t,i,context)));
}
const ART_COLORS=[[238,132,166],[153,143,235],[105,186,205],[237,161,118],[176,132,222]];
function palette(t){let sum=0;for(const c of String(t?.title||t?.id||"Vetogram"))sum=(sum*31+c.charCodeAt(0))>>>0;
 const c=ART_COLORS[sum%ART_COLORS.length];app.style.setProperty("--accent",c.join(","));}
function clearFailedTrack(label="Выбери песню"){
 // Clear metadata as well as audio bytes; otherwise the shell can show a stale track.
 ++playbackGeneration;
 audio.pause();audio.removeAttribute("src");audio.load();
 state.now=null;state.queue=[];state.index=-1;state.playRequested=false;
 $("miniTitle").textContent=label;$("miniArtist").textContent="";
 $("studioTitle").textContent=label;$("studioArtist").textContent="";
 $("miniArt").replaceChildren();$("miniArt").textContent="♫";
 $("studioCover").replaceChildren();$("studioCover").textContent="V";
 try{if("mediaSession" in navigator){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState="none"}}catch{}
 syncPlayer();
}
function playTrack(track,collection){
 if(!track)return;const generation=++playbackGeneration;
 if(track.source==="telegram"&&!track.url){audio.pause();window.VetogramTelegramLibrary?.play(track,collection,generation);return;}
 const found=state.local.find(x=>x.id===track.id);
 if(track.source==="local"&&found)track=found;
 if(track.source==="metadata"){send("Это название песни, а не аудиозапись");return}
 const src=track.source==="audius"?"https://api.audius.co/v1/tracks/"+encodeURIComponent(track.id.replace(/^audius:/,""))+"/stream":
 track.source==="demo"?getDemoURL(track):["local","telegram"].includes(track.source)?track.url:safe(track.stream);
 if(!src){send("Нет доступной записи для воспроизведения");return}
 state.queue=unique(collection?.length?collection:[track]).filter(x=>x.source!=="metadata");
 state.index=Math.max(0,state.queue.findIndex(x=>x.id===track.id));
 state.now=track;palette(track);
 $("miniTitle").textContent=track.title;$("miniArtist").textContent=track.artist;
 $("studioTitle").textContent=track.title;$("studioArtist").textContent=track.artist;
 const art=safe(track.artwork),mini=$("miniArt"),cover=$("studioCover");
 mini.replaceChildren();cover.replaceChildren();
 if(art){for(const el of [mini,cover]){const img=dom("img");img.src=art;img.alt="";img.addEventListener("error",()=>{img.remove();el.textContent="V"});el.append(img)}}
 else {mini.textContent="♫";cover.textContent="V"}
 if(track.source==="radio")$("studioDuration").textContent="LIVE";
 audio.pause();audio.removeAttribute("src");
 // The stream is always a real provider URL or an in-memory, user-owned Blob URL.
 audio.src=src;audio.load();audio.play().catch(err=>{
  if(generation!==playbackGeneration)return; // Ignore rejections for a superseded song.
  state.playRequested=false;
  if(err?.name==="NotAllowedError"){
   send("Для включения звука нажми Play в нижнем плеере.");
   syncPlayer();return;
  }
  clearFailedTrack();
  send("Поток недоступен или формат не поддерживается. Выбери другой источник.");
 });
 state.playRequested=true;
 try{if("mediaSession"in navigator&&typeof MediaMetadata!=="undefined"){navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:"Vetogram Music",artwork:art?[{src:art,sizes:"512x512"}]:[]})}}catch{}
 syncPlayer();renderHome();renderSearch();renderLibrary();
}
function next(delta,ended=false){
 const q=state.queue;if(!q.length)return;
 if(ended&&state.repeat==="one")return playTrack(q[state.index],q);
 if(ended&&state.repeat==="off"&&state.index===q.length-1){audio.pause();return}
 let i=state.index;
 if(state.shuffle&&delta>0&&q.length>1){let v=Math.floor(Math.random()*(q.length-1));i=v>=i?v+1:v}else i=(i+delta+q.length)%q.length;
 playTrack(q[i],q);
}
function toggleAudio(){if(!audio.src){if(state.local.length)playTrack(state.local[0],state.local);else playTrack(demoTracks[0],demoTracks);return}
 if(audio.paused)audio.play().catch(()=>send("Не удалось возобновить воспроизведение"));else audio.pause();
}
$("miniPlay").onclick=toggleAudio;$("studioPlay").onclick=toggleAudio;
$("miniPrev").onclick=() => next(-1);$("miniNext").onclick=()=>next(1);
$("prevButton").onclick=()=>next(-1);$("nextButton").onclick=()=>next(1);
$("shuffleButton").onclick=()=>{state.shuffle=!state.shuffle;syncPlayer();send(state.shuffle?"Случайный порядок включён":"Случайный порядок выключен")};
$("repeatButton").onclick=()=>{state.repeat=state.repeat==="all"?"one":state.repeat==="one"?"off":"all";syncPlayer();send("Повтор: "+({all:"все",one:"один",off:"выкл."})[state.repeat])};
$("miniLike").onclick=()=>toggleLike(state.now);$("studioLike").onclick=()=>toggleLike(state.now);
function scrub(value){const d=audio.duration;if(Number.isFinite(d)&&d>0)audio.currentTime=Math.min(d,Math.max(0,Number(value)/1000*d))}
$("miniSeek").oninput=e=>scrub(e.target.value);$("studioSeek").oninput=e=>scrub(e.target.value);
$("volumeInput").oninput=e=>{audio.volume=Number(e.target.value)/100};
$("speedSelect").onchange=e=>{audio.playbackRate=Number(e.target.value)};
$("sleepSelect").onchange=e=>{if(state.sleepTimer)clearInterval(state.sleepTimer);const n=Number(e.target.value);
 state.sleepDeadline=n?Date.now()+n*60000:0;state.sleepTimer=n?setInterval(()=>{if(Date.now()>=state.sleepDeadline){audio.pause();clearInterval(state.sleepTimer);state.sleepTimer=null;$("sleepSelect").value="0";send("Таймер сна остановил музыку")}},1000):null};
function syncPlayer(){
 const isPlaying=!audio.paused&&!audio.ended&&!!audio.src;
 app.dataset.playing=String(isPlaying);
 // Native <audio> exposes play/pause and next/previous controls when WebView
 // supports Media Session. This does NOT keep a closed Telegram Mini App alive.
 try{
  if("mediaSession"in navigator){
   navigator.mediaSession.playbackState=isPlaying?"playing":audio.paused?"paused":"none";
   if(typeof navigator.mediaSession.setPositionState==="function"&&Number.isFinite(audio.duration)&&audio.duration>0){
    navigator.mediaSession.setPositionState({
     duration:audio.duration,
     playbackRate:Number.isFinite(audio.playbackRate)&&audio.playbackRate>0?audio.playbackRate:1,
     position:Math.max(0,Math.min(audio.duration,Number(audio.currentTime)||0))
    });
   }
  }
 }catch{}
 for(const id of ["miniPlay","studioPlay"])$(id).textContent=isPlaying?"Ⅱ":"▶";
 const liked=favorited(state.now);$("miniLike").textContent=liked?"♥":"♡";$("studioLike").textContent=(liked?"♥":"♡")+(liked?" В избранном":" В избранное");
 $("shuffleButton").setAttribute("aria-pressed",String(state.shuffle));
 $("repeatButton").setAttribute("aria-pressed",String(state.repeat!=="off"));
 $("repeatButton").textContent=state.repeat==="one"?"↻₁":state.repeat==="off"?"↻̸":"↻";
 const live=state.now?.source==="radio",d=audio.duration,v=Number.isFinite(d)&&d>0?Math.floor(audio.currentTime/d*1000):0;
 $("studioTime").textContent=format(audio.currentTime);$("miniTime").textContent=live?"LIVE":format(audio.currentTime);
 $("studioDuration").textContent=live?"LIVE":format(d);
 for(const id of ["miniSeek","studioSeek"]){$(id).disabled=live||!Number.isFinite(d)||d<=0;$(id).value=String(v);}
}
for(const event of ["play","pause","ended","durationchange","timeupdate","loadedmetadata","waiting","error"])audio.addEventListener(event,()=>{
 if(event==="ended")next(1,true);
 if(event==="error"&&audio.error&&audio.src){
  clearFailedTrack();
  send("Источник не отдаёт воспроизводимый поток.");
  document.dispatchEvent(new CustomEvent("vetogram:audio-error"));
 }
 syncPlayer();
});
audio.volume=.85;
try{if("mediaSession"in navigator){for(const [key,fn] of Object.entries({
 play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),
 previoustrack:()=>next(-1),nexttrack:()=>next(1),
 seekto:x=>{if(Number.isFinite(audio.duration)&&Number.isFinite(x.seekTime))audio.currentTime=Math.min(audio.duration,x.seekTime)},
 seekbackward:()=>{audio.currentTime=Math.max(0,audio.currentTime-10)},
 seekforward:()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+10)}
 })){try{navigator.mediaSession.setActionHandler(key,fn)}catch{}}}}catch{}
function openStudio(){
 $("studio").classList.add("open");$("studio").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
 try{if(window.Telegram?.WebApp?.initData)window.Telegram.WebApp.BackButton?.show()}catch{}
 setTimeout(()=>$("closeStudio").focus(),50);
}
function closeStudio(){
 $("studio").classList.remove("open");$("studio").setAttribute("aria-hidden","true");document.body.style.overflow="";
 try{window.Telegram?.WebApp?.BackButton?.hide()}catch{}
}
$("openPlayer").onclick=openStudio;$("miniArt").onclick=openStudio;$("miniTrack").onclick=openStudio;$("closeStudio").onclick=closeStudio;
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("helpModal").classList.contains("open"))closeHelp();else if($("studio").classList.contains("open"))closeStudio()}else if(e.code==="Space"&&!["INPUT","TEXTAREA","BUTTON","SELECT"].includes(document.activeElement.tagName)){e.preventDefault();toggleAudio()}});
$("shareTrack").onclick=async()=>{const t=state.now;if(!t)return send("Сначала выбери трек");
 const url=t.source==="audius"?(safe(t.permalink)||"https://audius.co/"):t.source==="radio"?safe(t.homepage):location.href;
 try{if(navigator.share)await navigator.share({title:t.title,text:t.artist+" — "+t.title,url});else if(navigator.clipboard){await navigator.clipboard.writeText(t.artist+" — "+t.title+"\n"+url);send("Ссылка скопирована")}}catch{}};
function closeHelp(){$("helpModal").classList.remove("open");$("helpModal").setAttribute("aria-hidden","true")}
$("telegramInfo").onclick=()=>{$("helpModal").classList.add("open");$("helpModal").setAttribute("aria-hidden","false")};
$("closeHelp").onclick=closeHelp;$("helpToUpload").onclick=()=>{closeHelp();$("fileInput").click()};
$("helpModal").addEventListener("click",e=>{if(e.target===$("helpModal"))closeHelp()});
const telegram=window.Telegram?.WebApp;
if(telegram?.initData){try{telegram.ready();telegram.expand();telegram.setHeaderColor("#080911");telegram.setBackgroundColor("#080911");
 const insets=telegram.contentSafeAreaInset||telegram.safeAreaInset||{};
 document.documentElement.style.setProperty("--tg-top",Math.min(90,Math.max(0,Number(insets.top)||0))+"px");
 document.documentElement.style.setProperty("--tg-bottom",Math.min(90,Math.max(0,Number(insets.bottom)||0))+"px");
 telegram.BackButton?.onClick(()=>{if($("studio").classList.contains("open"))closeStudio();else if(state.page!=="home")showPage("home")});
 }catch{}}
function mapAudius(x){
 if(!x?.id||!x.title||x.is_stream_gated||x.is_delete||x.is_unlisted)return null;
 let art=x.artwork?.["480x480"]||x.artwork?.["150x150"]||"";
 return {id:"audius:"+clean(x.id,120),title:clean(x.title),artist:clean(x.user?.name||x.user?.handle||"Audius",85),artwork:safe(art),permalink:safe(x.permalink),source:"audius",duration:Number(x.duration)||0};
}
async function apiJson(url,signal,limit=1500000){
 const response=await fetch(url,{signal,credentials:"omit",headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("HTTP "+response.status);
 const text=await response.text();if(text.length>limit)throw Error("Слишком большой ответ");
 return JSON.parse(text);
}
function newAbort(name){if(state[name])state[name].abort();const c=new AbortController();state[name]=c;return c}
async function loadTrending(){
 const abort=newAbort("activeController"),timer=setTimeout(()=>abort.abort(),11000);
 try{const r=await apiJson("https://api.audius.co/v1/tracks/trending?limit=12",abort.signal);
 if(state.activeController!==abort)return;
 state.tracks=unique((Array.isArray(r?.data)?r.data:[]).map(mapAudius).filter(Boolean));renderHome();
 }catch{if(state.activeController===abort){$("homeTracks").replaceChildren(dom("div","empty-state","Музыка сейчас не отвечает. Попробуй поиск или свои файлы."));}}
 finally{clearTimeout(timer)}
}
function renderHome(){paintRows("homeTracks",unique([...state.local,...state.tracks]),"home","Музыка пока не загрузилась. Попробуй поиск или добавь свою запись.")}
function renderSearch(){paintRows("searchResults",unique([...state.search,...state.local.filter(t=>{const q=($("searchInput").value||"").toLowerCase();return q&&(t.title+" "+t.artist).toLowerCase().includes(q)})]),"search","Нет результатов. Попробуй другое название.")}
async function runSearch(raw){
 const query=clean(raw,80).trim();if(query.length<2){$("searchStatus").textContent="Введи минимум два символа";return}
 document.dispatchEvent(new CustomEvent("vetogram:search-query",{detail:{query}}));
 const abort=newAbort("activeController"),timer=setTimeout(()=>abort.abort(),11500);
 $("searchStatus").textContent="Ищем «"+query+"» в Audius…";
 try{const data=await apiJson("https://api.audius.co/v1/tracks/search?query="+encodeURIComponent(query)+"&limit=25",abort.signal);
 if(state.activeController!==abort)return;
 state.search=unique((Array.isArray(data?.data)?data.data:[]).map(mapAudius).filter(Boolean));
 renderSearch();$("searchStatus").textContent=state.search.length+" доступных записей Audius. Записи могут отличаться от оригиналов и зависеть от региона.";
 }catch(err){if(state.activeController===abort){state.search=[];renderSearch();$("searchStatus").textContent=err?.name==="AbortError"?"Поиск истёк по времени.":"Audius сейчас недоступен. Можешь искать свои файлы или слушать радио.";}}
 finally{clearTimeout(timer)}
}
$("searchForm").onsubmit=e=>{e.preventDefault();runSearch($("searchInput").value)};
$$("[data-query]").forEach(b=>b.onclick=()=>{showPage("search");$("searchInput").value=b.dataset.query;runSearch(b.dataset.query)});
$$("[data-mood]").forEach(b=>b.onclick=()=>{showPage("search");$("searchInput").value=moods[b.dataset.mood];runSearch(moods[b.dataset.mood])});
function mapRadio(x){
 const stream=safe(x?.url_resolved||x?.url);
 if(!stream||!x?.name||!x?.stationuuid||!x?.lastcheckok||x?.hls||/\.m3u8(?:\?|$)/i.test(stream))return null;
 return {id:"radio:"+clean(x.stationuuid,100),source:"radio",title:clean(x.name),artist:clean(x.country||x.tags||"Live Radio",80),
  artwork:safe(x.favicon),stream,homepage:safe(x.homepage)||"https://www.radio-browser.info/"};
}
const mirrors=["https://de1.api.radio-browser.info","https://nl1.api.radio-browser.info","https://at1.api.radio-browser.info"];
async function radioSearch(query,autoPlay=false){
 const term=clean(query,70);if(term.length<2)return;
 const ctrl=newAbort("radioController"),timer=setTimeout(()=>ctrl.abort(),13000);
 $("radioStatus").textContent="Ищем станции «"+term+"»…";
 try{let rows=null;
 for(const host of mirrors){try{rows=await apiJson(host+"/json/stations/search?"+new URLSearchParams({...(/^(?:russia|россия|russian|русская музыка)$/i.test(term)?{countrycode:"RU"}:/^(?:armenia|армения|հայկական)$/i.test(term)?{countrycode:"AM"}:{name:term}),limit:"32",is_https:"true",hidebroken:"true",order:"votes",reverse:"true"}),ctrl.signal);if(Array.isArray(rows))break;}catch(e){if(ctrl.signal.aborted)throw e}}
 if(state.radioController!==ctrl)return;
 state.radios=unique((Array.isArray(rows)?rows:[]).map(mapRadio).filter(Boolean));renderRadio();
 if(autoPlay&&state.radios.length)playTrack(state.radios[0],state.radios);
 $("radioStatus").textContent="Найдено "+state.radios.length+" станций. Доступность потоков зависит от вещателей.";
 }catch(e){if(state.radioController===ctrl)$("radioStatus").textContent=e?.name==="AbortError"?"Поиск радио превысил время ожидания.":"Радиокаталог временно недоступен."}
 finally{clearTimeout(timer)}
}
function renderRadio(){
 const box=$("radioResults");box.replaceChildren();
 if(!state.radios.length){box.append(dom("div","empty-state","По этому запросу станций нет."));return}
 state.radios.forEach(t=>{
 const row=dom("div","radio-card");const cover=dom("div","track-cover","◉");
 if(t.artwork){const img=dom("img");img.src=t.artwork;img.alt="";img.onerror=()=>img.remove();cover.append(img)}
 const details=dom("div");details.append(dom("b","",t.title),dom("small","",t.artist));
 const actions=dom("div");
 const p=dom("button","radio-action","▶ Слушать");p.type="button";p.onclick=()=>playTrack(t,state.radios);
 actions.append(p);details.append(actions);row.append(cover,details);box.append(row);
 });
}
$("radioForm").onsubmit=e=>{e.preventDefault();radioSearch($("radioInput").value)};
$$("[data-radio]").forEach(b=>b.onclick=()=>{$("radioInput").value=b.dataset.radio;radioSearch(b.dataset.radio)});
// Direct radio streams verified with current Radio Browser checks (RU, HTTPS, lastcheckok=1).
// Broadcasters operate and license their own live programming. These are NOT on-demand tracks.
const RUSSIAN_RADIO=Object.freeze([
 {key:"rusradio",title:"Русское Радио",stream:"https://rusradio.hostingradio.ru/rusradio96.aacp"},
 {key:"russianmix",title:"Radio Record Russian Mix",stream:"https://radiorecord.hostingradio.ru/rus96.aacp"},
 {key:"dfm",title:"DFM Russian Dance",stream:"https://dfm-dfmrusdance.hostingradio.ru/dfmrusdance96.aacp"},
 {key:"maximum",title:"Радио Maximum",stream:"https://maximum.hostingradio.ru/maximum128.mp3"}
]);
document.querySelectorAll("[data-audio-station]").forEach(button=>button.addEventListener("click",()=>{
 const target=RUSSIAN_RADIO.find(x=>x.key===button.dataset.audioStation);
 if(!target)return;
 const item={id:"radio:"+target.key,source:"radio",title:target.title,artist:"Музыка · прямой эфир",artwork:"",stream:target.stream};
 playTrack(item,[item]);
}));
document.querySelectorAll("[data-audio-radio]").forEach(b=>b.addEventListener("click",()=>{
 showPage("radio");$("radioInput").value=b.dataset.audioRadio;radioSearch(b.dataset.audioRadio,true);
}));
document.querySelectorAll("[data-audio-preset]").forEach(b=>b.addEventListener("click",()=>{
 showPage("catalog");window.VetogramCatalog?.selectPreset?.(b.dataset.audioPreset);
}));
function openDb(){return new Promise((resolve,reject)=>{if(!("indexedDB"in window))return resolve(null);
 const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"})};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error("IndexedDB blocked"))})}
function saveDb(record){if(!state.db)return Promise.reject(Error("No IndexedDB"));
 return new Promise((resolve,reject)=>{const tx=state.db.transaction(STORE,"readwrite");
 tx.objectStore(STORE).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
async function loadDb(){
 try{state.db=await openDb();if(!state.db)return;
 const data=await new Promise((resolve,reject)=>{const req=state.db.transaction(STORE,"readonly").objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 const order=jLoad("vetogram-music-local-order-v1:"+scope,[]);
 data.sort((a,b)=>{const ai=Array.isArray(order)?order.indexOf(a.id):-1,bi=Array.isArray(order)?order.indexOf(b.id):-1;return (ai<0?9999:ai)-(bi<0?9999:bi)});
 for(const x of data.slice(0,200)){if(!x?.blob||!x.title)continue;
 const url=URL.createObjectURL(x.blob);state.localUrls.push(url);
 state.local.push({id:x.id,title:x.title,artist:x.artist||"Мой файл",source:"local",url,blob:x.blob,artwork:""})}
 renderLibrary();renderHome();
 }catch{send("Хранилище файлов недоступно. Можно слушать файлы до закрытия страницы.")}}
function renderLibrary(){
 $("statLikes").textContent=state.liked.length;$("statLocal").textContent=state.local.length;$("statMeta").textContent=state.metadata.length;
 paintRows("localTracks",state.local,"local","Ты ещё не добавил аудиофайлы. Начни с «Добавить музыку».");
 paintRows("streamTracks",state.streams,"streams","Здесь появятся аудиозаписи, добавленные по прямым HTTPS-ссылкам.");
 // A favorite is only playable when its corresponding real audio still exists or when an official source can serve it.
 const liked=state.liked.map(t=>t.source==="local"?(state.local.find(x=>x.id===t.id)||{...t,source:"metadata"}):t);
 paintRows("likedTracks",liked,"liked","Здесь появятся треки, которые тебе понравятся.");
 paintRows("metaTracks",state.metadata.map(x=>({...x,source:"metadata"})),"metadata","Здесь появятся названия импортированных песен.");
}
function notifyLibrary(){document.dispatchEvent(new CustomEvent("vetogram:library-change"))}
function saveLocalOrder(){
 try{localStorage.setItem("vetogram-music-local-order-v1:"+scope,JSON.stringify(state.local.map(x=>x.id)))}catch{}
}
async function removeLocal(id){
 const at=state.local.findIndex(x=>x.id===id);
 if(at<0)return false;
 const current=state.local[at];
 if(state.now?.id===id){
  audio.pause();audio.removeAttribute("src");audio.load();
  state.now=null;state.queue=[];state.index=-1;
  $("miniTitle").textContent="Выбери музыку";$("miniArtist").textContent="Vetogram Music";
  $("studioTitle").textContent="Выбери свою волну";$("studioArtist").textContent="VETOGRAM MUSIC";
 }
 if(state.db)await new Promise((resolve,reject)=>{
  const tx=state.db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
 state.local.splice(at,1);state.queue=state.queue.filter(x=>x.id!==id);
 state.index=state.queue.findIndex(x=>x.id===state.now?.id);
 state.liked=state.liked.filter(x=>x.id!==id);
 state.localUrls=state.localUrls.filter(url=>url!==current.url);
 URL.revokeObjectURL(current.url);saveLocalOrder();persist();renderLibrary();renderHome();syncPlayer();notifyLibrary();
 return true;
}
function moveLocal(id,delta){
 const at=state.local.findIndex(x=>x.id===id),to=at+delta;
 if(at<0||to<0||to>=state.local.length)return false;
 const item=state.local.splice(at,1)[0];state.local.splice(to,0,item);
 saveLocalOrder();renderLibrary();renderHome();notifyLibrary();return true;
}
function addStreams(items){
 const added=[],seen=new Set(state.streams.map(x=>x.stream));
 for(const entry of items||[]){
  if(state.streams.length+added.length>=150)break;
  const src=safe(entry.stream);
  if(!src||src.length>1200||seen.has(src))continue;
  const title=clean(entry.title,120),artist=clean(entry.artist||"Моя коллекция",80);
  if(!title)continue;
  const id="stream:"+src.slice(0,225);
  added.push({id,title,artist,stream:src,source:"stream",artwork:""});
  seen.add(src);
 }
 if(!added.length)return 0;
 const previous=state.streams.slice();state.streams=unique([...added,...previous]);
 if(!persist()){state.streams=previous;return 0;}
 renderLibrary();renderHome();notifyLibrary();
 return added.length;
}
function moveStream(id,delta){
 const pos=state.streams.findIndex(x=>x.id===id),next=pos+delta;
 if(pos<0||next<0||next>=state.streams.length)return false;
 const prior=state.streams.slice(),item=state.streams.splice(pos,1)[0];
 state.streams.splice(next,0,item);
 if(!persist()){state.streams=prior;return false;}
 renderLibrary();notifyLibrary();return true;
}
function removeStream(id){
 const previous=state.streams.slice(),item=state.streams.find(x=>x.id===id);
 if(!item)return false;
 if(state.now?.id===id){
  audio.pause();audio.removeAttribute("src");audio.load();state.now=null;state.queue=[];state.index=-1;
  $("miniTitle").textContent="Выбери музыку";$("miniArtist").textContent="Vetogram Music";
  $("studioTitle").textContent="Выбери свою волну";$("studioArtist").textContent="VETOGRAM MUSIC";
 }
 state.streams=state.streams.filter(x=>x.id!==id);
 state.queue=state.queue.filter(x=>x.id!==id);
 state.liked=state.liked.filter(x=>x.id!==id);
 if(!persist()){state.streams=previous;return false}
 renderLibrary();syncPlayer();notifyLibrary();
 return true;
}
function deriveName(name){
 const title=clean(String(name).replace(/\.[^.]+$/,""),120);
 const match=title.match(/^(.{2,80}?)\s+[-–—]\s+(.{2,110})$/);
 return match?{artist:clean(match[1],80),title:clean(match[2],110)}:{artist:"Моя музыка",title};
}
async function addLocalFiles(files){
 const incoming=Array.from(files||[]).slice(0,20);let total=0,count=0,failed=0;
 for(const f of incoming){
 total+=f.size;if(total>MAX_BATCH||f.size>MAX_FILE||f.size<=0||!(f.type.startsWith("audio/")||/\.(mp3|m4a|wav|ogg|opus|flac|aac)$/i.test(f.name))){failed++;continue}
 const name=deriveName(f.name);const id="local:"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9);
 const url=URL.createObjectURL(f);state.localUrls.push(url);
 const t={id,title:name.title,artist:name.artist,source:"local",url,blob:f,artwork:""};
 state.local.unshift(t);count++;
 // Store files only within the browser's own IndexedDB; never send to a server.
 try{await saveDb({id,title:t.title,artist:t.artist,blob:f})}catch{failed++}
 }
 $("fileInput").value="";saveLocalOrder();renderLibrary();renderHome();notifyLibrary();
 send("Добавлено: "+count+" аудиофайлов."+(failed?" Некоторые файлы или их сохранение отклонены.":""));
 if(count&&state.page!=="library")showPage("library");
}
$("fileInput").onchange=e=>addLocalFiles(e.target.files);
function metaItem(artist,title){
 const a=clean(artist,90),t=clean(title,135);if(!a||!t)return null;
 return {id:"meta:"+a.toLowerCase().normalize("NFKC")+"|"+t.toLowerCase().normalize("NFKC"),artist:a,title:t,source:"metadata"};
}
function parseCsv(text){
 const rows=[];let cell="",row=[],quotes=false;
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(ch==='"'){if(quotes&&text[i+1]==='"'){cell+='"';i++}else quotes=!quotes}
  else if(!quotes&&(ch===","||ch===";"||ch==="\n"||ch==="\r")){
   if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";
   if(ch!==","&&ch!==";"){if(row.some(x=>x.trim()))rows.push(row);row=[]} else if(ch!==row.__delim&&row.__delim)cell+=ch;
   else row.__delim=ch;
  }else cell+=ch;
 }
 if(quotes)throw Error("Незакрытые кавычки CSV");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
function parseList(text,name=""){
 const raw=String(text||"").trim();if(!raw||raw.length>524288)throw Error("Пустой или слишком большой список (максимум 512 КБ)");
 let result=[];
 if(name.endsWith(".json")||raw.startsWith("[")||raw.startsWith("{")){
  const data=JSON.parse(raw),rows=Array.isArray(data)?data:(data.tracks||data.items||[]);
  if(!Array.isArray(rows))throw Error("Ожидается массив tracks");
  result=rows.map(x=>metaItem(typeof x.artist==="string"?x.artist:x.artist?.name||x.artist_name||x.performer,x.title||x.name||x.track)).filter(Boolean);
 }else if(name.endsWith(".csv")){
  const lines=raw.split(/\r?\n/),sep=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?";":",";
  const rows=parseCsv(raw),first=(rows[0]||[]).map(x=>x.toLowerCase().trim());
  const ai=first.findIndex(x=>/artist|исполнитель|performer/.test(x)),ti=first.findIndex(x=>/title|название|track|песня/.test(x));
  result=rows.slice(ai>=0&&ti>=0?1:0).map(x=>metaItem(x[ai>=0?ai:0],x[ti>=0?ti:1])).filter(Boolean);
 }else{
  result=raw.split(/\r?\n/).map(line=>{
  const x=line.trim().replace(/^\d+[.)]\s*/,"");
  const m=x.match(/^(.{2,90}?)\s+[—–-]\s+(.{1,135})$/);
  return m?metaItem(m[1],m[2]):null;
  }).filter(Boolean)
 }
 if(!result.length)throw Error("Не найдено песен. Пример: Кино — Группа крови");
 return unique(result).slice(0,300);
}
function importList(text,name){
 try{const rows=parseList(text,name),before=state.metadata.length;
 state.metadata=unique([...rows,...state.metadata]).slice(0,300);persist();renderLibrary();notifyLibrary();
 $("importStatus").textContent="Добавлено "+(state.metadata.length-before)+" новых записей. Это список названий, а не загруженные аудиофайлы.";
 }catch(e){$("importStatus").textContent="Ошибка: "+clean(e.message,180)}
}
$("importTextButton").onclick=()=>importList($("playlistText").value,"text");
$("playlistInput").onchange=async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;
 if(f.size>524288){send("Файл слишком большой");return}
 try{importList(await f.text(),f.name.toLowerCase())}catch{send("Не удалось прочитать файл")}};
$("jumpToMetadata").onclick=()=>$("metadataPanel").scrollIntoView({behavior:"smooth",block:"start"});
$("exportMeta").onclick=()=>{
 const content={format:"vetogram-music-metadata-v1",tracks:state.metadata.map(({artist,title})=>({artist,title}))};
 const u=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:"application/json"}));
 const a=dom("a");a.href=u;a.download="vetogram-playlist.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000)
};
const demoTracks=[
 {id:"demo:afterglow",title:"Afterglow / Original Demo",artist:"Vetogram Studio · синтезированный звук",source:"demo",artwork:"",duration:14},
 {id:"demo:orbit",title:"Orbit / Original Demo",artist:"Vetogram Studio · синтезированный звук",source:"demo",artwork:"",duration:14}
];
let demoUrls=new Map();
function getDemoURL(track){
 if(demoUrls.has(track.id))return demoUrls.get(track.id);
 const sampleRate=16000,seconds=14,samples=sampleRate*seconds,buffer=new ArrayBuffer(44+samples*2),dv=new DataView(buffer);
 const str=(offset,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(offset+i,s.charCodeAt(i))};
 str(0,"RIFF");dv.setUint32(4,36+samples*2,true);str(8,"WAVEfmt ");dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,sampleRate,true);dv.setUint32(28,sampleRate*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);str(36,"data");dv.setUint32(40,samples*2,true);
 const notes=track.id.endsWith("orbit")?[110,146.83,174.61,220]:[130.81,164.81,196,261.63];
 for(let i=0;i<samples;i++){const t=i/sampleRate,beat=Math.floor(t*1.9)%notes.length,f=notes[beat],envelope=Math.min(1,t/0.07,(seconds-t)/0.6);
  const kick=Math.sin(2*Math.PI*53*t*Math.exp(-22*((t*2)%1)))*Math.exp(-15*((t*2)%1))*.11;
  const tone=(Math.sin(2*Math.PI*f*t)+.33*Math.sin(2*Math.PI*f*1.5*t)+.18*Math.sin(2*Math.PI*(f/2)*t))*.16;
  const value=Math.max(-1,Math.min(1,(tone+kick)*Math.max(0,envelope)));
  dv.setInt16(44+i*2,Math.round(value*32767),true);
 }
 const link=URL.createObjectURL(new Blob([buffer],{type:"audio/wav"}));demoUrls.set(track.id,link);return link;
}
function makeWaves(){
 for(const box of [$("studioWave"),...$$(".hero-wave")]){box.replaceChildren();for(let i=0;i<(box.id==="studioWave"?42:13);i++){
  const bar=dom("i");bar.style.setProperty("--height",(12+(i*37%78))+"%");bar.style.setProperty("--speed",(0.45+(i*7%10)*0.1)+"s");bar.style.animationDelay=("-"+(i%9)*.11)+"s";box.append(bar)
 }}
}
makeWaves();renderHome();renderLibrary();loadDb();loadTrending();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&!audio.paused)syncPlayer()});
window.addEventListener("pagehide",()=>{for(const u of state.localUrls)URL.revokeObjectURL(u);for(const u of demoUrls.values())URL.revokeObjectURL(u)});
window.VetogramMusic=Object.freeze({showPage,search:runSearch,play:playTrack,
 generation:()=>playbackGeneration,now:()=>state.now,queue:()=>state.queue.slice(),local:()=>state.local.slice(),liked:()=>state.liked.slice(),metadata:()=>state.metadata.slice(),
 importList,removeLocal,moveLocal,addStreams,removeStream,moveStream,notifyLibrary,streams:()=>state.streams.slice(),toggleLike,
 state:()=>({page:state.page,now:state.now?.title||null,local:state.local.length,liked:state.liked.length,imported:state.metadata.length})});
})();