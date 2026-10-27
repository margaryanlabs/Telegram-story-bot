/* Vetogram Music / Charts & Regional Discovery.
   No fabricated ranks, fake playable recordings or scraped protected catalogs.
   Ranking only from Audius's own trending API; regional radio from Radio Browser. */
(()=>{
"use strict";
const V=window.VetogramMusic,S=window.VetogramMusicSocial,root=document.querySelector('[data-view="charts"]');
if(!V||!root)return;
const $=id=>document.getElementById(id);
const el=(tag,klass,value)=>{const x=document.createElement(tag);if(klass)x.className=klass;if(value!==undefined)x.textContent=String(value);return x};
const clean=(v,n=130)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,n);
const https=(v)=>{try{const u=new URL(String(v));return u.protocol==="https:"?u.href:""}catch{return""}};
const controllers={charts:null,region:null,stations:null};
const cache=new Map(),TTL=300000,radioHosts=["https://de1.api.radio-browser.info","https://nl1.api.radio-browser.info","https://at1.api.radio-browser.info"];
const data={period:"week",genre:"all",region:"ru",country:"AM",charts:[],regional:[],stations:[],started:false,lastCharts:"",lastRegion:"",lastStations:""};
const model={mapAudius,mapRadio,chartEndpoint,radioEndpoint,searchEndpoint};
function mapAudius(x){
 if(!x?.id||!x?.title||x.is_stream_gated||x.is_delete||x.is_unlisted)return null;
 const id=clean(x.id,105);
 if(!/^[a-zA-Z0-9_-]{1,105}$/.test(id))return null;
 return {id:"audius:"+id,title:clean(x.title,120),artist:clean(x.user?.name||x.user?.handle||"Audius",95),
  artwork:https(x.artwork?.["480x480"]||x.artwork?.["150x150"]||""),permalink:https(x.permalink)||"https://audius.co/",
  source:"audius",genre:clean(x.genre||"",35),duration:Number(x.duration)||0,plays:Number(x.play_count)||0};
}
function mapRadio(x){
 const stream=https(x?.url_resolved||x?.url);
 if(!stream||!x?.stationuuid||!x?.name||!x?.lastcheckok||x?.hls||/\.m3u8(?:\?|$)/i.test(stream))return null;
 const id=clean(x.stationuuid,100);
 return {id:"radio:"+id,title:clean(x.name,115),artist:clean(x.country||x.tags||"Радиостанция",80),
  artwork:https(x.favicon),homepage:https(x.homepage)||"https://www.radio-browser.info/",stream,source:"radio",
  votes:Math.max(0,Number(x.votes)||0),codec:clean(x.codec||"",22)};
}
function chartEndpoint(period,genre){
 if(!["week","month","year","allTime"].includes(period))throw Error("Некорректный период");
 const url=new URL("https://api.audius.co/v1/tracks/trending");
 url.searchParams.set("limit","30");url.searchParams.set("time",period);
 if(genre!=="all")url.searchParams.set("genre",genre);
 return url.href;
}
function searchEndpoint(query){
 const u=new URL("https://api.audius.co/v1/tracks/search");
 u.searchParams.set("query",clean(query,65));u.searchParams.set("limit","18");return u.href;
}
function radioEndpoint(code,host=radioHosts[0]){
 if(!["RU","AM"].includes(code))throw Error("Неизвестная страна");
 return host+"/json/stations/bycountrycodeexact/"+code.toLowerCase()+"?"+
  new URLSearchParams({hidebroken:"true",order:"votes",reverse:"true",limit:"30"});
}
async function json(url,signal){
 const response=await fetch(url,{signal,credentials:"omit",headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("HTTP "+response.status);
 const payload=await response.text();
 if(payload.length>2000000)throw Error("Ответ слишком большой");
 return JSON.parse(payload);
}
function request(kind,ttl=12000){
 controllers[kind]?.abort();
 const controller=new AbortController();
 controllers[kind]=controller;
 const timer=setTimeout(()=>controller.abort(),ttl);
 return {controller,finish:()=>clearTimeout(timer)};
}
function status(id,text){$(id).textContent=text}
function selectButtons(selector,key,current){
 for(const b of root.querySelectorAll(selector)){
  const active=b.dataset[key]===current;
  b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
 }
}
function tileArt(track,type="music"){
 const artwork=el("div","chart-art"),image=https(track.artwork);
 if(image){const img=el("img");img.src=image;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>img.remove();artwork.append(img)}
 artwork.append(el("span","chart-art-fallback",type==="radio"?"◉":"♫"));
 return artwork;
}
function trackRow(track,idx,pool,rank=false){
 const item=el("article","chart-track");
 if(rank)item.append(el("span","chart-rank",String(idx+1).padStart(2,"0")));
 item.append(tileArt(track));
 const body=el("div","chart-track-info");
 body.append(el("b","",track.title),el("small","",track.artist));
 const tags=el("div","chart-tags");
 tags.append(el("span","",track.source==="radio"?"LIVE RADIO":"AUDIUS"));
 if(track.genre)tags.append(el("span","",track.genre));
 body.append(tags);item.append(body);
 const listen=el("button","chart-play","▶");listen.type="button";listen.title="Слушать";
 listen.setAttribute("aria-label","Слушать "+track.title);
 listen.onclick=()=>V.play(track,pool);
 const send=el("button","chart-share","↗");send.type="button";send.title="Поделиться в Telegram";
 send.setAttribute("aria-label","Отправить "+track.title);
 send.onclick=()=>{if(S?.shareTrack)S.shareTrack(track)};
 item.append(listen,send);
 return item;
}
function draw(kind,tracks,empty,rank=false){
 const target=$(kind);target.replaceChildren();
 if(!tracks.length){target.append(el("div","chart-empty",empty));return}
 tracks.forEach((track,index)=>target.append(trackRow(track,index,tracks,rank)));
}
function radioCard(item,pool){
 const card=el("article","chart-radio-card");card.append(tileArt(item,"radio"));
 const info=el("div","chart-radio-main");
 info.append(el("strong","",item.title),el("small","",item.artist+(item.codec?" · "+item.codec:"")));
 const meta=el("div","chart-radio-actions");
 const play=el("button","chart-radio-play","▶ В эфир");play.type="button";play.onclick=()=>V.play(item,pool);
 const link=el("a","chart-radio-source","Источник ↗");link.href=item.homepage;link.target="_blank";link.rel="noopener noreferrer";
 meta.append(play,link);
 info.append(meta);card.append(info);
 return card;
}
function renderStations(){
 const target=$("regionStations");target.replaceChildren();
 if(!data.stations.length){target.append(el("div","chart-empty","В этом ответе нет поддерживаемых HTTPS-радиостанций. Попробуй обновить."));return}
 for(const x of data.stations)target.append(radioCard(x,data.stations));
}
async function loadCharts(force=false){
 const key=data.period+"|"+data.genre,lookup="chart:"+key,old=cache.get(lookup);
 if(!force&&old&&Date.now()-old.when<TTL){data.charts=old.items;data.lastCharts=key;draw("chartsTracks",old.items,"Записей нет",true);status("chartsStatus","Audius · "+old.items.length+" треков · из недавнего ответа API");return}
 const {controller,finish}=request("charts");
 status("chartsStatus","Загружаем рейтинг Audius…");
 draw("chartsTracks",[],"Чарт загружается…");
 try{
  const result=await json(chartEndpoint(data.period,data.genre),controller.signal);
  if(controllers.charts!==controller)return;
  const rows=(Array.isArray(result?.data)?result.data:[]).map(mapAudius).filter(Boolean);
  data.charts=rows;data.lastCharts=key;cache.set(lookup,{items:rows,when:Date.now()});
  draw("chartsTracks",rows,"Audius не вернул доступных треков для этого периода и жанра.",true);
  status("chartsStatus","Audius Trending · "+rows.length+" треков · "+(new Date()).toLocaleString("ru-RU",{hour:"2-digit",minute:"2-digit"})+" · рейтинг только Audius");
 }catch(e){if(controllers.charts===controller){
  status("chartsStatus",e?.name==="AbortError"?"Не удалось дождаться ответа Audius.":"Сейчас Audius не отвечает. Попробуй снова.");
  draw("chartsTracks",[],"Нет подтверждённых данных: рейтинг не подставляем.");
 }}finally{finish();}
}
const seed={ru:["Russian music","русская музыка"],am:["Armenian music","Հայկական"]};
async function loadRegion(query=""){
 const area=data.region,explicit=clean(query,65),key=area+":"+explicit,lookup="region:"+key,old=cache.get(lookup);
 if(old&&Date.now()-old.when<TTL){data.regional=old.items;draw("regionTracks",old.items,"Ничего не найдено");status("regionStatus","Найдено "+old.items.length+" записей Audius · результаты поиска, не национальный чарт");return}
 const {controller,finish}=request("region");
 status("regionStatus","Ищем "+(area==="ru"?"русскую":"армянскую")+" музыку в Audius…");
 draw("regionTracks",[],"Поиск выполняется…");
 const queries=explicit?[explicit]:seed[area];
 try{
  const outputs=await Promise.allSettled(queries.map(q=>json(searchEndpoint(q),controller.signal)));
  if(controllers.region!==controller||area!==data.region)return;
  const tracks=[],ids=new Set();
  for(const out of outputs){
   if(out.status!=="fulfilled")continue;
   for(const raw of Array.isArray(out.value?.data)?out.value.data:[]){
    const item=mapAudius(raw);
    if(!item||ids.has(item.id))continue;
    ids.add(item.id);tracks.push(item);
   }
  }
  data.regional=tracks.slice(0,30);cache.set(lookup,{items:data.regional,when:Date.now()});
  draw("regionTracks",data.regional,"Не удалось найти доступных аудиозаписей. Попробуй исполнителя или другую фразу.");
  status("regionStatus","Audius · "+data.regional.length+" результатов запроса. Происхождение и оригинальность записи проверяй у автора.");
 }catch(e){if(controllers.region===controller){
  status("regionStatus",e?.name==="AbortError"?"Поиск превысил время ожидания.":"Audius временно недоступен");
  draw("regionTracks",[],"Попробуй снова.");
 }}finally{finish()}
}
async function loadStations(force=false){
 const country=data.country,lookup="stations:"+country,old=cache.get(lookup);
 if(!force&&old&&Date.now()-old.when<TTL){
  data.stations=old.items;renderStations();status("stationStatus",country+" · "+old.items.length+" станций · каталог Radio Browser");return;
 }
 const {controller,finish}=request("stations",14000);
 status("stationStatus","Загружаем живые станции "+(country==="RU"?"России":"Армении")+"…");
 $("regionStations").replaceChildren(el("div","chart-empty","Ищем станции…"));
 try{
  let payload=null,success=false;
  for(const host of radioHosts){
   if(controller.signal.aborted)break;
   try{payload=await json(radioEndpoint(country,host),controller.signal);if(!Array.isArray(payload))throw Error("Неверный ответ");success=true;break;}catch(e){if(controller.signal.aborted)throw e}
  }
  if(controllers.stations!==controller||country!==data.country)return;
  if(!success)throw Error("Каталог недоступен");
  const seen=new Set();
  data.stations=payload.map(mapRadio).filter(x=>{
    if(!x||seen.has(x.id))return false;seen.add(x.id);return true
  }).slice(0,20);
  cache.set(lookup,{items:data.stations,when:Date.now()});renderStations();
  status("stationStatus",(country==="RU"?"Россия":"Армения")+" · "+data.stations.length+" станций · порядок по голосам Radio Browser (не чарт песен)");
 }catch(e){if(controllers.stations===controller){
  status("stationStatus",e?.name==="AbortError"?"Радиокаталог превысил время ожидания.":"Станции сейчас недоступны.");
  $("regionStations").replaceChildren(el("div","chart-empty","Ошибка источника — попробуй обновить."));
 }}finally{finish()}
}
root.querySelectorAll("[data-chart-period]").forEach(b=>b.addEventListener("click",()=>{
 data.period=b.dataset.chartPeriod;selectButtons("[data-chart-period]","chartPeriod",data.period);loadCharts();
}));
root.querySelectorAll("[data-chart-genre]").forEach(b=>b.addEventListener("click",()=>{
 data.genre=b.dataset.chartGenre;selectButtons("[data-chart-genre]","chartGenre",data.genre);loadCharts();
}));
$("chartsRefresh").onclick=()=>loadCharts(true);
root.querySelectorAll("[data-region]").forEach(b=>b.addEventListener("click",()=>{
 data.region=b.dataset.region;selectButtons("[data-region]","region",data.region);
 $("regionSearch").value="";$("regionSearch").placeholder=data.region==="ru"?"Кино, Баста, русская музыка…":"Սիրուշո, Armenian music…";
 loadRegion();
}));
$("regionSearchGo").onclick=()=>loadRegion($("regionSearch").value);
$("regionSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();loadRegion($("regionSearch").value)}});
root.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>{
 data.country=b.dataset.station;selectButtons("[data-station]","station",data.country);loadStations();
}));
$("stationRefresh").onclick=()=>loadStations(true);
const start=()=>{
 if(data.started)return;
 data.started=true;
 loadCharts();loadRegion();loadStations();
};
document.addEventListener("vetogram:charts-open",start);
window.VetogramCharts=Object.freeze({open:start,mapAudius,mapRadio,chartEndpoint,radioEndpoint,searchEndpoint,
 state:()=>({period:data.period,genre:data.genre,region:data.region,country:data.country,chartCount:data.charts.length,regionCount:data.regional.length,stationCount:data.stations.length})});
})();