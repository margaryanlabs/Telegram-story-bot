/* Vetogram Music Direct Audio · user-provided HTTPS media and M3U catalog.
   This module never searches for ripped media, scrapes providers, or proxies bytes. */
(()=>{
"use strict";
const api=window.VetogramMusic,$=id=>document.getElementById(id);
if(!api||!$("directForm"))return;
const MAX_CHARS=160000,MAX_ITEMS=150;
const clean=(s,n=120)=>String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,n);
const denyHosts=/(^|\.)((vk\.com)|(vk\.ru)|(music\.yandex\.(ru|com))|(youtube\.com)|(youtu\.be)|(youtube-nocookie\.com)|(soundcloud\.com)|(spotify\.com)|(open\.spotify\.com)|(music\.apple\.com))$/i;
function checkUrl(raw){
 let u;
 try{u=new URL(String(raw).trim());}catch{throw Error("Некорректная HTTPS-ссылка")}
 if(u.protocol!=="https:")throw Error("Нужна HTTPS-ссылка на аудиофайл");
 if(u.username||u.password||u.hash)throw Error("Адрес не должен содержать логин, пароль или фрагмент");
 if(denyHosts.test(u.hostname))throw Error("Это адрес страницы музыкального сервиса, а не прямой аудиофайл");
 if(/(?:^|\/)(?:localhost|127\.0\.0\.1)(?:\/|$)/i.test(u.hostname)||u.hostname==="localhost"||
 /^(127|10|169\.254|192\.168)\.\d+\.\d+\.\d+$/.test(u.hostname) ||
 /^172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+$/.test(u.hostname)||
 u.hostname.endsWith(".local")||u.hostname==="[::1]")
  throw Error("Локальные сетевые адреса не поддерживаются");
 if(/\.(m3u8?|mpd|html?|php)$/i.test(u.pathname))
  throw Error("Это плейлист/веб-страница, а не прямая аудиозапись");
 if(u.href.length>1200)throw Error("Слишком длинная ссылка");
 return u.href;
}
function guessedTitle(url){
 try{return clean(decodeURIComponent(new URL(url).pathname.split("/").pop()||"Аудиозапись")
   .replace(/\.(mp3|m4a|wav|ogg|opus|aac|flac)$/i,"").replace(/[_-]/g," "),120)||"Аудиозапись";}
 catch{return "Аудиозапись"}
}
function fromLine(line,number,artist="Моя музыка",title=""){
 const link=checkUrl(line),name=clean(title||guessedTitle(link),120),who=clean(artist,80);
 return {title:name||"Трек "+number,artist:who||"Моя музыка",stream:link};
}
function parseM3u(input){
 const text=String(input??"").replace(/^\uFEFF/,"").trim();
 if(!text||text.length>MAX_CHARS)throw Error("M3U пустой или превышает 160 КБ");
 const lines=text.split(/\r?\n/);
 if(lines.length>3000)throw Error("Слишком много строк");
 if(lines.some(x=>/^#EXT-X-/i.test(x.trim())))throw Error("Поток HLS/M3U8 не является списком отдельных песен");
 const rows=[];let currentTitle="",currentArtist="";
 for(const value of lines){
  const line=value.trim();
  if(!line)continue;
  if(/^#EXTINF:/i.test(line)){
   const label=line.slice(line.indexOf(",")+1).trim();
   // Artist / title are metadata from the user's playlist, never trusted HTML.
   const m=label.match(/^(.{1,80}?)\s+(?:—|–|-)\s+(.{1,120})$/);
   currentArtist=m?clean(m[1],80):"Моя музыка";
   currentTitle=m?clean(m[2],120):clean(label,120);
   continue;
  }
  if(line[0]==="#")continue;
  try{
   rows.push(fromLine(line,rows.length+1,currentArtist,currentTitle));
  }catch{/* Drop unsupported and private URLs without preventing import of others. */}
  currentTitle="";currentArtist="";
  if(rows.length>=MAX_ITEMS)break;
 }
 const dedup=new Map();
 for(const row of rows)if(!dedup.has(row.stream))dedup.set(row.stream,row);
 if(!dedup.size)throw Error("Не найдено прямых HTTPS-аудиоссылок. Формат: #EXTINF:-1,Artist — Song, затем https://.../track.mp3");
 return [...dedup.values()];
}
function message(msg,error=false){
 const t=$("directStatus");t.textContent=msg;t.classList.toggle("error",error);
}
$("directForm").onsubmit=e=>{
 e.preventDefault();
 try{
  const url=checkUrl($("directUrl").value);
  const count=api.addStreams([fromLine(url,1,$("directArtist").value||"Моя музыка",$("directTitle").value)]);
  if(!count){message("Этот аудиофайл уже добавлен или память заполнена.",true);return}
  message("Аудиоссылка добавлена в «Моя музыка». Открой библиотеку и нажми ▶.");
  $("directForm").reset();
 }catch(err){message(clean(err.message,220),true)}
};
function importM3U(raw){
 try{
  const list=parseM3u(raw);
  const added=api.addStreams(list);
  message("Добавлено "+added+" аудиоссылок из "+list.length+
    ". Треки находятся в «Моя музыка». Воспроизведение зависит от сервера источника.");
  if(added)$("directM3UText").value="";
 }catch(e){message(clean(e.message,240),true)}
}
$("directM3UImport").onclick=()=>importM3U($("directM3UText").value);
$("directM3U").onchange=async e=>{
 const f=e.target.files?.[0];e.target.value="";if(!f)return;
 if(f.size>MAX_CHARS){message("M3U превышает 160 КБ",true);return}
 if(!/\.(m3u|txt)$/i.test(f.name)){message("Нужен текстовый M3U или TXT",true);return}
 try{importM3U(await f.text())}catch{message("Файл не удалось прочитать",true)}
};
window.VetogramMusicDirect=Object.freeze({parseM3u,checkUrl});
})();