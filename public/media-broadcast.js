/* VETO MEDIA V14 · live radio and podcast discovery.
   Radio Browser streams are optional external sources; Apple Podcasts is catalog-only.
   No scraping, account authentication, media copying or server proxy. */
(()=>{
"use strict";
const $=id=>document.getElementById(id),audio=$("audio")||$("audioEl"),view=$("musicView")||$("music");
if(!view||!audio)return;
const create=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
const clean=(v,n=140)=>String(v??"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,n);
const safe=v=>{try{const u=new URL(String(v));return u.protocol==="https:"?u.href:""}catch{return""}};
const PROVIDERS={
 radio:{id:"radio",title:"LIVE RADIO",label:"Прямой эфир",hint:"Радиостанции из открытого каталога Radio Browser. Сами радиопотоки принадлежат вещателям и могут быть ограничены по региону.",button:"Найти станции"},
 podcast:{id:"podcast",title:"PODCAST UNIVERSE",label:"Подкасты",hint:"Каталог Apple Podcasts. Поиск и ссылки на оригинал — без копирования эпизодов или обхода подписок.",button:"Найти подкасты"}
};
const mirrors=["https://de1.api.radio-browser.info","https://nl1.api.radio-browser.info","https://at1.api.radio-browser.info"];
let radioItems=[],podcastItems=[],selection="radio",inFlight=null;
const section=create("section","v14-broadcast");section.id="v14Broadcast";
section.innerHTML='<div class="v14-ambient-mark" aria-hidden="true">◉</div>'+
'<div class="v14-heading"><div><span>VETO MEDIA · SIGNAL NETWORK</span><h3>Поймай <em>свою частоту.</em></h3>'+
'<p>Живые радиостанции и подкасты — сразу в музыкальной вселенной. Реальные каталоги, реальные источники и понятная доступность.</p></div>'+
'<div class="v14-live-indicator"><i></i> EXPLORE THE AIRWAVES</div></div>'+
'<div class="v14-selector" role="group" aria-label="Тип источника"><button id="v14RadioTab" type="button" class="active" aria-pressed="true">◉ LIVE RADIO</button>'+
'<button id="v14PodcastTab" type="button" aria-pressed="false">♬ PODCASTS</button></div>'+
'<form id="v14SearchForm" class="v14-search" role="search"><input id="v14SearchInput" maxlength="64" autocomplete="off" aria-label="Поиск радиостанций или подкастов" placeholder="Jazz, Rock, Yerevan, Armenia…">'+
'<button id="v14SearchButton" type="submit">Поиск ↗</button></form>'+
'<div class="v14-picks" role="group" aria-label="Популярные темы">'+
'<button type="button" data-v14-query="Jazz">Jazz</button><button type="button" data-v14-query="Rock">Rock</button>'+
'<button type="button" data-v14-query="Armenia">Armenia</button><button type="button" data-v14-query="Electronic">Electronic</button></div>'+
'<p id="v14Status" class="v14-status" role="status">Выбери тему или введи название — источники не загружаются без твоего запроса.</p>'+
'<div id="v14Results" class="v14-grid"><div class="v14-empty">◌ Эфир ждёт тебя</div></div>'+
'<p class="v14-license">Radio Browser публикует каталог станций, но не владеет самими передачами. Проверяй права и условия вещателя. Apple Podcasts используется только для поиска с переходом в оригинальный сервис.</p>';
view.append(section);
const setStatus=msg=>$("v14Status").textContent=msg;
function setTab(type){
 selection=type;
 for(const [name,id] of [["radio","v14RadioTab"],["podcast","v14PodcastTab"]]){
  const node=$(id);node.classList.toggle("active",type===name);node.setAttribute("aria-pressed",String(type===name));
 }
 $("v14SearchInput").placeholder=type==="radio"?"Jazz, Armenia, Yerevan, Rock…":"Наука, технологии, история, спорт…";
 if(inFlight)inFlight.abort();
 draw();
 setStatus(PROVIDERS[type].hint);
}
$("v14RadioTab").onclick=()=>setTab("radio");
$("v14PodcastTab").onclick=()=>setTab("podcast");
for(const button of section.querySelectorAll("[data-v14-query]"))button.onclick=()=>{
 $("v14SearchInput").value=button.dataset.v14Query;
 $("v14SearchForm").requestSubmit();
};
const textLine=(name,value)=>{const e=create("div","v14-card-meta");e.append(create("strong","",name),create("span","",value));return e};
function artwork(src,emoji){
 const d=create("div","v14-card-image"),img=safe(src);
 if(img){const e=create("img");e.src=img;e.alt="";e.loading="lazy";e.referrerPolicy="no-referrer";
 e.addEventListener("error",()=>e.remove());d.append(e)}
 d.append(create("span","v14-placeholder",emoji));return d;
}
function listCard(item){
 const row=create("article","v14-card");
 row.append(artwork(item.image,item.type==="radio"?"◉":"♬"));
 const info=create("div","v14-card-info");
 const type=create("small","v14-type",item.type==="radio"?"LIVE · RADIO":"APPLE PODCASTS · CATALOG");
 info.append(type,create("h4","",item.title),create("p","",item.subtitle));
 const controls=create("div","v14-card-actions");
 if(item.type==="radio"&&item.stream&&!item.isHls){
  const play=create("button","v14-primary","▶ Слушать эфир");play.type="button";
  play.onclick=()=>playRadio(item);controls.append(play);
 }else if(item.type==="radio"){
  info.append(create("small","v14-disclaimer","Этот формат может не воспроизводиться в Telegram. Открой станцию в её приложении."));
 }
 const open=create("a","v14-source",item.type==="podcast"?"Открыть Apple Podcasts ↗":"Сайт станции ↗");
 open.href=item.href;open.target="_blank";open.rel="noopener noreferrer";controls.append(open);
 info.append(controls);row.append(info);return row;
}
function draw(){
 const target=$("v14Results");target.replaceChildren();
 const data=selection==="radio"?radioItems:podcastItems;
 if(!data.length){target.append(create("div","v14-empty","Найденные источники появятся здесь после поиска."));return}
 for(const x of data.slice(0,12))target.append(listCard(x));
}
const radioMapper=raw=>{
 const url=safe(raw?.url_resolved||raw?.url),website=safe(raw?.homepage)||"https://www.radio-browser.info/";
 const id=clean(raw?.stationuuid,90),title=clean(raw?.name,125),last=Boolean(raw?.lastcheckok);
 if(!id||!title||!last)return null;
 const hls=Boolean(raw?.hls)||/\.m3u8(?:\?|$)/i.test(url);
 const codec=clean(raw?.codec,18);
 return {id,type:"radio",title,subtitle:[clean(raw?.country,45),clean(raw?.tags,65),codec].filter(Boolean).join(" · "),
  image:safe(raw?.favicon),href:website,stream:url,isHls:hls};
};
const podcastMapper=raw=>{
 const id=String(raw?.collectionId||""),title=clean(raw?.collectionName,125);
 if(!/^\d+$/.test(id)||!title)return null;
 const href=safe(raw?.collectionViewUrl||raw?.trackViewUrl);
 if(!href)return null;
 return {id,type:"podcast",title,subtitle:clean(raw.artistName||"Apple Podcasts",120),
  image:safe(raw.artworkUrl600||raw.artworkUrl100),href};
};
async function getJson(endpoint,signal){
 const res=await fetch(endpoint,{signal,headers:{Accept:"application/json"},credentials:"omit"});
 if(!res.ok)throw Error("HTTP "+res.status);return res.json();
}
async function lookupRadio(q,signal){
 let last;
 for(const mirror of mirrors){
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  try{
   const url=mirror+"/json/stations/search?"+new URLSearchParams({name:q,limit:"15",hidebroken:"true",order:"votes",reverse:"true"});
   const json=await getJson(url,signal);
   if(!Array.isArray(json))throw Error("Ошибка формата");
   return json.map(radioMapper).filter(Boolean);
  }catch(err){if(err?.name==="AbortError")throw err;last=err}
 }
 throw last||Error("Нет ответа радио-каталога");
}
async function lookupPodcast(q,signal){
 const u="https://itunes.apple.com/search?"+new URLSearchParams({term:q,media:"podcast",entity:"podcast",limit:"15",country:"us"});
 const json=await getJson(u,signal);
 if(!Array.isArray(json?.results))throw Error("Неизвестный формат Apple Podcasts");
 return json.results.map(podcastMapper).filter(Boolean);
}
async function run(query){
 const q=clean(query,64);if(q.length<2){setStatus("Введите хотя бы два символа.");return}
 if(inFlight)inFlight.abort();
 const controller=new AbortController();inFlight=controller;
 const requested=selection;
 const timer=setTimeout(()=>controller.abort(),12000);
 $("v14SearchButton").disabled=true;setStatus("Ищем «"+q+"» в "+(requested==="radio"?"Radio Browser":"Apple Podcasts")+"…");
 try{
  const result=requested==="radio"?await lookupRadio(q,controller.signal):await lookupPodcast(q,controller.signal);
  if(inFlight!==controller||requested!==selection)return;
  if(requested==="radio")radioItems=result;else podcastItems=result;
  draw();
  setStatus(result.length?"Найдено "+result.length+". Доступность и права воспроизведения зависят от источника.":"Ничего не найдено. Попробуй другой запрос.");
 }catch(err){
  if(inFlight===controller){
   const fallback=selection==="radio"?"https://www.radio-browser.info/":"https://podcasts.apple.com/";
   const label=selection==="radio"?"Radio Browser":"Apple Podcasts";
   setStatus((err?.name==="AbortError"?"Время ожидания истекло. ":"Каталог временно недоступен. ")+"Можно открыть "+label+" напрямую.");
   const target=$("v14Results");target.replaceChildren();
   const a=create("a","v14-source","Открыть "+label+" ↗");a.href=fallback;a.target="_blank";a.rel="noopener noreferrer";
   const box=create("div","v14-empty");box.append(a);target.append(box);
  }
 }finally{
  clearTimeout(timer);
  if(inFlight===controller){inFlight=null;$("v14SearchButton").disabled=false}
 }
}
$("v14SearchForm").onsubmit=e=>{e.preventDefault();run($("v14SearchInput").value)};
function playRadio(item){
 if(!item.stream||!safe(item.stream))return setStatus("У станции нет доступной HTTPS-трансляции.");
 const title=$("playerTitle")||$("song"),artist=$("playerArtist")||$("artist"),cover=$("playerCover");
 if(title)title.textContent=item.title;
 if(artist)artist.textContent="LIVE RADIO · "+(item.subtitle||"В прямом эфире");
 if(cover){const safeImage=safe(item.image);cover.style.backgroundImage=safeImage?'url("'+safeImage.replace(/"/g,"")+'")':"linear-gradient(135deg,#ffa893,#4854a4)"}
 $("player")?.classList.remove("hidden");
 // Do not create a new audio element: the V13 studio shares this player.
 audio.pause();audio.src=item.stream;audio.load();
 audio.play().then(()=>{setStatus("В эфире: "+item.title);})
 .catch(()=>{setStatus("Встроенное воспроизведение недоступно. Открой сайт радиостанции.");});
 try{if("mediaSession" in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:item.title,artist:"VETO LIVE · RADIO"});}catch{}
 // Selection has been counted as a listening attempt; safe failure must not block playback.
 if(/^[a-f0-9-]{30,40}$/i.test(item.id)){
  const mirror=mirrors[0]+"/json/url/"+encodeURIComponent(item.id);
  fetch(mirror,{method:"GET",mode:"no-cors",credentials:"omit",keepalive:true}).catch(()=>{});
 }
}
const link=create("button","v14-home-launch","◉ Настройся на LIVE RADIO и подкасты →");
link.type="button";link.onclick=()=>{
 (document.querySelector('.tab[data-tab="music"]')||document.querySelector('[data-page="music"]'))?.click();
 section.scrollIntoView({behavior:"smooth",block:"start"});
};
($("homeView")||$("home"))?.append(link);
window.VetoMediaBroadcast=Object.freeze({search:run,setTab,radioMapper,podcastMapper});
draw();
})();