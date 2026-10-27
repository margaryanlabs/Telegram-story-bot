/* VETOGRAM Music — YouTube playlist bridge.
 * Keyless embedding of publicly shared videos, playlists, and channel uploads.
 * Does not scrape, proxy, extract/download audio, hide the provider video player,
 * disable YouTube branding/ads, or claim licenses to music recordings.
 * No API search: external search is intentionally performed on YouTube itself.
 */
(()=>{
"use strict";
const app=window.VetogramMusic,root=document.querySelector('[data-view="youtube"]');
if(!app||!root)return;
const $=id=>document.getElementById(id);
const make=(name,cls,title)=>{const node=document.createElement(name);if(cls)node.className=cls;if(title!==undefined)node.textContent=String(title);return node};
const STORAGE="vetogram-youtube-library-v1",MAX_SAVED=50;
const REGIONS=Object.freeze([{id:"ru",label:"Русская"},{id:"hy",label:"Армянская"},{id:"en",label:"Мировая"}]);
function clean(v,n=115){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n)}
function validVideo(id){return /^[a-zA-Z0-9_-]{11}$/.test(String(id||""))}
function validPlaylist(id){
 const s=String(id||"");
 return (/^PL[A-Za-z0-9_-]{12,128}$/.test(s)||
  /^OLAK5uy_[A-Za-z0-9_-]{14,125}$/.test(s)||
  /^(?:UU|FL)[A-Za-z0-9_-]{22}$/.test(s));
}
function parseLink(input){
 let u;
 try{u=new URL(String(input).trim())}catch{return null}
 if(u.protocol!=="https:"&&! (u.protocol==="http:"&&(u.hostname==="youtu.be"||u.hostname==="youtube.com"||u.hostname==="www.youtube.com")))return null;
 const host=u.hostname.toLowerCase();
 if(!["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","www.youtube-nocookie.com","youtube-nocookie.com","youtu.be"].includes(host))return null;
 const path=u.pathname.replace(/\/+$/,"");
 if(host==="youtu.be"){
  const id=path.slice(1);return validVideo(id)?{kind:"video",id,url:"https://www.youtube.com/watch?v="+id}:null;
 }
 // A public playlist is intentionally preferred when the watch link includes both IDs.
 const list=u.searchParams.get("list");
 if(list&&validPlaylist(list)&&(path==="/playlist"||path==="/watch"||path.startsWith("/embed")||path==="/")){
  return {kind:"playlist",id:list,url:"https://www.youtube.com/playlist?list="+list};
 }
 const channel=path.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})$/);
 if(channel){
  const id="UU"+channel[1].slice(2);
  return {kind:"channel",id,url:"https://www.youtube.com/channel/"+channel[1]};
 }
 let vid="";
 if(path==="/watch")vid=u.searchParams.get("v")||"";
 else{
  const match=path.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})$/);
  if(match)vid=match[1];
 }
 if(validVideo(vid))return {kind:"video",id:vid,url:"https://www.youtube.com/watch?v="+vid};
 if(path==="/playlist"&&validPlaylist(list))return {kind:"playlist",id:list,url:"https://www.youtube.com/playlist?list="+list};
 return null;
}
function embedFor(item){
 if(item.kind==="video"&&validVideo(item.id))
  return "https://www.youtube-nocookie.com/embed/"+item.id+"?rel=0&playsinline=1";
 if(["playlist","channel"].includes(item.kind)&&validPlaylist(item.id))
  return "https://www.youtube-nocookie.com/embed/videoseries?list="+encodeURIComponent(item.id)+"&playsinline=1";
 if(item.kind==="curated"&&Array.isArray(item.ids)){
  const ids=item.ids.filter(validVideo).slice(0,30);
  if(!ids.length)return"";
  return "https://www.youtube-nocookie.com/embed/"+ids[0]+(ids.length>1?"?playlist="+ids.slice(1).join(",")+"&playsinline=1":"?playsinline=1");
 }
 return"";
}
function sourceURL(item){
 if(item.kind==="curated"){
  const id=item.ids.find(validVideo);return id?"https://www.youtube.com/watch?v="+id:"https://www.youtube.com/";
 }
 return item.url||"https://www.youtube.com/";
}
function cover(id){
 return validVideo(id)?"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg":"";
}
function parseSaved(){
 try {
  const value=JSON.parse(localStorage.getItem(STORAGE)||"[]");
  if(!Array.isArray(value))return[];
  const seen=new Set(),result=[];
  for(const v of value.slice(0,MAX_SAVED)){
   const link=parseLink(v?.url);
   if(!link||!clean(v?.label)||seen.has(link.kind+":"+link.id))continue;
   seen.add(link.kind+":"+link.id);
   result.push({...link,label:clean(v.label,80),added:Number(v.added)||0});
  }
  return result;
 }catch{return[]}
}
let saved=parseSaved(),region="ru",search="",active=null;
function notice(s){$("ytStatus").textContent=s}
function write(){
 try{localStorage.setItem(STORAGE,JSON.stringify(saved.map(x=>({url:x.url,label:x.label,added:x.added}))));return true}
 catch{notice("Браузер не разрешил сохранить подборку. Проверь настройки хранилища.");return false}
}
function chosenCurated(){
 const all=window.VetogramOriginals?.list?.()||[];
 return all.filter(v=>v.language===region&&validVideo(v.id));
}
function stop(){
 $("ytPlayerFrame").replaceChildren(make("p","yt-empty","Выбери видео или плейлист, чтобы открыть официальный YouTube-плеер."));
 $("ytPlaying").textContent="Ничего не воспроизводится";
 $("ytOpenSource").hidden=true;active=null;
}
function start(item){
 const url=embedFor(item);
 if(!url){notice("Не удалось открыть ссылку. Поддерживаются публичные YouTube-видео, плейлисты и каналы с ID UC…");return}
 try{document.getElementById("audio")?.pause()}catch{}
 // Preserve the user's ability to see and interact with the original YouTube video.
 const frame=make("iframe","yt-iframe");
 frame.src=url;frame.title="Официальный YouTube-плеер · "+clean(item.label||"Видео",90);
 frame.loading="eager";frame.referrerPolicy="strict-origin-when-cross-origin";
 frame.allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
 frame.allowFullscreen=true;
 $("ytPlayerFrame").replaceChildren(frame);
 $("ytPlaying").textContent=clean(item.label||"YouTube",100);
 $("ytOpenSource").href=sourceURL(item);
 $("ytOpenSource").hidden=false;
 active=item;
 $("ytPlayer").scrollIntoView({behavior:"smooth",block:"center"});
}
function searchExternal(term){
 const q=clean(term,90)||"русская музыка официальные клипы";
 const url="https://www.youtube.com/results?search_query="+encodeURIComponent(q+" official music video");
 if(window.Telegram?.WebApp?.openLink)window.Telegram.WebApp.openLink(url);
 else window.open(url,"_blank","noopener,noreferrer");
}
function native(item,isSaved=false){
 const row=make("article","yt-library-item");
 const thumb=make("div","yt-thumb");
 const first=validVideo(item.id)?item.id:Array.isArray(item.ids)?item.ids[0]:null;
 if(first&&validVideo(first)){const img=make("img");img.src=cover(first);img.alt="";img.loading="lazy";img.onerror=()=>img.remove();thumb.append(img)}
 else thumb.textContent="♫";
 const info=make("div","yt-library-info");
 info.append(make("strong","",item.label||"Подборка"));
 info.append(make("small","",item.kind==="curated"?item.ids.length+" видео · официальные источники":item.kind==="channel"?"Все публичные загрузки канала":item.kind==="playlist"?"YouTube-плейлист · число видео управляется YouTube":"YouTube-видео"));
 const actions=make("div","yt-library-actions");
 const play=make("button","yt-library-play","▶ Смотреть / слушать");
 play.type="button";play.onclick=()=>start(item);
 actions.append(play);
 if(isSaved){
  const remove=make("button","yt-library-remove","×");remove.type="button";remove.setAttribute("aria-label","Удалить "+item.label);
  remove.onclick=()=>{
   const i=saved.indexOf(item);if(i<0)return;
   saved.splice(i,1);write();renderSaved();notice("Подборка убрана из личной библиотеки.");
  };
  actions.append(remove);
 }
 row.append(thumb,info,actions);
 return row;
}
function renderSaved(){
 const container=$("ytSaved");container.replaceChildren();
 $("ytSavedCount").textContent=String(saved.length);
 if(!saved.length){container.append(make("p","yt-empty","Добавь ссылку на YouTube-плейлист или видео — она сохранится только на твоём устройстве."));return}
 for(const item of saved.slice().reverse())container.append(native(item,true));
}
function renderCurated(){
 const container=$("ytCurated");container.replaceChildren();
 const selected=chosenCurated().filter(v=>(v.title+" "+v.artist).toLowerCase().includes(search));
 const all=chosenCurated();
 $("ytGenreCount").textContent=String(all.length);
 if(!selected.length){container.append(make("p","yt-empty","Здесь нет совпадений. Попробуй другой запрос или категорию."));return}
 const playlist={
  kind:"curated",ids:selected.map(x=>x.id),
  label:REGIONS.find(x=>x.id===region)?.label+" музыка · "+selected.length+" клипов"
 };
 const heading=make("div","yt-curated-head");
 const playAll=make("button","yt-play-all","▶ Включить всю подборку · "+selected.length);
 playAll.type="button";playAll.onclick=()=>start(playlist);
 heading.append(make("strong","",playlist.label),playAll);
 container.append(heading);
 const grid=make("div","yt-curated-grid");
 for(const clip of selected){
  const row=native({kind:"video",id:clip.id,url:"https://www.youtube.com/watch?v="+clip.id,label:clip.artist+" — "+clip.title});
  grid.append(row);
 }
 container.append(grid);
}
$("ytImportForm").onsubmit=e=>{
 e.preventDefault();
 const parsed=parseLink($("ytImportUrl").value);
 if(!parsed){notice("Ссылка не распознана. Вставь публичную ссылку YouTube на видео, плейлист или канал формата /channel/UC…");return}
 const label=clean($("ytImportLabel").value,80)|| (parsed.kind==="video"?"Моё видео YouTube":parsed.kind==="channel"?"Загрузки канала":"Мой YouTube-плейлист");
 const existing=saved.findIndex(v=>v.kind===parsed.kind&&v.id===parsed.id);
 const obj={...parsed,label,added:Date.now()};
 if(existing>=0)saved.splice(existing,1);
 saved.push(obj);
 if(saved.length>MAX_SAVED)saved.shift();
 if(!write())return;
 renderSaved();
 $("ytImportUrl").value="";$("ytImportLabel").value="";
 notice("Сохранено: "+label+". Включай через официальный YouTube-плеер.");
 start(obj);
};
$("ytSearchForm").onsubmit=e=>{e.preventDefault();searchExternal($("ytSearchInput").value)};
$("ytFilterInput").oninput=v=>{search=String(v.target.value||"").toLowerCase().trim().slice(0,85);renderCurated()};
root.querySelectorAll("[data-yt-region]").forEach(b=>b.onclick=()=>{
 region=b.dataset.ytRegion;
 if(!REGIONS.some(x=>x.id===region))return;
 for(const it of root.querySelectorAll("[data-yt-region]")){const yes=it.dataset.ytRegion===region;it.classList.toggle("active",yes);it.setAttribute("aria-pressed",String(yes))}
 renderCurated();
});
$("ytStop").onclick=stop;
$("ytOpenSource").hidden=true;
renderCurated();renderSaved();
document.addEventListener("vetogram:youtube-open",()=>{renderCurated();renderSaved()});
window.VetogramYouTube=Object.freeze({parseLink,embedFor,start,open:(input,label)=>{
 const parsed=parseLink(input);if(!parsed)return false;
 app.showPage("youtube");start({...parsed,label:clean(label||"YouTube",90)});return true;
},state:()=>({region,curated:chosenCurated().length,saved:saved.length,active:active?.label||null})});
})();
