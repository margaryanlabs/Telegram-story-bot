/* VETOGRAM Music — ccMixter connector (read-only, browser-direct).
 * The documented public Query API is used without a token. Music is never copied,
 * proxied or treated as owned by VETOGRAM. Only explicit CC BY/CC0 full MP3 uploads.
 * Browser CORS restrictions may prevent fetch; fallback links to source are provided.
 */
(()=>{
"use strict";
const V=window.VetogramMusic,root=document.querySelector('[data-view="mixter"]');
if(!V||!root)return;
const $=id=>document.getElementById(id);
const mk=(tag,className,label)=>{
 const x=document.createElement(tag);if(className)x.className=className;
 if(label!==undefined)x.textContent=String(label);
 return x;
};
const API="https://ccmixter.org/api/query";
const SEARCH_LIMIT=20,MAX_PAGES=80;
const GENRES=Object.freeze([
 {id:"remix",name:"Ремиксы",tags:"remix"},
 {id:"electronic",name:"Электроника",tags:"electronic"},
 {id:"chill",name:"Chill",tags:"chill"},
 {id:"ambient",name:"Ambient",tags:"ambient"},
 {id:"hip_hop",name:"Hip-Hop",tags:"hip_hop"},
 {id:"rock",name:"Rock",tags:"rock"},
 {id:"jazz",name:"Jazz",tags:"jazz"},
 {id:"instrumental",name:"Инструментал",tags:"instrumental"},
 {id:"pop",name:"Pop",tags:"pop"},
 {id:"acoustic",name:"Acoustic",tags:"acoustic"}
]);
function text(s,max=120){return String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function https(src,host){
 try{const u=new URL(String(src));return u.protocol==="https:"&&(!host||u.hostname===host||u.hostname==="www."+host)&&!u.username&&!u.password?u.href:""}catch{return""}
}
function licenseHref(link){
 try {
  const u=new URL(String(link));
  if(!["http:","https:"].includes(u.protocol)||!["creativecommons.org","www.creativecommons.org"].includes(u.hostname))return"";
  u.protocol="https:";return u.href;
 }catch{return""}
}
function license(link){
 try {
  const u=new URL(String(link));
  if(!["http:","https:"].includes(u.protocol)||!["creativecommons.org","www.creativecommons.org"].includes(u.hostname))return"";
  const p=u.pathname.endsWith("/")?u.pathname:u.pathname+"/";
  if(p==="/publicdomain/zero/1.0/")return"CC0";
  const v=["2.0","2.5","3.0","4.0"].find(v=>p==="/licenses/by/"+v+"/");
  return v?"CC BY "+v:"";
 }catch{return""}
}
function mapped(row){
 if(!row||!Number.isSafeInteger(Number(row.upload_id))||Number(row.upload_id)<1)return null;
 const lic=license(row.license_url);if(!lic)return null;
 const source=https(row.file_page_url,"ccmixter.org");
 if(!source)return null;
 const mp3=(Array.isArray(row.files)?row.files:[]).find(f=>{
  const u=https(f?.download_url,"ccmixter.org");
  const fmt=f?.file_format_info||{};
  return u&&fmt["media-type"]==="audio"&&(/mp3|mpeg/i.test(String(fmt.mime_type||"audio/mpeg")))&&
   (/\.mp3(?:[?#]|$)/i.test(u))&&Number(f.file_rawsize||0)<55*1024*1024;
 });
 if(!mp3)return null;
 const stream=https(mp3.download_url,"ccmixter.org");
 const artist=text(row.user_real_name||row.user_name||"ccMixter artist",85),title=text(row.upload_name,125);
 if(!artist||!title)return null;
 return {id:"ccmixter:"+Number(row.upload_id),title,artist,source:"ccmixter",
  stream,artwork:"",permalink:source,license:lic,license_url:licenseHref(row.license_url),
  attribution:artist+" — "+title+" · "+lic+" · ccMixter",
  provider:"ccMixter",playable:true};
}
function endpoint(genre,offset,term){
 const u=new URL(API);
 u.searchParams.set("f","json");
 u.searchParams.set("dataview","info");
 u.searchParams.set("lic","by");
 u.searchParams.set("limit",String(SEARCH_LIMIT));
 u.searchParams.set("offset",String(offset));
 if(term){
  u.searchParams.set("search",term);
  u.searchParams.set("search_type","any");
 }else{
  const g=GENRES.find(x=>x.id===genre);
  if(g)u.searchParams.set("tags",g.tags);
 }
 return u.href;
}
let genre="remix",term="",offset=0,loaded=0,finished=false,busy=false,running=null,items=[],ids=new Set();
const seedRows=Array.isArray(window.VetogramMixterSeeds)?window.VetogramMixterSeeds:[];
function seedExtras(){
 if(term)return 0;
 const before=items.length;
 renderNew(seedRows);
 return items.length-before;
}

function status(message){$("mixterStatus").textContent=message}
function drawGenres(){
 const target=$("mixterGenres");target.replaceChildren();
 for(const g of GENRES){
  const b=mk("button","mixter-pill"+(!term&&g.id===genre?" active":""),g.name);b.type="button";
  b.setAttribute("aria-pressed",String(!term&&g.id===genre));
  b.onclick=()=>{genre=g.id;term="";$("mixterInput").value="";drawGenres();start()};
  target.append(b);
 }
}
function card(t){
 const article=mk("article","mixter-track");
 const artwork=mk("div","mixter-art","♫");
 const info=mk("div","mixter-details");
 info.append(mk("strong","",t.title),mk("span","",t.artist),mk("small","",t.license+" · CCMIXTER"));
 const urls=mk("div","mixter-links");
 const origin=mk("a","","Источник ↗");origin.href=t.permalink;origin.target="_blank";origin.rel="noopener noreferrer";
 const rights=mk("a","","Лицензия ↗");
 rights.href=t.license_url;rights.target="_blank";rights.rel="noopener noreferrer";
 const attribution=mk("button","mixter-credit","Копировать атрибуцию");
 attribution.type="button";attribution.onclick=async()=>{
  try {await navigator.clipboard.writeText(t.attribution+" · "+t.permalink+" · "+t.license_url);status("Автор и лицензия скопированы")}catch{status(t.attribution)}
 };
 urls.append(origin,rights,attribution);info.append(urls);
 const like=mk("button","mixter-like","♡");like.type="button";like.title="В избранное";
 like.onclick=()=>{V.toggleLike(t);like.textContent=like.textContent==="♡"?"♥":"♡"};
 const play=mk("button","mixter-play","▶");play.type="button";play.setAttribute("aria-label","Слушать "+t.title);
 play.onclick=()=>V.play(t,items);
 article.append(artwork,info,like,play);return article;
}
function renderNew(rows){
 const list=$("mixterTracks");
 if(!items.length)list.replaceChildren();
 const frag=document.createDocumentFragment();
 for(const raw of rows){
  const v=mapped(raw);
  if(!v||ids.has(v.id))continue;
  ids.add(v.id);items.push(v);frag.append(card(v));
 }
 list.append(frag);
 if(!items.length)list.replaceChildren(mk("div","mixter-empty","В этой подборке пока нет подходящих полноформатных MP3. Попробуй другой жанр."));
}
function start(){
 running?.abort();offset=0;loaded=0;finished=false;busy=false;items=[];ids=new Set();
 $("mixterTracks").replaceChildren(mk("div","mixter-empty","Подключаем независимую музыку…"));
 $("mixterMore").hidden=true;load();
}
async function load(){
 if(busy||finished||offset>=MAX_PAGES*SEARCH_LIMIT)return;
 busy=true;
 const controller=new AbortController();running=controller;
 const timer=setTimeout(()=>controller.abort(),14000);
 const more=$("mixterMore");more.hidden=true;more.disabled=true;
 status("Ищем треки с разрешённой лицензией на ccMixter…");
 try{
  const result=await fetch(endpoint(genre,offset,term),{signal:controller.signal,credentials:"omit",headers:{Accept:"application/json"}});
  if(!result.ok)throw Error("HTTP "+result.status);
  if(Number(result.headers.get("content-length")||0)>3000000)throw Error("Too large");
  const content=await result.text();if(content.length>3000000)throw Error("Too large");
  const data=JSON.parse(content);if(!Array.isArray(data))throw Error("Invalid provider JSON");
  if(running!==controller)return;
  loaded+=data.length;offset+=SEARCH_LIMIT;
  renderNew(data);
  const starter=items.length<8?seedExtras():0;
  finished=data.length<SEARCH_LIMIT||offset>=MAX_PAGES*SEARCH_LIMIT;
  status(items.length+" доступных MP3 · "+loaded+" записей получено от API · лицензии CC BY."+
   (starter?" Добавлено "+starter+" проверенных записей стартовой подборки из других жанров.":"")+
   (finished?" Больше записей API в этой выдаче нет.":" Можно загрузить ещё."));
 }catch(e){
  if(running!==controller)return;
  const isNetwork=e?.name==="TypeError"||String(e?.message||"").includes("fetch");
  const restored=seedExtras();
  if(!items.length)$("mixterTracks").replaceChildren(mk("div","mixter-empty","Не удалось загрузить выдачу ccMixter. Открой каталог источника."));
  status(e?.name==="AbortError"?"Истёк срок запроса к ccMixter.":isNetwork?
   "Прямой API ccMixter может блокироваться браузером (CORS).":"ccMixter временно не отвечает.");
  if(restored)status($("mixterStatus").textContent+" Показано "+restored+" заранее проверенных независимых треков; попробуй другой жанр или повтори запрос.");
 }finally{
  clearTimeout(timer);
  if(running===controller){busy=false;more.hidden=finished;more.disabled=false;more.textContent=items.length?"＋ Показать ещё записи":"↻ Повторить"}
 }
}
$("mixterForm").onsubmit=e=>{
 e.preventDefault();term=text($("mixterInput").value,70);
 if(term.length===1){status("Введи хотя бы два символа");return}
 drawGenres();start();
};
$("mixterMore").onclick=load;
$("mixterSource").href="https://dig.ccmixter.org/";
drawGenres();
document.addEventListener("vetogram:mixter-open",()=>{if(!loaded&&!busy)start()});
window.VetogramMixter=Object.freeze({mapped,endpoint,load,search:q=>{term=text(q,70);$("mixterInput").value=term;drawGenres();start()},state:()=>({genre,term,offset,count:items.length,finished})});
})();
