/* Share user-owned audio from the Mini App to an OS share sheet.
 * No bot token, no remote uploads, no protected third-party stream extraction.
 * Telegram native audio playback is available once the user sends the file there;
 * Web Share is supported only in some browsers/WebViews.
 */
(()=>{
"use strict";
const music=window.VetogramMusic;
const sel=document.getElementById("telegramAudioSelect");
const button=document.getElementById("telegramShareAudio");
const status=document.getElementById("telegramAudioStatus");
if(!music||!sel||!button||!status)return;
const allowed=["audio/mpeg","audio/mp3","audio/mp4","audio/x-m4a","audio/m4a"];
function identify(track){
 if(track?.source!=="local"||!(track.blob instanceof Blob))return null;
 const file=track.blob;
 const type=String(file.type||"").toLowerCase();
 const original=typeof file.name==="string"?file.name:"";
 const ext=original.toLowerCase().endsWith(".m4a")||type.includes("mp4")||type.includes("m4a")?".m4a":".mp3";
 if(type&&!allowed.includes(type))return null;
 if(original&&!/\.(mp3|m4a)$/i.test(original))return null;
 if(!Number.isFinite(file.size)||file.size<=0||file.size>30*1024*1024)return null;
 const fallback=String(track.artist||"Моя музыка")+" - "+String(track.title||"Трек");
 const safe=(original||fallback+ext).replace(/[\\/:*?"<>|\u0000-\u001f]/g," ").trim().slice(0,120);
 return new File([file],safe.toLowerCase().endsWith(ext)?safe:safe+ext,{type:ext===".m4a"?"audio/mp4":"audio/mpeg"});
}
function eligible(){return music.local().filter(x=>identify(x))}
function update(){
 const before=sel.value;
 sel.replaceChildren();
 const tracks=eligible();
 if(!tracks.length){
  const opt=document.createElement("option");opt.value="";opt.textContent="Добавь свой MP3 или M4A";sel.append(opt);
  button.disabled=true;
  return;
 }
 const playing=music.now()?.id;
 for(const t of tracks.slice(0,200)){
  const opt=document.createElement("option");opt.value=t.id;opt.textContent=String(t.artist||"")+" — "+String(t.title||"");
  sel.append(opt);
 }
 sel.value=tracks.some(t=>t.id===before)?before:tracks.some(t=>t.id===playing)?playing:tracks[0].id;
 button.disabled=false;
}
function message(s){status.textContent=s}
function download(file){
 const url=URL.createObjectURL(file);
 const a=document.createElement("a");a.href=url;a.download=file.name;a.style.display="none";
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),12000);
 message("Файл сохранён через браузер. Открой Telegram и отправь этот MP3/M4A в личный чат музыкального бота после его подключения.");
}
button.onclick=async()=>{
 const track=music.local().find(x=>x.id===sel.value);
 const file=identify(track);
 if(!file){message("Выбранный MP3/M4A больше недоступен. Добавь файл заново.");update();return}
 button.disabled=true;
 try{
  if(typeof navigator.share==="function"&&typeof navigator.canShare==="function"&&navigator.canShare({files:[file]})){
   await navigator.share({files:[file],title:track.artist+" — "+track.title});
   message("Открылось системное меню. Выбери Telegram и отправь файл в нужный чат; дальнейшее воспроизведение происходит в Telegram.");
  }else download(file);
 }catch(e){
  if(e?.name==="AbortError")message("Отправка отменена. Файл остаётся в твоей библиотеке.");
  else download(file);
 }finally{button.disabled=false}
};
document.addEventListener("vetogram:library-change",update);
document.querySelectorAll('[data-page="library"]').forEach(b=>b.addEventListener("click",()=>setTimeout(update,100)));
update();
window.VetogramTelegramShare=Object.freeze({identify,update});
})();
