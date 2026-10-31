/* Vetogram Music — single provider Charts. Product paused: no country playlists or services.
 * Ranks come ONLY from Audius Trending API, never fake global charts. */
(()=>{
"use strict";
const api=window.VetogramMusic,share=window.VetogramMusicSocial;
const root=document.querySelector('[data-view="charts"]');
if(!api||!root)return;
const $=id=>document.getElementById(id);
const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const clean=(v,n=115)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n);
const https=(url)=>{try{const p=new URL(String(url));return p.protocol==="https:"?p.href:""}catch{return""}};
const periods=["week","month","year","allTime"];
let period="week",genre="all",items=[],running=null,lastKey="",lastAt=0;
function endpoint(){
 const u=new URL("https://api.audius.co/v1/tracks/trending");
 u.searchParams.set("limit","30");
 u.searchParams.set("time",period);
 if(genre!=="all")u.searchParams.set("genre",genre);
 return u.href;
}
function fromAudius(x){
 if(!x?.id||!x?.title||x.is_stream_gated||x.is_delete||x.is_unlisted)return null;
 const id=clean(x.id,100);if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return null;
 return {id:"audius:"+id,source:"audius",title:clean(x.title),artist:clean(x.user?.name||x.user?.handle||"Audius"),
   artwork:https(x.artwork?.["480x480"]||x.artwork?.["150x150"]),permalink:https(x.permalink)||"https://audius.co/"};
}
function render(){
 const target=$("chartsTracks");target.replaceChildren();
 if(!items.length){target.append(make("div","chart-empty","Рейтинг пока недоступен. Попробуй обновить."));return}
 for(let i=0;i<items.length;i++){
  const item=items[i],card=make("article","chart-track");
  card.append(make("span","chart-rank",String(i+1).padStart(2,"0")));
  const art=make("div","chart-art");
  if(item.artwork){const img=make("img");img.loading="lazy";img.src=item.artwork;img.alt="";img.onerror=()=>img.remove();art.append(img)}
  art.append(make("span","chart-art-fallback","♫"));
  const body=make("div","chart-track-info");body.append(make("b","",item.title),make("small","",item.artist));
  const tag=make("div","chart-tags");tag.append(make("span","","AUDIUS"));body.append(tag);
  const play=make("button","chart-play","▶");play.type="button";play.setAttribute("aria-label","Слушать "+item.title);
  play.onclick=()=>api.play(item,items);
  const send=make("button","chart-share","↗");send.type="button";send.setAttribute("aria-label","Поделиться "+item.title);
  send.onclick=()=>share?.shareTrack?.(item);
  card.append(art,body,play,send);target.append(card);
 }
}
async function load(force=false){
 const key=period+"|"+genre;
 if(!force&&key===lastKey&&Date.now()-lastAt<300000){render();return}
 running?.abort();const controller=new AbortController();running=controller;
 const timer=setTimeout(()=>controller.abort(),11500);
 $("chartsStatus").textContent="Загружаем рейтинг Audius…";
 try{
  const res=await fetch(endpoint(),{signal:controller.signal,credentials:"omit",headers:{Accept:"application/json"}});
  if(!res.ok)throw Error("HTTP "+res.status);
  const data=await res.json();
  if(running!==controller)return;
  if(!Array.isArray(data?.data))throw Error("Неверный ответ Audius");
  items=data.data.map(fromAudius).filter(Boolean);
  lastKey=key;lastAt=Date.now();
  $("chartsStatus").textContent="Audius Trending · "+items.length+" треков. Это рейтинг Audius.";
  render();
 }catch(err){
  if(running!==controller)return;
  items=[];$("chartsStatus").textContent=err?.name==="AbortError"?"Время ожидания истекло.":"Рейтинг Audius сейчас недоступен.";
  render();
 }finally{clearTimeout(timer)}
}
function highlight(selector,key,value){
 for(const button of root.querySelectorAll(selector)){
  const active=button.dataset[key]===value;
  button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
 }
}
root.querySelectorAll("[data-chart-period]").forEach(b=>b.onclick=()=>{
 if(!periods.includes(b.dataset.chartPeriod))return;
 period=b.dataset.chartPeriod;highlight("[data-chart-period]","chartPeriod",period);load();
});
root.querySelectorAll("[data-chart-genre]").forEach(b=>b.onclick=()=>{
 genre=b.dataset.chartGenre;highlight("[data-chart-genre]","chartGenre",genre);load();
});
$("chartsRefresh").onclick=()=>load(true);
document.addEventListener("vetogram:charts-open",()=>load());
window.VetogramCharts=Object.freeze({open:()=>load(),state:()=>({period,genre,count:items.length})});
})();