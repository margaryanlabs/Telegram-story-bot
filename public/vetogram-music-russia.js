/* Vetogram Music — Russia-first chart from official Apple Music Top Songs RSS.
 * Feed and dated fallback are promotional metadata, NOT licensed full MP3 audio.
 * All chart positions come from Apple; player is always Apple's visible iframe.
 * Fallback is permanently labelled as its date when live fetch is unavailable.
 */
(()=>{
"use strict";
const api=window.VetogramMusic,root=document.querySelector('[data-view="charts"]'),snapshot=window.VetogramRussiaChartSnapshot;
if(!api||!root||!snapshot)return;
const $=id=>document.getElementById(id);
const FEED="https://rss.marketingtools.apple.com/api/v2/ru/music/most-played/25/songs.json";
const IMAGE_HOSTS=["is1-ssl.mzstatic.com","is2-ssl.mzstatic.com","is3-ssl.mzstatic.com","is4-ssl.mzstatic.com","is5-ssl.mzstatic.com"];
const div=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e};
function clean(v,n=140){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n)}
function validated(raw,hosts){
 try{const u=new URL(String(raw));return u.protocol==="https:"&&!u.username&&!u.password&&hosts.includes(u.hostname)?u:""}catch{return""}
}
function mapTrack(song,rank){
 if(!song||!Number.isInteger(rank)||rank<1||rank>200)return null;
 const u=validated(song.url,["music.apple.com"]),img=validated(song.artworkUrl100,IMAGE_HOSTS);
 const name=clean(song.name),artist=clean(song.artistName);
 if(!u||u.pathname.split("/")[1]!=="ru"||!name||!artist||String(song.id||"").length>40)return null;
 const match=u.pathname.match(/^\/ru\/album\/[^/]+\/\d+\/?$/);
 if(!match)return null;
 const trackId=u.searchParams.get("i");
 if(!trackId||!/^\d{1,20}$/.test(trackId))return null;
 return {id:"ru-apple:"+trackId,rank,name,artist,url:u.href,artwork:img?img.href:"",
  embed:"https://embed.music.apple.com"+u.pathname+"?i="+trackId};
}
function formatDate(value){
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return"дата не подтверждена";
 return d.toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Moscow"});
}
let songs=[],updated=snapshot.updated,mode="snapshot",controller=null,lastLoaded=0;
function label(){
 return (mode==="live"?"Обновлено":"Снимок")+" "+formatDate(updated)+" · Источник: Apple Music Top Songs, Россия · "+songs.length+" песен. Воспроизведение через Apple Music.";
}
function goOfficial(song){window.open(song.url,"_blank","noopener,noreferrer")}
function openPlayer(song){
 if(!song)return;
 document.getElementById("audio")?.pause();
 api.showPage("charts");
 const iframe=div("iframe","ru-official-iframe");
 iframe.src=song.embed;iframe.title=song.artist+" — "+song.name+" · Apple Music";
 iframe.loading="eager";iframe.allow="encrypted-media; autoplay; fullscreen; picture-in-picture";
 iframe.referrerPolicy="strict-origin-when-cross-origin";iframe.allowFullscreen=true;
 $("ruChartFrame").replaceChildren(iframe);
 $("ruChartNow").textContent=song.artist+" — "+song.name+" · Apple Music";
 $("ruChartExternal").href=song.url;
 $("ruChartExternal").hidden=false;
 $("ruChartFrameNote").textContent="Официальный видимый плеер Apple Music. Полное прослушивание зависит от региона и подписки; без неё может быть доступен только отрывок.";
 $("ruChartPlayer").scrollIntoView({behavior:"smooth",block:"center"});
}
function art(song){
 const box=div("div","ru-cover","♫");
 if(song.artwork){const img=div("img");img.src=song.artwork;img.loading="lazy";img.alt="";img.onerror=()=>img.remove();box.append(img)}
 return box;
}
function card(song,home=false){
 const row=div("article",home?"ru-song ru-song-home":"ru-song");
 row.append(div("span","ru-rank",String(song.rank).padStart(2,"0")),art(song));
 const info=div("div","ru-song-info");
 info.append(div("strong","",song.name),div("span","",song.artist));
 info.append(div("small","","APPLE MUSIC · РОССИЯ"));
 const actions=div("div","ru-song-actions");
 const play=div("button","ru-song-play","▶");
 play.type="button";play.title="Открыть официальный плеер Apple Music";
 play.setAttribute("aria-label","Открыть официальный плеер "+song.artist+" — "+song.name);
 play.onclick=()=>openPlayer(song);
 const link=div("a","ru-song-link","Apple ↗");link.href=song.url;link.target="_blank";link.rel="noopener noreferrer";
 link.setAttribute("aria-label","Открыть "+song.name+" в Apple Music");
 actions.append(play,link);
 row.append(info,actions);
 return row;
}
function renderOfficialVideos(){
 const target=$("homeRussianVideos");if(!target)return;
 const vids=window.VetogramOriginals?.list?.().filter(x=>x.language==="ru")||[];
 target.replaceChildren();
 if(!vids.length){target.append(div("p","ru-empty","Оригинальные русские клипы сейчас не загружены."));return}
 const fragment=document.createDocumentFragment();
 for(const video of vids.slice(0,6)){
  const card=div("article","ru-video");
  const cover=div("div","ru-video-image");
  const image=div("img");image.src="https://i.ytimg.com/vi/"+encodeURIComponent(video.id)+"/hqdefault.jpg";
  image.alt="";image.loading="lazy";image.onerror=()=>image.remove();cover.append(image);
  const info=div("div","ru-video-detail");
  info.append(div("strong","",video.title),div("span","",video.artist));
  const button=div("button","ru-video-play","▶ Смотреть / слушать");button.type="button";
  button.onclick=()=>window.VetogramOriginals?.openById?.(video.id);
  const source=div("a","ru-video-source","YouTube ↗");
  source.href="https://www.youtube.com/watch?v="+encodeURIComponent(video.id);
  source.target="_blank";source.rel="noopener noreferrer";
  info.append(button,source);card.append(cover,info);fragment.append(card);
 }
 target.append(fragment);
}
function render(){
 const full=$("ruChartsTracks"),home=$("homeRussianTracks");
 full.replaceChildren();home.replaceChildren();
 if(!songs.length){
  full.append(div("p","ru-empty","Не удалось загрузить чарт России. Открой официальный источник."));
  home.append(div("p","ru-empty","Чарт временно не загружается."));
  return;
 }
 const frag=document.createDocumentFragment();
 for(const s of songs)frag.append(card(s));
 full.append(frag);
 // Russian-language highlights, ranked using their original Top Russia positions.
 const inRussian=songs.filter(x=>/[А-Яа-яЁё]/.test(x.name+" "+x.artist)).slice(0,8);
 const selected=inRussian.length>=5?inRussian:songs.slice(0,8);
 const compact=document.createDocumentFragment();
 for(const s of selected)compact.append(card(s,true));
 home.append(compact);
 $("ruChartsStatus").textContent=label();
 $("ruHomeStatus").textContent=mode==="live"?"Рейтинг Apple Music · "+formatDate(updated):
  "Проверенный снимок рейтинга Apple Music · "+formatDate(updated);
}
function mapFeed(data){
 if(data?.feed?.country!=="ru"||!Array.isArray(data.feed.results)||data.feed.results.length<5)throw Error("Invalid Russia chart response");
 const items=data.feed.results.map((x,i)=>mapTrack(x,i+1)).filter(Boolean);
 if(items.length<5)throw Error("No validated songs");
 return {updated:data.feed.updated,items};
}
async function load(force=false){
 if(!force&&Date.now()-lastLoaded<10*60*1000)return;
 controller?.abort();const ctl=new AbortController();controller=ctl;
 const timer=setTimeout(()=>ctl.abort(),12000);
 $("ruChartsReload").disabled=true;
 if(mode==="snapshot")$("ruChartsStatus").textContent=label()+" · Проверяем обновления…";
 try{
  const res=await fetch(FEED,{credentials:"omit",signal:ctl.signal,headers:{Accept:"application/json"}});
  if(!res.ok)throw Error("HTTP "+res.status);
  if(Number(res.headers.get("content-length")||0)>1900000)throw Error("Too large");
  const body=await res.text();if(body.length>1900000)throw Error("Too large");
  const parsed=mapFeed(JSON.parse(body));if(controller!==ctl)return;
  songs=parsed.items;updated=parsed.updated;mode="live";lastLoaded=Date.now();render();
 }catch(err){
  if(controller!==ctl)return;
  if(!songs.length){songs=snapshot.results.map((x,i)=>mapTrack(x,i+1)).filter(Boolean);updated=snapshot.updated;mode="snapshot"}
  render();
  $("ruChartsStatus").textContent=label()+" · "+(mode==="snapshot"?"Онлайн-обновление недоступно; показана сохранённая дата.":"Не удалось обновить");
 }finally{clearTimeout(timer);if(controller===ctl)$("ruChartsReload").disabled=false}
}
const selectArtist=artist=>{
 api.showPage("hits");window.VetogramHits?.search?.(artist,"ru");
};
document.querySelectorAll("[data-russian-artist]").forEach(b=>b.addEventListener("click",()=>selectArtist(b.dataset.russianArtist)));
$("ruChartsReload").onclick=()=>load(true);
$("ruChartClose").onclick=()=>{
 $("ruChartFrame").replaceChildren(div("p","ru-empty","Выбери песню из чарта России."));
 $("ruChartNow").textContent="Официальный плеер Apple Music";
 $("ruChartExternal").hidden=true;
};
$("ruChartExternal").hidden=true;
$("ruChartsOfficial").href="https://music.apple.com/ru/charts";
$("ruChartsOfficial").target="_blank";$("ruChartsOfficial").rel="noopener noreferrer";
songs=snapshot.results.map((x,i)=>mapTrack(x,i+1)).filter(Boolean);render();renderOfficialVideos();
load();
document.addEventListener("vetogram:charts-open",()=>load());
window.VetogramRussiaChart=Object.freeze({open:()=>{api.showPage("charts");load()},refresh:()=>load(true),
 state:()=>({count:songs.length,updated,source:"Apple Music — Россия",mode}),
 mapTrack});
})();
