/* Vetogram Music Social Studio: Telegram sharing, opt-in mix import, queue.
   No unlicensed downloads, no scraping, no auto sharing of private files. */
(()=>{
"use strict";
const api=window.VetogramMusic, host=window.Telegram?.WebApp, $=id=>document.getElementById(id);
if(!api)return;
const TARGET_ORIGIN="https://vetogram-music-live.vercel.app/";
const clean=(s,max=90)=>String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/[<>]/g,"").trim().slice(0,max);
const safe=(url)=>{try{const u=new URL(String(url));return u.protocol==="https:"?u.href:""}catch{return""}};
const create=(t,c,v)=>{const x=document.createElement(t);if(c)x.className=c;if(v!==undefined)x.textContent=String(v);return x};
const toast=msg=>{const t=$("globalToast");if(!t)return;t.textContent=msg;t.classList.add("visible");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("visible"),4200)};
const inlineUrl=(url,text)=>"https://t.me/share/url?url="+encodeURIComponent(url)+"&text="+encodeURIComponent(text);
const validName=x=>clean(x,100).replace(/[\r\n]/g," ");
const canSendFile=file=>!!(navigator.canShare&&navigator.share&&navigator.canShare({files:[file]}));
function telegramShare(url,text){
 const share=inlineUrl(url,text);
 try{
  if(host?.initData&&typeof host.openTelegramLink==="function"){host.openTelegramLink(share);return}
 }catch{}
 window.open(share,"_blank","noopener,noreferrer");
}
function b64enc(str){
 const bytes=new TextEncoder().encode(str);
 let bin="";for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
 return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function b64dec(str){
 if(!/^[\w-]{1,1900}$/.test(str))throw Error("Некорректная ссылка");
 const bin=atob(str.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-str.length%4)%4));
 const bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
