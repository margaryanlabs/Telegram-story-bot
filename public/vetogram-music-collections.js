/* Vetogram Music Collections. Standalone user-owned playlist metadata.
   No cloud upload or copying of licensed streams. */
(()=>{
"use strict";
const V=window.VetogramMusic,S=window.VetogramMusicSocial;
if(!V||!S)return;
const KEY="vetogram-personal-mixes-v1",MAX=25,MAX_TRACKS=120;
const $=id=>document.getElementById(id);
const el=(tag,klass,text)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(text!==undefined)n.textContent=String(text);return n};
const cap=(s,max=100)=>String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const safe=u=>{try{const x=new URL(String(u));return x.protocol==="https:"?x.href:""}catch{return""}};
const pick=x=>x&&x.id&&x.title?{
 id:cap(x.id,160),title:cap(x.title,120),artist:cap(x.artist,95),
 source:["audius","radio","local","demo","metadata","stream","archive","ccmixter"].includes(x.source)?x.source:"metadata",
 artwork:safe(x.artwork),stream:["radio","stream","archive","ccmixter"].includes(x.source)?safe(x.stream):"",homepage:x.source==="radio"?safe(x.homepage):""
}:null;
let lists=[];
try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(v))lists=v.slice(0,MAX).filter(p=>p&&typeof p.name==="string"&&Array.isArray(p.tracks)).map(p=>({
 id:cap(p.id,80),name:cap(p.name,60),tracks:p.tracks.slice(0,MAX_TRACKS).map(pick).filter(Boolean)
}))}catch{}
let selected=lists[0]?.id||"";
function toast(text){const t=$("globalToast");t.textContent=text;t.classList.add("visible");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("visible"),4000)}
function save(n){try{localStorage.setItem(KEY,JSON.stringify(n));lists=n;return true}catch{toast("Браузер не сохранил изменения");return false}}
function btn(text,klass,fn){const e=el("button",klass,text);e.type="button";e.onclick=fn;return e}
function available(t){
 if(t.source==="local")return V.local().find(x=>x.id===t.id)||null;
 if(["radio","stream","archive","ccmixter"].includes(t.source)&&!t.stream)return V.queue().find(x=>x.id===t.id&&x.stream)||null;
 return t.source==="metadata"?null:t;
}
function getSources(){
 const seen=new Set();
 return [V.now(),...V.queue(),...V.local(),...V.liked(),...V.metadata()].map(pick).filter(x=>{
  if(!x||seen.has(x.id))return false;seen.add(x.id);return true
 });
}
function create(){
 if(lists.length>=MAX)return toast("Максимум 25 плейлистов");
 const name=prompt("Как назовём плейлист?","Мой вайб");
 if(name===null)return;
 const title=cap(name,60);if(!title)return toast("Название не может быть пустым");
 const one={id:"vm:"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),name:title,tracks:[]};
 if(save([one,...lists])){selected=one.id;draw();toast("Новый плейлист создан")}
}
function add(id,raw){
 const p=lists.find(x=>x.id===id),t=pick(raw);if(!p||!t)return;
 if(p.tracks.some(x=>x.id===t.id))return toast("Этот трек уже добавлен");
 if(p.tracks.length>=MAX_TRACKS)return toast("Максимум 120 треков");
 if(save(lists.map(x=>x.id===id?{...x,tracks:x.tracks.concat(t)}:x))){selected=id;draw();toast("Добавлено в плейлист")}
}
function choose(options,title){
 const overlay=el("div","vmc-overlay");overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
 const card=el("div","vmc-dialog"),top=el("div","vmc-top");
 top.append(el("h3","",title),btn("×","vmc-close",()=>overlay.remove()));
 const list=el("div","vmc-options");
 if(!options.length)list.append(el("p","","Пока нечего добавить."));
 options.slice(0,100).forEach(x=>list.append(btn(x.name,"vmc-option",()=>{x.run();overlay.remove()})));
 card.append(top,list);overlay.append(card);document.body.append(overlay);
 overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
}
function chooserForTrack(track){
 if(!track)return toast("Сначала включи музыку");
 if(!lists.length){create();if(lists.length)add(lists[0].id,track);return}
 choose(lists.map(p=>({name:p.name+" · "+p.tracks.length+" треков",run:()=>add(p.id,track)})),"Добавить в плейлист");
}
function chooseTrack(p){
 const candidates=getSources().filter(x=>!p.tracks.some(y=>y.id===x.id));
 choose(candidates.map(t=>({name:t.title+" · "+t.artist,run:()=>add(p.id,t)})),"Выбрать музыку");
}
function play(p,id){
 const playable=p.tracks.map(available).filter(Boolean);
 if(!playable.length)return toast("Доступных аудиофайлов нет. Названия нельзя автоматически воспроизвести.");
 V.play(playable.find(x=>x.id===id)||playable[0],playable);
}
function share(p){
 try{
  // Existing music sharing module produces an opt-in importable *metadata-only* link.
  const data=S.mixShareURL(p.tracks);
  const text="♫ Плейлист «"+p.name+"» · Vetogram Music";
  const link="https://t.me/share/url?url="+encodeURIComponent(data.url)+"&text="+encodeURIComponent(text);
  if(window.Telegram?.WebApp?.initData&&window.Telegram.WebApp.openTelegramLink)window.Telegram.WebApp.openTelegramLink(link);
  else window.open(link,"_blank","noopener,noreferrer");
 }catch(e){toast(e.message||"Нет записей для отправки")}
}
const root=el("section","vmc-section");root.id="vmcSection";
const head=el("div","vmc-head"),intro=el("div");
intro.append(el("small","vmc-kicker","YOUR COLLECTION / MUSIC ONLY"),el("h2","","Мои плейлисты"),
 el("p","","Своя музыка, свои подборки, своя волна. Делись названиями и доступными треками с друзьями."));
