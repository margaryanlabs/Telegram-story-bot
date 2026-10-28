/* VETOGRAM · Licensed Archive explorer. Small, on-demand batches; no bulk MP3 downloads. */
(()=>{
"use strict";
const V=window.VetogramMusic,root=document.querySelector('[data-view="archive"]');if(!V||!root)return;
const $=id=>document.getElementById(id);
const tag=(name,className,label)=>{const e=document.createElement(name);if(className)e.className=className;if(label!==undefined)e.textContent=String(label);return e};
const SAFE_URL=u=>{try{const x=new URL(String(u));return x.protocol==="https:"&&(!x.username&&!x.password)?x.href:""}catch{return""}};
const STATES={cc0:"CC0 · Общественное достояние",by3:"CC BY 3.0 · Авторство",by4:"CC BY 4.0 · Авторство",sa2:"CC BY-SA 2.0 · Сохранение лицензии",sa3:"CC BY-SA 3.0 · Сохранение лицензии",sa4:"CC BY-SA 4.0 · Сохранение лицензии"};
let license="cc0",page=0,busy=false,complete=false,items=[],known=new Set(),active=null,releaseCount=0;
function status(text){$("archiveStatus").textContent=text}
function buildCard(song){
 const e=tag("article","archive-track");
 const image=tag("img","archive-cover");image.src=SAFE_URL(song.artwork);image.alt="";image.loading="lazy";
 image.onerror=()=>{image.style.display="none"};
 const body=tag("div","archive-description");
 body.append(tag("strong","",song.title),tag("small","",song.artist),tag("span","archive-license",song.license));
 const links=tag("details","archive-links");links.append(tag("summary","","ⓘ Автор и лицензия"));
 const source=tag("a","","Источник ↗");source.href=SAFE_URL(song.permalink);source.target="_blank";source.rel="noopener noreferrer";
 const lic=tag("a","","Лицензия ↗");lic.href=SAFE_URL(song.license_url);lic.target="_blank";lic.rel="noopener noreferrer";
 links.append(source,lic);body.append(links);
 const p=tag("button","archive-play","▶");p.type="button";p.setAttribute("aria-label","Слушать "+song.title);
 p.onclick=()=>V.play(song,items);
 const fav=tag("button","archive-fav","♡");fav.type="button";fav.title="В избранное";
 fav.setAttribute("aria-label","Добавить "+song.title+" в избранное");
 fav.onclick=()=>{V.toggleLike(song);fav.textContent=fav.textContent==="♡"?"♥":"♡"};
 e.append(image,body,fav,p);return e;
}
function addTracks(rows){
 const list=$("archiveList"),fragment=document.createDocumentFragment();
 for(const raw of rows){
  if(!raw||raw.source!=="archive"||raw.playable!==true||!SAFE_URL(raw.stream)||!SAFE_URL(raw.permalink)||!SAFE_URL(raw.license_url)||!["CC0","CC BY 2.0","CC BY 2.5","CC BY 3.0","CC BY 4.0","CC BY-SA 2.0","CC BY-SA 3.0","CC BY-SA 4.0"].includes(raw.license)||!raw.id||known.has(raw.id))continue;
  const t={id:String(raw.id),source:"archive",title:String(raw.title||"Без названия"),artist:String(raw.artist||"Independent artist"),artwork:SAFE_URL(raw.artwork),stream:SAFE_URL(raw.stream),permalink:SAFE_URL(raw.permalink),license:raw.license,license_url:SAFE_URL(raw.license_url)};
  items.push(t);known.add(t.id);fragment.append(buildCard(t));
 }
 if(items.length){if(list.querySelector(".archive-empty"))list.replaceChildren();list.append(fragment)}
}
// Internet Archive's public search and metadata APIs support browser CORS requests.
// Only CC0, CC BY and CC BY-SA recordings are listed; no server, secrets, or MP3 import jobs.
const SOURCES=Object.freeze({
 cc0:"http://creativecommons.org/publicdomain/zero/1.0/",
 by3:"http://creativecommons.org/licenses/by/3.0/",
 by4:"http://creativecommons.org/licenses/by/4.0/",
 sa2:"http://creativecommons.org/licenses/by-sa/2.0/",
 sa3:"http://creativecommons.org/licenses/by-sa/3.0/",
 sa4:"http://creativecommons.org/licenses/by-sa/4.0/"
});
const ARCHIVE="https://archive.org";
function safeId(x){const id=String(x||"");return /^[A-Za-z0-9._-]{1,130}$/.test(id)?id:""}
function licenseType(link){
 try {
  const u=new URL(String(link));
  if(!["http:","https:"].includes(u.protocol)||!["creativecommons.org","www.creativecommons.org"].includes(u.hostname))return"";
  const p=u.pathname.endsWith("/")?u.pathname:u.pathname+"/";
  if(p==="/publicdomain/zero/1.0/")return"CC0";
  const version=["2.0","2.5","3.0","4.0"].find(v=>p==="/licenses/by/"+v+"/");
  if(version)return"CC BY "+version;
  const sa=["2.0","3.0","4.0"].find(v=>p==="/licenses/by-sa/"+v+"/");
  return sa?"CC BY-SA "+sa:"";
 }catch{return""}
}
function archiveSearchUrl(group,p){
 if(!Object.hasOwn(SOURCES,group)||!Number.isInteger(p)||p<1||p>300)throw Error("Неверная страница");
 const q='collection:netlabels AND mediatype:audio AND licenseurl:"'+SOURCES[group]+'"';
 const params=new URLSearchParams({q,rows:"4",page:String(p),output:"json"});
 for(const f of ["identifier","title","licenseurl"])params.append("fl[]",f);
 return ARCHIVE+"/advancedsearch.php?"+params.toString();
}
async function fetchJSON(url,signal,max=3200000){
 const response=await fetch(url,{credentials:"omit",signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("HTTP "+response.status);
 if(Number(response.headers.get("content-length")||0)>max)throw Error("Слишком большой ответ архива");
 const text=await response.text();if(text.length>max)throw Error("Слишком большой ответ архива");
 return JSON.parse(text);
}
function archiveTracks(raw){
 const meta=raw?.metadata||{},id=safeId(meta.identifier);
 const licenseName=licenseType(Array.isArray(meta.licenseurl)?meta.licenseurl[0]:meta.licenseurl);
 if(!id||meta.mediatype!=="audio"||!licenseName||!Array.isArray(raw.files))return[];
 const good=f=>String(f?.name||"").toLowerCase().endsWith(".mp3");
 const sound=raw.files.filter(f=>f.source==="original"&&good(f))
   .concat(raw.files.filter(f=>f.source==="derivative"&&good(f)));
 const tracks=[];
 for(const f of sound.slice(0,65)){
  if(tracks.length>=12)break;
  if(typeof f.name!=="string"||f.name.length>260||f.name.startsWith("/")||f.name.includes("../")||f.name.includes(String.fromCharCode(0))||!Number.isFinite(Number(f.size))||Number(f.size)<20000||Number(f.size)>52428800||f.private||f.is_dark)continue;
  const artist=String(f.artist||f.creator||meta.creator||"Independent artist").split("<").join(" ").split(">").join(" ").slice(0,90);
  const title=String(f.title||f.name.slice(0,-4).split("_").join(" ").split("-").join(" ")).split("<").join(" ").split(">").join(" ").slice(0,130);
  if(!artist.trim()||!title.trim())continue;
  tracks.push({id:"archive:"+id+":"+f.name.slice(0,130),source:"archive",title,artist,provider:"Internet Archive",
    artwork:ARCHIVE+"/services/img/"+encodeURIComponent(id),
    stream:ARCHIVE+"/download/"+encodeURIComponent(id)+"/"+encodeURIComponent(f.name).replaceAll("%2F","/"),
    permalink:ARCHIVE+"/details/"+encodeURIComponent(id),license:licenseName,
    license_url:String(Array.isArray(meta.licenseurl)?meta.licenseurl[0]:meta.licenseurl),playable:true});
 }
 return tracks;
}
async function providerPage(group,p,signal){
 const search=await fetchJSON(archiveSearchUrl(group,p),signal,1500000);
 const resp=search?.response||{},docs=Array.isArray(resp.docs)?resp.docs:[];
 const results=await Promise.allSettled(docs.map(x=>{
  const id=safeId(x.identifier);
  if(!id)return Promise.resolve({});
  return fetchJSON(ARCHIVE+"/metadata/"+encodeURIComponent(id),signal);
 }));
 const tracks=results.flatMap(x=>x.status==="fulfilled"?archiveTracks(x.value):[]);
 return{ok:true,items:tracks,releaseCount:Number(resp.numFound)||0,
 hasMore:p*4<(Number(resp.numFound)||0)};
}
async function load(){
 if(busy||complete||page>=300)return;
 const wantedPage=page+1;busy=true;const ctl=new AbortController();active=ctl;const stop=setTimeout(()=>ctl.abort(),17000);
 const button=$("archiveMore");button.disabled=true;button.hidden=true;
 status("Загружаем записи…");
 try{
  const payload=await providerPage(license,wantedPage,ctl.signal);
  if(!payload?.ok||!Array.isArray(payload.items))throw Error("Некорректный ответ каталога");
  if(active!==ctl)return;
  releaseCount=Number(payload.releaseCount)||0;
  page=wantedPage;addTracks(payload.items);
  complete=!payload.hasMore||page>=300;
  if(!items.length)$("archiveList").replaceChildren(tag("div","archive-empty","В этой партии не обнаружены подходящие MP3. Загрузите следующую страницу."));
  status("Найдено "+releaseCount.toLocaleString("ru-RU")+" релизов с выбранной лицензией · открыто "+items.length+" треков · просмотрено "+page*4+" релиза(ов).");
 }catch(err){
  if(active!==ctl)return;
  if(!items.length)$("archiveList").replaceChildren(tag("div","archive-empty","Архив сейчас недоступен. Существующий каталог Audius остаётся доступен."));
  status(err.name==="AbortError"?"Архив долго отвечает. Попробуй повторить.":"Ошибка соединения с музыкальным архивом. Повтори загрузку.");
 }finally{
  clearTimeout(stop);
  if(active===ctl){busy=false;button.disabled=false;button.hidden=complete;button.textContent=items.length?"＋ Загрузить ещё записи":"↻ Повторить"}
 }
}
function reset(group){
 if(!(group in STATES))return;
 active?.abort();license=group;page=0;items=[];known=new Set();busy=false;complete=false;releaseCount=0;
 const box=$("archiveList");box.replaceChildren(tag("div","archive-empty","Загружаем открытые треки…"));
 root.querySelectorAll("[data-archive-license]").forEach(button=>{
  const yes=button.dataset.archiveLicense===license;button.classList.toggle("active",yes);button.setAttribute("aria-pressed",String(yes));
 });
 load();
}
root.querySelectorAll("[data-archive-license]").forEach(button=>button.onclick=()=>reset(button.dataset.archiveLicense));
$("archiveMore").onclick=load;
document.addEventListener("vetogram:archive-open",()=>{if(!page&&!busy)reset(license)});
window.VetogramArchive=Object.freeze({load,select:reset,status:()=>({license,page,count:items.length,releaseCount,complete})});
})();
