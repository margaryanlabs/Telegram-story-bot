/* Vetogram Music — paginated, real Audius catalog discovery.
 * No seeded/fake songs, third-party file storage, or protected music bypass.
 * Regional tabs are discovery searches, NOT regional charts or verified nationality.
 */
(()=>{
"use strict";
const V=window.VetogramMusic,root=document.querySelector('[data-view="catalog"]');
if(!V||!root)return;
const $=id=>document.getElementById(id);
const API="https://api.audius.co/v1/tracks/search";
const LIMIT=40,MAX_RESULTS=800;
const PRESETS=[
 {id:"world",label:"Мировая · Pop",q:"pop",group:"world"},
 {id:"hiphop",label:"Hip-Hop / Rap",q:"hip hop",group:"world"},
 {id:"rnb",label:"R&B / Soul",q:"r&b",group:"world"},
 {id:"rock",label:"Rock",q:"rock",group:"world"},
 {id:"electronic",label:"Electronic",q:"electronic",group:"world"},
 {id:"dance",label:"Dance",q:"dance",group:"world"},
 {id:"indie",label:"Indie",q:"indie",group:"world"},
 {id:"jazz",label:"Jazz",q:"jazz",group:"world"},
 {id:"ambient",label:"Chill / Ambient",q:"ambient",group:"world"},
 {id:"classical",label:"Classical",q:"classical",group:"world"},
 {id:"ru",label:"Русская музыка",q:"русская музыка",group:"ru"},
 {id:"ru-pop",label:"Русский поп",q:"русский поп",group:"ru"},
 {id:"ru-rap",label:"Русский рэп",q:"русский рэп",group:"ru"},
 {id:"ru-rock",label:"Русский рок",q:"русский рок",group:"ru"},
 {id:"ru-alt",label:"Russian music",q:"Russian music",group:"ru"},
 {id:"am",label:"Հայկական երաժշտություն",q:"հայկական",group:"am"},
 {id:"am-pop",label:"Armenian Pop",q:"Armenian pop",group:"am"},
 {id:"am-rap",label:"Armenian Rap",q:"Armenian rap",group:"am"},
 {id:"am-folk",label:"Armenian Folk",q:"Armenian folk",group:"am"},
 {id:"am-alt",label:"Armenian Music",q:"Armenian music",group:"am"}
];
const clean=(x,n=130)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n);
const https=x=>{try{const u=new URL(String(x));return u.protocol==="https:"&&!u.username&&!u.password?u.href:""}catch{return""}};
const normalize=x=>{
 const id=clean(x?.id,120);
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(id)||!clean(x?.title)||x?.is_stream_gated||x?.is_delete||x?.is_unlisted)return null;
 return {id:"audius:"+id,source:"audius",title:clean(x.title),artist:clean(x.user?.name||x.user?.handle||"Audius",100),
 artwork:https(x.artwork?.["480x480"]||x.artwork?.["150x150"]),permalink:https(x.permalink),duration:Math.max(0,Number(x.duration)||0)};
};
const endpoint=(query,offset,limit=LIMIT)=>{
 const u=new URL(API);
 u.searchParams.set("query",query);u.searchParams.set("limit",String(limit));u.searchParams.set("offset",String(offset));
 return u.href;
};
let items=[],q="",offset=0,busy=false,complete=false,active=null,group="world",preset="world";
const status=$("catalogStatus"),list=$("catalogResults"),more=$("catalogMore"),queryInput=$("catalogQuery");
function textNode(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el}
function setStatus(s){status.textContent=s}
function buttons(){
 const box=$("catalogPresets");box.replaceChildren();
 PRESETS.filter(x=>x.group===group).forEach(p=>{
  const b=textNode("button","catalog-pill"+(p.id===preset?" active":""),p.label);
  b.type="button";b.setAttribute("aria-pressed",String(p.id===preset));
  b.onclick=()=>{preset=p.id;queryInput.value=p.q;buttons();search(p.q)};
  box.append(b);
 });
 for(const b of root.querySelectorAll("[data-catalog-group]")){
  const selected=b.dataset.catalogGroup===group;b.classList.toggle("active",selected);b.setAttribute("aria-pressed",String(selected));
 }
}
function trackCard(track,index){
 const row=textNode("article","catalog-track");
 const cover=textNode("div","catalog-cover","♫");
 if(track.artwork){
  const img=textNode("img");img.src=track.artwork;img.loading="lazy";img.alt="";img.onerror=()=>img.remove();cover.append(img);
 }
 const info=textNode("div","catalog-details");
 info.append(textNode("strong","",track.title),textNode("span","",track.artist),textNode("small","","AUDIUS · "+(track.duration?Math.floor(track.duration/60)+":"+String(Math.round(track.duration%60)).padStart(2,"0"):"АУДИО")));
 const play=textNode("button","catalog-play","▶");play.type="button";play.setAttribute("aria-label","Слушать "+track.title);
 play.onclick=()=>V.play(track,items);
 const like=textNode("button","catalog-like","♡");like.type="button";like.title="В избранное";like.setAttribute("aria-label","Добавить в избранное "+track.title);
 like.onclick=()=>{V.toggleLike(track);like.textContent="♥";like.setAttribute("aria-label","Изменить избранное "+track.title)};
 const share=textNode("button","catalog-share","↗");share.type="button";share.title="Отправить в Telegram";
 share.setAttribute("aria-label","Поделиться "+track.title);
 share.onclick=()=>window.VetogramMusicSocial?.shareTrack?.(track);
 row.append(textNode("span","catalog-index",String(index+1).padStart(2,"0")),cover,info,like,share,play);
 return row;
}
function render(){
 list.replaceChildren();
 if(!items.length){list.append(textNode("p","catalog-empty",busy?"Ищем музыку…":"Записей по этому запросу пока нет. Попробуй другой запрос."));return}
 const fragment=document.createDocumentFragment();items.forEach((t,i)=>fragment.append(trackCard(t,i)));list.append(fragment);
}
async function loadMore(){
 if(busy||complete||!q)return;
 busy=true;more.disabled=true;more.hidden=true;
 if(!items.length)render();
 setStatus('Ищем «'+q+'» · Audius…');
 const controller=new AbortController();active=controller;
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(endpoint(q,offset),{signal:controller.signal,credentials:"omit",headers:{Accept:"application/json"}});
  if(!res.ok)throw Error("provider "+res.status);
  if(Number(res.headers.get("content-length")||0)>2000000)throw Error("oversized");
  const text=await res.text();if(text.length>2000000)throw Error("oversized");
  const data=JSON.parse(text);
  if(active!==controller)return;
  if(!Array.isArray(data?.data))throw Error("invalid data");
  const raw=data.data;
  const seen=new Set(items.map(x=>x.id));
  for(const x of raw.map(normalize).filter(Boolean)){
   if(!seen.has(x.id)){items.push(x);seen.add(x.id)}
  }
  offset+=raw.length;
  complete=raw.length<LIMIT||offset>=MAX_RESULTS;
  setStatus(items.length+" записей показано · Audius · "+(complete?"Конец доступной выдачи.":"Можно загрузить ещё.")+" Результаты — не официальные чарты стран.");
  render();
 }catch(err){
  if(active!==controller)return;
  if(items.length)render();else list.replaceChildren(textNode("p","catalog-empty","Источник сейчас недоступен. Попробуй повторить или выбери другой жанр."));
  setStatus(err?.name==="AbortError"?"Превышено время ожидания. Попробуй ещё раз.":"Ошибка загрузки каталога. Уже загруженные записи сохранены.");
 }finally{
  clearTimeout(timer);
  if(active===controller){
   busy=false;more.disabled=false;more.hidden=complete;
   if(!items.length)more.textContent="↻ Повторить";else more.textContent="＋ Показать ещё музыку";
  }
 }
}
function search(term){
 const candidate=clean(term,80);
 if(candidate.length<2){setStatus("Введите минимум 2 символа для поиска");return}
 active?.abort();q=candidate;items=[];offset=0;complete=false;busy=false;queryInput.value=q;
 list.replaceChildren();setStatus("Подключаем музыкальный каталог Audius…");
 more.hidden=true;loadMore();
}
root.querySelectorAll("[data-catalog-group]").forEach(b=>b.onclick=()=>{
 group=b.dataset.catalogGroup;
 const first=PRESETS.find(x=>x.group===group);
 if(!first)return;
 preset=first.id;buttons();search(first.q);
});
$("catalogForm").onsubmit=e=>{e.preventDefault();preset="";buttons();search(queryInput.value)};
more.onclick=loadMore;
document.addEventListener("vetogram:catalog-open",()=>{if(!q){buttons();search(PRESETS[0].q)}});
buttons();
window.VetogramCatalog=Object.freeze({search,loadMore,normalize,endpoint,state:()=>({query:q,count:items.length,offset,complete})});
})();