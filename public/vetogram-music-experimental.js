/* VETOGRAM Music – experimental browser-only discovery adapter.
 * Unofficial Piped instances can return metadata and audio-only streams.
 * No server relay, downloads, media storage, DRM bypass or API credentials.
 * Availability, rights, CORS and regional playability are not guaranteed.
 */
(()=>{
"use strict";
const app=window.VetogramMusic, root=document.getElementById("experimentalResults");
if(!app||!root)return;
const byId=id=>document.getElementById(id);
const HOSTS=Object.freeze([
 "https://pipedapi.kavin.rocks",
 "https://pipedapi.adminforge.de",
 "https://api.piped.private.coffee",
 "https://pipedapi.nosebs.ru"
]);
const ID=/^[A-Za-z0-9_-]{11}$/;
const MAX_RESULTS=35;
let tracks=[],searchVersion=0,loading=false,lastQuery="",currentHost=HOSTS[0];
const text=(s,n=110)=>String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,n);
function validURL(value){
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password)return"";
  const host=u.hostname.toLowerCase();
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||
     /^(?:127|10|192\.168|169\.254)\./.test(host)||
     /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)||
     host==="::1"||host==="0.0.0.0")return"";
  return u.href;
 }catch{return""}
}
function videoId(raw){
 const value=String(raw??"");
 if(ID.test(value))return value;
 if(value.startsWith("/watch?")||value.startsWith("https://")){
  try{
   const u=new URL(value,"https://www.youtube.com");
   if(!["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be"].includes(u.hostname))return"";
   const id=u.hostname==="youtu.be"?u.pathname.slice(1):u.searchParams.get("v");
   return ID.test(id||"")?id:"";
  }catch{}
 }
 return"";
}
function normalize(x){
 if(!x||typeof x!=="object")return null;
 if(x.type&&x.type!=="stream")return null;
 const id=videoId(x.url||x.videoId||x.id),title=text(x.title),artist=text(x.uploaderName||x.uploader||"Исполнитель",85);
 const duration=Number(x.duration);
 if(!id||!title||!Number.isFinite(duration)||duration<35||duration>1200||
    /(?:live stream|прямой эфир|часовая подборка)/i.test(title))return null;
 return {id:"experimental:"+id,source:"experimental",videoId:id,title,artist,duration,
  artwork:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",playable:true};
}
function chooseAudio(data){
 if(data?.livestream||data?.error||!Array.isArray(data?.audioStreams))return"";
 const audio=byId("audio");
 const list=data.audioStreams.filter(s=>{
  if(!s||s.videoOnly||!validURL(s.url)||!/^audio\//i.test(String(s.mimeType||"")))return false;
  return !audio?.canPlayType||audio.canPlayType(String(s.mimeType).split(";")[0])!=="";
 }).sort((a,b)=>{
  const ma=String(a.mimeType||"").includes("mp4")?1:0,mb=String(b.mimeType||"").includes("mp4")?1:0;
  return mb-ma||Number(b.bitrate||0)-Number(a.bitrate||0);
 });
 return list.length?validURL(list[0].url):"";
}
async function readJson(url,deadline=8500){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),deadline);
 try{
  const res=await fetch(url,{signal:ctrl.signal,credentials:"omit",headers:{Accept:"application/json"},redirect:"error"});
  if(!res.ok)throw Error("HTTP "+res.status);
  if(!String(res.headers.get("content-type")||"").includes("json"))throw Error("Invalid media type");
  const body=await res.text();
  if(body.length>1700000)throw Error("Oversized reply");
  return JSON.parse(body);
 }finally{clearTimeout(timer)}
}
async function lookup(raw){
 const term=text(raw,80);
 if(term.length<2)return[];
 let unavailable=0;
 const preferred=[currentHost,...HOSTS.filter(h=>h!==currentHost)];
 for(const host of preferred){
  try{
   // Piped exposes music_songs on instances supporting YouTube Music;
   // fall back to ordinary videos when the instance does not support that filter.
   for(const filter of ["music_songs","videos"]){
    try{
     const data=await readJson(host+"/search?q="+encodeURIComponent(term)+"&filter="+filter);
     const items=Array.isArray(data?.items)?data.items:Array.isArray(data?.results)?data.results:[];
     const unique=new Set();
     const list=items.map(normalize).filter(t=>t&&!unique.has(t.videoId)&&unique.add(t.videoId)).slice(0,MAX_RESULTS);
     if(list.length){currentHost=host;return list}
    }catch{
     // A particular filter can be unsupported without making the whole host unusable.
    }
   }
   unavailable++;
  }catch{unavailable++}
 }
 if(unavailable>=HOSTS.length)throw Error("Каталог временно недоступен");
 return [];
}
async function resolve(track){
 const id=videoId(track?.videoId||String(track?.id||"").replace(/^experimental:/,""));
 if(!id)throw Error("Недействительная запись");
 const hosts=[currentHost,...HOSTS.filter(h=>h!==currentHost)];
 for(const host of hosts){
  try{
   const data=await readJson(host+"/streams/"+id,9500);
   const url=chooseAudio(data);
   if(url){currentHost=host;return url}
  }catch{}
 }
 throw Error("Сейчас нет доступного аудиопотока для этой песни");
}
function notice(message){
 const el=byId("experimentalStatus");if(el)el.textContent=message;
}
function element(tag,klass,value){
 const el=document.createElement(tag);if(klass)el.className=klass;
 if(value!==undefined)el.textContent=String(value);
 return el;
}
function render(){
 root.replaceChildren();
 if(!tracks.length)return;
 const fragment=document.createDocumentFragment();
 tracks.forEach((track,index)=>{
  const row=element("article","experimental-track");
  const art=element("img","experimental-cover");
  art.src=track.artwork;art.alt="";art.loading="lazy";
  const copy=element("div","experimental-copy");
  copy.append(element("strong","",track.title),element("small","",track.artist));
  const play=element("button","experimental-play","▶");play.type="button";
  play.setAttribute("aria-label","Слушать "+track.title);
  play.onclick=()=>{
   notice("Подключаем аудио: "+track.title+"…");
   app.play(track,tracks);
  };
  const like=element("button","experimental-like","♡");like.type="button";
  like.setAttribute("aria-label","Добавить в избранное "+track.title);
  like.onclick=()=>{app.toggleLike(track);like.textContent="♥"};
  row.append(art,copy,like,play);fragment.append(row);
 });
 root.append(fragment);
}
async function search(query){
 const term=text(query,80);
 const version=++searchVersion,last=lastQuery;
 lastQuery=term;tracks=[];root.replaceChildren();
 if(term.length<2){notice("Введите название песни или исполнителя.");return}
 loading=true;notice("Ищем музыку…");
 try{
  const found=await lookup(term);
  if(version!==searchVersion)return;
  tracks=found;render();
  notice(found.length?found.length+" записей. Нажми ▶ для проверки полного аудиопотока.":"Ничего не найдено. Попробуй другое название.");
 }catch(e){
  if(version===searchVersion)notice("Экспериментальный каталог сейчас не отвечает. Открытая музыка и личная библиотека работают отдельно.");
 }finally{if(version===searchVersion)loading=false}
}
document.addEventListener("vetogram:search-query",event=>{search(event.detail?.query||"")});
for(const button of document.querySelectorAll("[data-experimental-query]")){
 button.addEventListener("click",()=>{
  const query=button.dataset.experimentalQuery||"";
  app.showPage("search");
  const input=byId("searchInput");if(input)input.value=query;
  app.search(query);
 });
}
window.VetogramExperimental=Object.freeze({
 resolve,search,tracks:()=>tracks.slice(),status:()=>({loading,count:tracks.length,term:lastQuery})
});
})();
