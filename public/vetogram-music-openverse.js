/* VETOGRAM Music: Openverse open-licensed, original full-audio discovery.
 * Browser reads only the public API. Direct source audio plays in VETOGRAM <audio>;
 * no downloading/stripping protected content or disguising unlicensed mainstream music.
 * Providers may block hotlinking; the HTMLAudioElement's error is surfaced by core.
 */
(()=>{
"use strict";
const app=window.VetogramMusic,root=document.querySelector('[data-view="catalog"]');
if(!app||!root)return;
const $=id=>document.getElementById(id);
const mk=(tag,cls,t)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(t!==undefined)x.textContent=String(t);return x;};
const API="https://api.openverse.org/v1/audio/";
const PAGE_SIZE=20,MAX_PAGES=30;
const PERMITTED=new Set(["by","by-sa","cc0"]);
const SKIPPED_PROVIDERS=new Set(["jamendo"]); // Its platform licenses can limit third-party consumer music services.
let term="",page=0,items=[],seen=new Set(),loading=false,hasMore=false,controller=null,initialized=false;
const clean=(s,n=130)=>String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n);
function https(url){
 try{const u=new URL(String(url));return u.protocol==="https:"&&!u.username&&!u.password?u.href:""}catch{return""}
}
function normLicense(x){
 const k=String(x||"").toLowerCase();
 return PERMITTED.has(k)?k:"";
}
function normalize(raw){
 if(!raw||raw.category!=="music"||raw.mature===true||SKIPPED_PROVIDERS.has(String(raw.provider||"").toLowerCase()))return null;
 const lic=normLicense(raw.license);
 if(!lic)return null;
 const src=https(raw.url),origin=https(raw.foreign_landing_url),licenseUrl=https(raw.license_url);
 const title=clean(raw.title),artist=clean(raw.creator||"Independent artist",100);
 if(!src||!origin||!licenseUrl||!title||!artist||!raw.id||String(raw.id).length>110)return null;
 try{
  const terms=new URL(licenseUrl);
  const version=clean(raw.license_version,12);
  if(!["creativecommons.org","www.creativecommons.org"].includes(terms.hostname))return null;
  const valid=lic==="cc0"?
    terms.pathname.startsWith("/publicdomain/zero/1.0"):
    terms.pathname.startsWith("/licenses/"+lic+"/")&&(!version||terms.pathname.includes("/"+version+"/"));
  if(!valid)return null;
 }catch{return null}
 // Restrict to playable file types, not arbitrary pages, playlists or iframe embeds.
 const mediaExt=String(raw.filetype||"").replace(".","").toLowerCase();
 const location=new URL(src).pathname.toLowerCase();
 if(!["mp3","mpeg","m4a","aac","ogg","oga"].includes(mediaExt)&&!/\.(mp3|m4a|aac|ogg|oga)$/.test(location))return null;
 const id="openverse:"+String(raw.id);
 return {id,source:"openverse",title,artist,artwork:https(raw.thumbnail),
  stream:src,permalink:origin,license:(lic==="cc0"?"CC0":"CC "+lic.toUpperCase()+" "+(raw.license_version||"")).trim(),
  license_url:licenseUrl,playable:true,duration:Number(raw.duration)||0};
}
function endpoint(query,p){
 if(!clean(query,90)||!Number.isInteger(p)||p<1||p>MAX_PAGES)throw Error("Invalid search");
 const u=new URL(API);
 const params={q:clean(query,90),page:String(p),page_size:String(PAGE_SIZE),
   category:"music",license:"cc0,by,by-sa",license_type:"commercial",filter_dead:"true"};
 for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);
 return u.href;
}
function attribution(track){
 const details=mk("details","open-audio-rights");
 details.append(mk("summary","","ⓘ Информация о записи"));
 const page=mk("a","","Автор и запись ↗");
 page.href=track.permalink;page.target="_blank";page.rel="noopener noreferrer";
 const lic=mk("a","","Лицензия ↗");
 lic.href=track.license_url;lic.target="_blank";lic.rel="noopener noreferrer";
 details.append(page,lic);return details;
}
function card(track){
 const e=mk("article","open-audio-track");
 const cover=mk("div","open-audio-cover","♫");
 if(track.artwork){const image=mk("img");image.src=track.artwork;image.alt="";image.loading="lazy";image.onerror=()=>image.remove();cover.replaceChildren(image)}
 const info=mk("div","open-audio-info");
 info.append(mk("strong","",track.title),mk("span","",track.artist));
 info.append(attribution(track));
 const fav=mk("button","open-audio-like","♡");fav.type="button";fav.setAttribute("aria-label","В избранное: "+track.title);
 fav.onclick=()=>{app.toggleLike(track);fav.textContent=fav.textContent==="♡"?"♥":"♡"};
 const play=mk("button","open-audio-play","▶");
 play.type="button";play.setAttribute("aria-label","Слушать "+track.title);
 play.onclick=()=>app.play(track,items);
 e.append(cover,info,fav,play);return e;
}
function status(message){$("openAudioStatus").textContent=message}
function render(rows){
 const container=$("openAudioResults");
 const fragment=document.createDocumentFragment();
 for(const x of rows){
  const t=normalize(x);
  if(!t||seen.has(t.id))continue;
  seen.add(t.id);items.push(t);fragment.append(card(t));
 }
 if(items.length&&container.querySelector(".open-audio-empty"))container.replaceChildren();
 container.append(fragment);
}
async function next(){
 if(loading||!term||!hasMore||page>=MAX_PAGES)return;
 const p=page+1;
 loading=true;
 const button=$("openAudioMore");button.disabled=true;button.hidden=true;
 const c=new AbortController();controller=c;
 const timer=setTimeout(()=>c.abort(),11500);
 status("Ищем доступные аудиозаписи…");
 try{
  const response=await fetch(endpoint(term,p),{signal:c.signal,credentials:"omit",headers:{Accept:"application/json"}});
  if(!response.ok)throw Error("HTTP "+response.status);
  if(Number(response.headers.get("content-length")||0)>2400000)throw Error("Response too large");
  const body=await response.text();if(body.length>2400000)throw Error("Response too large");
  const data=JSON.parse(body);if(c!==controller)return;
  if(!Array.isArray(data.results))throw Error("Bad response");
  page=p;
  render(data.results);
  hasMore=p<Math.min(MAX_PAGES,Number(data.page_count)||0);
  if(!items.length)$("openAudioResults").replaceChildren(mk("div","open-audio-empty","По этому запросу дополнительных записей пока нет. Попробуй другое название."));
  status(items.length+" аудиозаписей найдено в этой подборке. Включай ▶ прямо здесь."+
    (hasMore?" Можно показать ещё.":""));
 }catch(error){
  if(c!==controller)return;
  // Some regions or WebViews block this API. Never invent results or turn song searches into video redirects.
  if(!items.length)$("openAudioResults").replaceChildren(mk("div","open-audio-empty","Дополнительная библиотека сейчас недоступна. Основной музыкальный каталог продолжает работать."));
  status(error?.name==="AbortError"?"Дополнительный поиск не ответил вовремя.":"Дополнительный поиск временно недоступен.");
 }finally{
  clearTimeout(timer);
  if(c===controller){loading=false;button.disabled=false;button.hidden=!hasMore;button.textContent=page?"＋ Ещё музыка":"↻ Повторить"}
 }
}
function search(query){
 const q=clean(query,90);
 if(q.length<2){status("Для поиска введи хотя бы два символа.");return}
 controller?.abort();term=q;page=0;items=[];seen=new Set();loading=false;hasMore=true;
 $("openAudioResults").replaceChildren(mk("div","open-audio-empty","Загружаем музыку…"));
 next();
}
$("openAudioMore").onclick=next;
document.addEventListener("vetogram:catalog-query",e=>search(e.detail?.query||""));
document.addEventListener("vetogram:catalog-open",()=>{if(!initialized){initialized=true;setTimeout(()=>{if(!term)search($("catalogQuery")?.value||"русская музыка")},0)}});
window.VetogramOpenAudio=Object.freeze({normalize,endpoint,search,next,state:()=>({query:term,page,count:items.length,hasMore})});
})();