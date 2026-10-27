/* VETOGRAM Music Originals — verified official YouTube uploads in a visible player.
 * Uses no ripped audio, hidden playback, proxying, autoplay, or YouTube API keys.
 * A video being public does not promise embedding is available in every region.
 */
(()=>{
"use strict";
const app=window.VetogramMusic,root=document.querySelector('[data-view="originals"]');
if(!app||!root)return;
const SONGS=Object.freeze([
 {id:"y14ulAguQv4",artist:"MACAN",title:"ASPHALT 8",language:"ru",publisher:"GOLDEN SOUND · MACAN - Topic"},
 {id:"plXH4GeYtes",artist:"Sirusho",title:"Zartonk · Զարթոնք",language:"hy",publisher:"Sirusho · официальный канал"},
 {id:"TPjN6N8TgNI",artist:"Super Sako feat. Hayko",title:"Mi Gna · Մի գնա",language:"hy",publisher:"Super Sako · официальный канал"},
 {id:"4NRXx6U8ABQ",artist:"The Weeknd",title:"Blinding Lights",language:"en",publisher:"The Weeknd · официальный клип"},
 {id:"V9PVRfjEBTI",artist:"Billie Eilish",title:"BIRDS OF A FEATHER",language:"en",publisher:"Billie Eilish · официальный клип"},
 {id:"N000qglmmY0",artist:"Dua Lipa",title:"Levitating · Animated Video",language:"en",publisher:"Dua Lipa · официальный клип"},
 {id:"JGwWNGJdvx8",artist:"Ed Sheeran",title:"Shape of You",language:"en",publisher:"Ed Sheeran · официальный клип"}
]);
const $=id=>document.getElementById(id),make=(tag,cls,t)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(t!==undefined)el.textContent=t;return el};
const watch=id=>"https://www.youtube.com/watch?v="+id;
const emb=id=>"https://www.youtube-nocookie.com/embed/"+id+"?rel=0&playsinline=1";
let active="";let group="all";let query="";
function filterSongs(){return SONGS.filter(s=>(group==="all"||s.language===group)&&(!query||(s.title+" "+s.artist+" "+s.publisher).toLowerCase().includes(query)))}
function stop(){const holder=$("originalsFrame");holder.replaceChildren(make("div","originals-stage-empty","Выбери оригинальный трек. Воспроизведение начнётся только после твоего нажатия Play в официальном видеоплеере YouTube."));active="";$("originalsWatching").textContent="Ничего не воспроизводится"}
function open(song){
 document.getElementById("audio")?.pause();
 if(active===song.id)return;
 active=song.id;
 const frame=make("iframe","originals-iframe");
 frame.src=emb(song.id);
 frame.title=song.artist+" — "+song.title+" · YouTube";
 frame.loading="eager";
 frame.allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
 frame.allowFullscreen=true;
 frame.referrerPolicy="strict-origin-when-cross-origin";
 $("originalsFrame").replaceChildren(frame);
 $("originalsWatching").textContent=song.artist+" — "+song.title+" · YouTube";
 $("originalsOpen").href=watch(song.id);
 $("originalsOpen").hidden=false;
 $("originalsPlayer").scrollIntoView({behavior:"smooth",block:"nearest"});
 // The YouTube player remains fully visible; it is never a hidden audio player.
}
function render(){
 const list=$("originalsList");list.replaceChildren();
 const songs=filterSongs();$("originalsCount").textContent=songs.length+" проверенных публикаций";
 if(!songs.length){list.append(make("p","originals-empty","Ничего не найдено. Измени запрос или регион."));return}
 for(const song of songs){
  const card=make("article","originals-card");const thumb=make("img","originals-image");
  thumb.src="https://i.ytimg.com/vi/"+song.id+"/hqdefault.jpg";thumb.alt="";
  thumb.loading="lazy";
  const details=make("div","originals-details");
  details.append(make("small","",song.publisher),make("strong","",song.title),make("span","",song.artist));
  const actions=make("div","originals-actions");
  const button=make("button","originals-play","▶ Смотреть / слушать");
  button.type="button";button.onclick=()=>open(song);
  const link=make("a","originals-link","YouTube ↗");link.href=watch(song.id);
  link.target="_blank";link.rel="noopener noreferrer";link.setAttribute("aria-label","Открыть оригинал "+song.title+" на YouTube");
  actions.append(button,link);details.append(actions);
  card.append(thumb,details);list.append(card);
 }
}
root.querySelectorAll("[data-originals-group]").forEach(b=>b.addEventListener("click",()=>{
 group=b.dataset.originalsGroup;
 for(const el of root.querySelectorAll("[data-originals-group]")){const selected=el.dataset.originalsGroup===group;el.classList.toggle("active",selected);el.setAttribute("aria-pressed",String(selected))}
 render();
}));
$("originalsSearch").addEventListener("input",e=>{query=String(e.target.value||"").trim().toLowerCase().slice(0,80);render()});
$("originalsClose").onclick=()=>{stop();$("originalsOpen").hidden=true};
$("originalsOpen").hidden=true;
$("originalsFrame").replaceChildren(make("div","originals-stage-empty","Выбери оригинальный трек, чтобы открыть официальный видеоплеер."));
render();
window.VetogramOriginals=Object.freeze({list:()=>SONGS.map(({id,artist,title,language})=>({id,artist,title,language})),openById:(id)=>{const s=SONGS.find(x=>x.id===id);if(s){app.showPage("originals");open(s);return true}return false}});
})();