head.append(intro,btn("＋ Новый плейлист","vmc-primary",create));root.append(head);
const cards=el("div","vmc-cards");const content=el("div","vmc-content");root.append(cards,content);
const target=document.querySelector('[data-view="library"] .library-stats');
if(target)target.insertAdjacentElement("afterend",root);
const home=el("div","vmc-home");
home.append(el("small","vmc-kicker","COLLECT · SHARE · LISTEN"),el("strong","","Собери свой музыкальный мир."),
 el("p","","Персональные подборки для твоих вечеров, дорог и друзей."),
 btn("Мои плейлисты ↗","vmc-primary",()=>{V.showPage("library");root.scrollIntoView({behavior:"smooth",block:"start"})}));
document.querySelector('[data-view="home"] .feature-strip')?.insertAdjacentElement("afterend",home);
document.querySelector(".studio-actions")?.append(btn("＋ В плейлист","vmc-studio-add",()=>chooserForTrack(V.now())));
function draw(){
 cards.replaceChildren();content.replaceChildren();
 if(!lists.length)cards.append(el("div","vmc-empty","Тут появится первый плейлист. Нажми «＋ Новый плейлист»."));
 lists.forEach((p,i)=>{
  const b=btn("","vmc-card"+(p.id===selected?" active":""),()=>{selected=p.id;draw()});
  b.append(el("small","",String(i+1).padStart(2,"0")+" / PLAYLIST"),el("strong","",p.name),
   el("span","",p.tracks.length+" треков"),el("i","","♫"));cards.append(b);
 });
 const p=lists.find(x=>x.id===selected);if(!p)return;
 const top=el("div","vmc-content-head"),copy=el("div");
 copy.append(el("small","vmc-kicker","CURRENT MIX"),el("h3","",p.name),el("p","",p.tracks.length+" треков"));
 const buttons=el("div","vmc-actions");
 buttons.append(btn("▶ Слушать","vmc-primary",()=>play(p)),btn("＋ Добавить","vmc-secondary",()=>chooseTrack(p)),
 btn("↗ Telegram","vmc-secondary",()=>share(p)),btn("×","vmc-danger",()=>{
  if(confirm("Удалить плейлист «"+p.name+"»?")&&save(lists.filter(x=>x.id!==p.id))){selected=lists[0]?.id||"";draw()}
 }));
 top.append(copy,buttons);content.append(top);
 if(!p.tracks.length)content.append(el("div","vmc-empty","Добавь свой первый трек. Списки VK/Яндекса сохраняются как названия, без MP3."));
 p.tracks.forEach((t,i)=>{
  const row=el("div","vmc-track"),info=el("div","vmc-track-info");
  info.append(el("b","",t.title),el("small","",t.artist+(t.source==="metadata"?" · только название":t.source==="local"?" · свой файл":"")));
  const control=el("div","vmc-track-controls");
  control.append(btn(available(t)?"▶":"⌕","vmc-icon",()=>{
    if(available(t))play(p,t.id);
    else {V.showPage("search");$("searchInput").value=t.artist+" "+t.title;V.search($("searchInput").value)}
  }),btn("×","vmc-icon",()=>{
    if(save(lists.map(x=>x.id===p.id?{...x,tracks:x.tracks.filter(q=>q.id!==t.id)}:x)))draw()
  }));
  row.append(el("span","vmc-index",String(i+1).padStart(2,"0")),info,control);content.append(row);
 });
}
document.addEventListener("vetogram:library-change",draw);
draw();
window.VetogramCollections=Object.freeze({list:()=>lists.map(p=>({name:p.name,count:p.tracks.length})),add,play,share,chooseForTrack:chooserForTrack});
})();