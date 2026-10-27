/* VETOGRAM · Licensed Archive explorer. Small, on-demand batches; no bulk MP3 downloads. */
(()=>{
"use strict";
const V=window.VetogramMusic,root=document.querySelector('[data-view="archive"]');if(!V||!root)return;
const $=id=>document.getElementById(id);
const tag=(name,className,label)=>{const e=document.createElement(name);if(className)e.className=className;if(label!==undefined)e.textContent=String(label);return e};
const SAFE_URL=u=>{try{const x=new URL(String(u));return x.protocol==="https:"&&(!x.username&&!x.password)?x.href:""}catch{return""}};
const STATES={cc0:"CC0 · Общественное достояние",by3:"CC BY 3.0 · С указанием автора",by4:"CC BY 4.0 · С указанием автора"};
let license="cc0",page=0,busy=false,complete=false,items=[],known=new Set(),active=null,releaseCount=0;
function status(text){$("archiveStatus").textContent=text}
function buildCard(song){
 const e=tag("article","archive-track");
 const image=tag("img","archive-cover");image.src=SAFE_URL(song.artwork);image.alt="";image.loading="lazy";
 image.onerror=()=>{image.style.display="none"};
 const body=tag("div","archive-description");
 body.append(tag("strong","",song.title),tag("small","",song.artist),tag("span","archive-license",song.license+" · INTERNET ARCHIVE"));
 const links=tag("div","archive-links");
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
  if(!raw||raw.source!=="archive"||raw.playable!==true||!SAFE_URL(raw.stream)||!SAFE_URL(raw.permalink)||!SAFE_URL(raw.license_url)||!["CC0","CC BY 2.0","CC BY 2.5","CC BY 3.0","CC BY 4.0"].includes(raw.license)||!raw.id||known.has(raw.id))continue;
  const t={id:String(raw.id),source:"archive",title:String(raw.title||"Без названия"),artist:String(raw.artist||"Independent artist"),artwork:SAFE_URL(raw.artwork),stream:SAFE_URL(raw.stream),permalink:SAFE_URL(raw.permalink),license:raw.license,license_url:SAFE_URL(raw.license_url)};
  items.push(t);known.add(t.id);fragment.append(buildCard(t));
 }
 if(items.length){if(list.querySelector(".archive-empty"))list.replaceChildren();list.append(fragment)}
}
async function load(){
 if(busy||complete||page>=300)return;
 const wantedPage=page+1;busy=true;const ctl=new AbortController();active=ctl;const stop=setTimeout(()=>ctl.abort(),17000);
 const button=$("archiveMore");button.disabled=true;button.hidden=true;
 status("Ищем разрешённые музыкальные записи…");
 try{
  const response=await fetch("/api/music-archive?license="+encodeURIComponent(license)+"&page="+wantedPage,{credentials:"omit",signal:ctl.signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw Error("HTTP "+response.status);
  const payload=await response.json();if(!payload?.ok||!Array.isArray(payload.items))throw Error("Некорректный ответ каталога");
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