function compact(rows){
 const result=[],seen=new Set();
 for(const row of rows||[]){
  const artist=validName(row.artist),title=validName(row.title);
  if(!artist||!title)continue;
  const id=(artist+"|"+title).toLocaleLowerCase();
  if(seen.has(id))continue;
  seen.add(id);result.push([artist,title]);if(result.length>=100)break;
 }
 return result;
}
function mixShareURL(rows){
 const items=compact(rows);
 if(!items.length)throw Error("В медиатеке нет названий для ссылки");
 // Cap URLs to suit Telegram link-handling clients. Full collections use JSON exports.
 let amount=Math.min(items.length,14),url="";
 do{
  const param=b64enc(JSON.stringify({v:1,t:items.slice(0,amount)}));
  url=TARGET_ORIGIN+"?mix="+param;
  if(url.length<=1700)break;amount--;
 }while(amount>0);
 if(!amount)throw Error("Слишком длинные названия для ссылки");
 return {url,count:amount,total:items.length};
}
function decodeMix(param){
 const body=JSON.parse(b64dec(param));
 if(body?.v!==1||!Array.isArray(body.t)||body.t.length>25)throw Error("Неподдерживаемый формат плейлиста");
 const rows=[];
 for(const entry of body.t){
  if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=="string"||typeof entry[1]!=="string"||
     entry[0].length>100||entry[1].length>100)throw Error("Некорректные поля песни");
  rows.push({artist:validName(entry[0]),title:validName(entry[1])});
 }
 if(!rows.length)throw Error("Список пуст");
 return rows;
}
function showDialog(title,message,onConfirm,buttonLabel="Импортировать"){
 const overlay=$("socialModal");
 if(!overlay)return;
 $("socialHeading").textContent=title;$("socialText").textContent=message;
 const confirm=$("socialConfirm");
 confirm.textContent=buttonLabel;confirm.onclick=()=>{
  closeDialog();onConfirm?.();
 };
 overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");$("socialDismiss").focus();
}
function closeDialog(){
 $("socialModal")?.classList.remove("open");
 $("socialModal")?.setAttribute("aria-hidden","true");
}
$("socialDismiss").onclick=closeDialog;
$("socialModal").addEventListener("click",event=>{if(event.target===$("socialModal"))closeDialog()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&$("socialModal").classList.contains("open"))closeDialog()});
async function shareLocal(track){
 const local=api.local().find(x=>x.id===track.id);
 if(!local?.blob){toast("Локальный файл доступен только на устройстве, где он добавлен");return}
 const filename=validName(local.artist+" — "+local.title).replace(/[\/\\:*?"<>|]/g,"_")+".mp3";
 const mime=local.blob.type||"audio/mpeg";
 const ext=(local.blob.name||"").match(/\.(mp3|m4a|wav|aac|ogg|flac|opus)$/i)?.[0]||"";
 const file=new File([local.blob],validName(local.title)+(ext||".mp3"),{type:mime});
 if(canSendFile(file)){
  try{await navigator.share({files:[file],title:local.title,text:"Моя музыка — Vetogram Music"});
      toast("Файл передан в системное меню отправки — выбери Telegram");return}
  catch(e){if(e?.name==="AbortError")return}
 }
 showDialog("Отправка аудиофайла",
  "Здесь браузер не поддерживает отправку файла в Telegram напрямую. Можно поделиться названием песни или сохранить исходный файл и отправить его в чате Telegram. Личные файлы не публикуются на нашем сервере.",
  ()=>telegramShare(TARGET_ORIGIN,local.artist+" — "+local.title+" · Слушаю в Vetogram Music"),"Поделиться названием");
}
function shareTrack(track){
 if(!track)return toast("Выбери запись");
 if(track.source==="local")return shareLocal(track);
 if(track.source==="audius"){
  const id=String(track.id||"").replace(/^audius:/,"");
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return toast("Не удалось создать ссылку на трек");
  const deeplink=TARGET_ORIGIN+"?track="+encodeURIComponent(id);
  telegramShare(deeplink,"♫ "+validName(track.artist)+" — "+validName(track.title)+" · Слушать в Vetogram Music");
  return;
 }
 if(track.source==="radio"){
  const homepage=safe(track.homepage)||TARGET_ORIGIN;
  telegramShare(homepage,"◉ "+validName(track.title)+" · Радио в Vetogram Music");
  return;
 }
 telegramShare(TARGET_ORIGIN,validName(track.artist)+" — "+validName(track.title)+" · Vetogram Music");
}
$("shareTrack").onclick=()=>shareTrack(api.now());
function sharePlaylist(){
 const all=api.metadata().concat(api.liked(),api.local()).filter(x=>x?.artist&&x?.title);
 try{
  const mix=mixShareURL(all);
  const note="♡ Мой плейлист Vetogram Music ("+mix.count+
    (mix.total>mix.count?" из "+mix.total+" треков, остальные доступны в JSON-файле":" треков")+")";
  telegramShare(mix.url,note);
 }catch(e){toast(e.message)}
}
function exportAll(){
 const entries=compact(api.metadata().concat(api.liked(),api.local()));
 if(!entries.length)return toast("Нет песен для экспорта");
 const data={format:"vetogram-music-metadata-v2",version:2,tracks:entries.map(([artist,title])=>({artist,title}))};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const filename="vetogram-music-playlist.json",file=new File([blob],filename,{type:"application/json"});
 if(canSendFile(file)){
  navigator.share({files:[file],title:"Мой плейлист Vetogram Music"}).catch(e=>{if(e?.name!=="AbortError")download(blob,filename)});
 }else download(blob,filename);
}
function download(blob,name){
 const url=URL.createObjectURL(blob);
 const a=create("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
 toast("Файл плейлиста скачан. Это названия, не сами MP3.");
}
$("sharePlaylist").onclick=sharePlaylist;
$("shareAllFile").onclick=exportAll;
$("shareInvite").onclick=()=>telegramShare(TARGET_ORIGIN,"♫ Попробуй Vetogram Music — свои треки, радио, поиск и музыкальная библиотека.");
$("shareQuick").onclick=()=>shareTrack(api.now());
function renderQueue(){
 const target=$("socialQueue");if(!target)return;target.replaceChildren();
 const tracks=api.queue();
 if(!tracks.length){target.append(create("div","social-empty","Выбери трек — здесь появится очередь."));return}
 const current=api.now()?.id;
 for(let i=0;i<Math.min(tracks.length,30);i++){
  const t=tracks[i],row=create("div","social-q-row"+(t.id===current?" active":""));
  row.append(create("span","social-q-num",String(i+1).padStart(2,"0")));
  const label=create("div","social-q-title");label.append(create("strong","",t.title),create("small","",t.artist));
  const play=create("button","social-q-play",t.id===current?"♫":"▶");
  play.type="button";play.setAttribute("aria-label","Слушать "+t.title);
  play.onclick=()=>{api.play(t,tracks);renderQueue()};
  const share=create("button","social-q-share","↗");
  share.type="button";share.title="Отправить в Telegram";share.setAttribute("aria-label","Поделиться "+t.title);
  share.onclick=()=>shareTrack(t);
  row.append(label,play,share);target.append(row);
 }
}
$("queueToggle").onclick=()=>{
 const box=$("queuePanel");
 const open=!box.classList.contains("open");
 box.classList.toggle("open",open);$("queueToggle").setAttribute("aria-expanded",String(open));
 if(open)renderQueue();
};
$("queueClose").onclick=()=>{$("queuePanel").classList.remove("open");$("queueToggle").setAttribute("aria-expanded","false")};
document.getElementById("audio")?.addEventListener("play",renderQueue);
document.addEventListener("vetogram:library-change",renderQueue);
function installSharePreview(){
 const params=new URLSearchParams(location.search);
 const mix=params.get("mix"),track=params.get("track");
 if(mix){
  try{
   const rows=decodeMix(mix);
   showDialog("Тебе поделились плейлистом",
    rows.slice(0,4).map(x=>x.artist+" — "+x.title).join("\n")+
    (rows.length>4?"\n… и ещё "+(rows.length-4):"")+
    "\n\nСохраним названия в «Моя музыка». Самих аудиофайлов в этой ссылке нет.",
    ()=>{api.importList(rows.map(x=>x.artist+" — "+x.title).join("\n"),"text");api.showPage("library");},"Добавить "+rows.length+" треков");
  }catch{toast("Полученная ссылка на плейлист повреждена или устарела")}
 }else if(track&&/^[a-zA-Z0-9_-]{1,100}$/.test(track)){
  showDialog("Тебе поделились музыкой",
   "Друг прислал трек из Audius. Откроем его в Vetogram Music, если он доступен у провайдера.",
   async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
    try{
     const response=await fetch("https://api.audius.co/v1/tracks/"+encodeURIComponent(track),{signal:controller.signal,credentials:"omit"});
     if(!response.ok)throw Error("Недоступный трек");
     const data=await response.json(),x=data?.data;
     if(!x?.id||!x?.title||x.is_stream_gated||x.is_delete)throw Error("Трек недоступен");
     const song={id:"audius:"+clean(x.id,100),title:clean(x.title),artist:clean(x.user?.name||x.user?.handle),
       artwork:safe(x.artwork?.["480x480"]||x.artwork?.["150x150"]),permalink:safe(x.permalink),source:"audius"};
     api.play(song,[song]);
    }catch{toast("Не удалось загрузить этот трек. Попробуй поиск.")}finally{clearTimeout(timeout)}
   },"Открыть трек");
 }
}
installSharePreview();
window.VetogramMusicSocial=Object.freeze({shareTrack,mixShareURL,decodeMix,sharePlaylist,exportAll});
})();
