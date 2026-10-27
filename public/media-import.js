/* VETO MEDIA V10 · metadata-only playlist bridge (VK/CSV/JSON/TXT)
   User-directed import. No VK scraping, credentials, copying audio or DRM bypass. */
(()=>{
"use strict";
const $=id=>document.getElementById(id),music=$("musicView"),library=$("libraryView"),home=$("homeView");
if(!music)return;
const KEY="veto-media-playlist-v10",MAX=300,LIMIT=524288;
const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
const clean=(v,n=160)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,n);
const norm=v=>clean(v,260).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const safe=v=>{try{const u=new URL(String(v));return u.protocol==="https:"?u.href:""}catch{return""}};
const record=(artist,title,source="Импорт")=>{
 const a=clean(artist,120),t=clean(title,160);
 if(!a||!t||/^(?:https?:\/\/|vk\.com|password[:=]|token[:=])/i.test(a+" "+t))return null;
 return {id:norm(a+" "+t).slice(0,260),artist:a,title:t,source:clean(source,30)};
};
function csv(text,sep){
 const rows=[];let quote=false,cell="",row=[];
 for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}
   else if(!quote&&(c===sep||c==='\n'||c==='\r')){
     if(c==='\r'&&text[i+1]==='\n')i++;
     row.push(cell);cell="";
     if(c!==sep){rows.push(row);row=[]}
   }else cell+=c;
 }
 if(quote)throw Error("Незакрытые кавычки CSV");
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
function fromJson(v){
 if(!v||typeof v!=="object"||Array.isArray(v))return null;
 let a=v.artist??v.artist_name??v.performer??v.исполнитель??v.artists??"";
 if(Array.isArray(a))a=a.map(x=>typeof x==="string"?x:x?.name).filter(Boolean).join(", ");
 if(a&&typeof a==="object")a=a.name||"";
 return record(a,v.title??v.track??v.track_name??v.song??v.name??v.название??"","JSON");
}
function parse(raw,format="auto"){
 const text=String(raw??"").replace(/^\uFEFF/,"").trim();
 if(!text)throw Error("Добавь список треков или выбери файл");
 if(text.length>LIMIT)throw Error("Максимум 512 КБ");
 let tracks=[];
 if(format==="json"||text.startsWith("[")||text.startsWith("{")){
   let data;try{data=JSON.parse(text)}catch{throw Error("Некорректный JSON")}
   const array=Array.isArray(data)?data:Array.isArray(data?.tracks)?data.tracks:Array.isArray(data?.items)?data.items:
     Array.isArray(data?.playlists)?data.playlists.flatMap(x=>Array.isArray(x?.tracks)?x.tracks:[]):null;
   if(!array)throw Error("JSON должен содержать tracks, items или playlists");
   tracks=array.map(x=>fromJson(x?.track??x)).filter(Boolean);
 }else if(format==="csv"||/^[^\n]*[,;\t][^\n]*[,;\t]/.test(text)||/^(?:artist|исполнитель)\s*[,;\t]/i.test(text)){
   const first=text.split(/\r?\n/)[0],sep=first.includes("\t")?"\t":(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",";
   const rows=csv(text,sep);
   if(!rows.length)throw Error("CSV пуст");
   const header=rows[0].map(x=>norm(x).replace(/ /g,""));
   const ai=header.findIndex(x=>/^(?:artist|artists|artistname|performer|исполнитель|артист)$/.test(x));
   const ti=header.findIndex(x=>/^(?:title|track|trackname|song|songname|name|название|песня|трек)$/.test(x));
   if(ai<0&&rows[0].length<2)throw Error("CSV: нужны две колонки");
   tracks=(ai>=0&&ti>=0?rows.slice(1):rows).map(r=>record(r[ai>=0&&ti>=0?ai:0],r[ai>=0&&ti>=0?ti:1],"CSV")).filter(Boolean);
 }else tracks=text.split(/\r?\n/).map(line=>{
   const m=line.replace(/^\s*\d+[.)]\s*/,"").trim().match(/^(.{2,120}?)\s+(?:[—–-]|\|)\s+(.{1,160})$/);
   return m?record(m[1],m[2],"Текст"):null;
 }).filter(Boolean);
 const unique=new Map();
 for(const x of tracks){if(!unique.has(x.id))unique.set(x.id,x);if(unique.size>=MAX)break}
 if(!unique.size)throw Error("Не удалось разобрать список. Пример: Кино — Группа крови");
 return [...unique.values()];
}
function restore(){
 try{const arr=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(arr)?arr.slice(0,MAX).map(x=>record(x.artist,x.title,x.source)).filter(Boolean):[]}
 catch{return []}
}
let records=restore(),active=null,matches=new Map(),searchId="",lastSearch=0;
const setStatus=(s,error=false)=>{const el=$("v10Status");el.textContent=s;el.classList.toggle("error",error)};
const save=arr=>{try{localStorage.setItem(KEY,JSON.stringify(arr));records=arr;return true}catch{setStatus("Локальное хранилище недоступно. Список не изменён.",true);return false}};
const panel=create("section","v10-import");panel.id="v10Section";
panel.innerHTML='<div class="v10-orbit" aria-hidden="true">♫</div>'+
 '<div class="v10-top"><div><small>VETO MUSIC / LIBRARY BRIDGE</small><h3>Вся твоя музыка.<br><em>Один плейлист.</em></h3>'+
 '<p>Перенеси названия и исполнителей из VK Музыки, CSV, TXT или JSON. Затем найди совпадение в разрешённом каталоге Audius.</p></div>'+
 '<div class="v10-privacy-mark">PRIVATE<br>ON YOUR DEVICE</div></div>'+
 '<div class="v10-import-editor"><label for="v10Text">Исполнитель — Название (каждая песня с новой строки)</label>'+
 '<textarea id="v10Text" maxlength="524288" rows="4" placeholder="Кино — Группа крови&#10;Земфира — Искала&#10;Мумий Тролль — Владивосток 2000"></textarea>'+
 '<div class="v10-buttons"><button id="v10Import" type="button">＋ Импортировать</button>'+
 '<button id="v10Pick" type="button">Выбрать CSV / JSON / TXT</button>'+
 '<input id="v10File" type="file" accept=".csv,.json,.txt,text/plain,text/csv,application/json" hidden></div></div>'+
 '<p class="v10-disclaimer">Без входа в VK, паролей, токенов и переноса MP3. Только названия и исполнители.</p>'+
 '<p id="v10Status" class="v10-status" role="status">Личные списки хранятся локально в браузере.</p>'+
 '<div class="v10-library-head"><div><small>MY MUSIC / IMPORTED</small><h4>Моя коллекция <span id="v10Count">0</span></h4></div>'+
 '<div class="v10-buttons"><button id="v10Export" type="button">Экспорт JSON</button><button id="v10Clear" type="button">Очистить</button></div></div>'+
 '<div class="v10-list" id="v10List"></div>';
const sectionTop=music.querySelector(".section-top,.section-head");
if(sectionTop)sectionTop.insertAdjacentElement("afterend",panel);else music.prepend(panel);
const summary=create("div","v10-summary");
summary.innerHTML='<div><small>VETO MUSIC / IMPORT</small><strong>Импортированные плейлисты</strong><span id="v10Summary">0 треков</span></div><button type="button" id="v10Go">Открыть →</button>';
(library?.querySelector(".v5-personal")||library)?.append(summary);
function render(){
 $("v10Count").textContent=records.length;
 if($("v10Summary"))$("v10Summary").textContent=records.length+" песен · локально";
 const list=$("v10List");list.replaceChildren();
 if(!records.length){list.append(create("div","v10-empty","Здесь появятся импортированные треки. Это список, не MP3-файлы."));return}
 records.forEach((r,i)=>{
   const item=create("article","v10-track");
   const num=create("span","v10-index",String(i+1).padStart(2,"0"));
   const info=create("div","v10-title");info.append(create("strong","",r.title),create("small","",r.artist));
   const badge=create("span","v10-tag",matches.get(r.id)?.candidates?.length?"Варианты найдены":"Только метаданные");
   const find=create("button","v10-find","⌕ Найти");find.type="button";find.onclick=()=>search(r);
   const remove=create("button","v10-remove","×");remove.type="button";remove.title="Удалить "+r.title;
   remove.onclick=()=>{if(active)active.abort();if(save(records.filter(x=>x.id!==r.id))){matches.delete(r.id);searchId="";render()}};
   item.append(num,info,badge,find,remove);
   if(searchId===r.id){const match=create("div","v10-matches");match.id="v10Matches";item.append(match);}
   list.append(item);
 });
 if(searchId){const current=records.find(x=>x.id===searchId);if(current)paintMatches(current)}
}
function score(request,c){
 const a=norm(request.artist),b=norm(request.title),ca=norm(c.user?.name||c.user?.handle),ct=norm(c.title);
 const compare=(x,y)=>{if(!x||!y)return 0;if(x===y)return 1;const left=new Set(x.split(" ")),right=new Set(y.split(" "));return [...left].filter(t=>right.has(t)).length/Math.max(left.size,right.size)};
 return (compare(a,ca)+compare(b,ct))/2;
}
function paintMatches(r){
 const panel=$("v10Matches");if(!panel)return;panel.replaceChildren();
 const state=matches.get(r.id);
 if(!state){panel.append(create("div","v10-hint","Поиск вручную по базе Audius."));return}
 if(state.loading){panel.append(create("div","v10-hint","Ищем варианты в Audius…"));return}
 if(state.error){panel.append(create("div","v10-warning",state.error));return}
 if(!state.candidates?.length){panel.append(create("div","v10-hint","Совпадений нет. Исходная песня остаётся в плейлисте."));return}
 panel.append(create("p","v10-hint","Это возможные совпадения, в том числе каверы и ремиксы. Подтверди правильную запись."));
 for(const candidate of state.candidates){
   const row=create("div","v10-match");const title=create("div","v10-match-info");
   title.append(create("strong","",candidate.title),create("small","",candidate.artist));
   row.append(title,create("span","v10-score",candidate.score>.85?"Похоже":candidate.score>.5?"Проверить":"Вариант"));
   const play=create("button","v10-play","▶ Слушать");play.type="button";
   play.onclick=()=>{
     if(!window.VetoMediaMusic?.playMatchedAudius){setStatus("В этой версии плеер Audius не подключён.",true);return}
     try{window.VetoMediaMusic.playMatchedAudius(candidate.raw);setStatus("Воспроизведение выбранного варианта Audius.");}
     catch{setStatus("Воспроизведение недоступно.",true)}
   };
   const link=create("a","v10-source","Источник ↗");link.href=candidate.permalink;link.target="_blank";link.rel="noopener noreferrer";
   row.append(play,link);panel.append(row);
 }
}
async function search(r){
 searchId=r.id;
 if(matches.get(r.id)?.candidates){render();return}
 if(Date.now()-lastSearch<1000){setStatus("Не чаще одного поискового запроса в секунду.",true);return}
 lastSearch=Date.now();active?.abort();const controller=new AbortController();active=controller;
 matches.set(r.id,{loading:true});render();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
   const q=encodeURIComponent(r.artist+" "+r.title);
   const response=await fetch("https://api.audius.co/v1/tracks/search?query="+q+"&limit=10",{signal:controller.signal,headers:{Accept:"application/json"}});
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json();
   const candidates=(Array.isArray(data.data)?data.data:[])
     .filter(x=>x?.id&&x?.title&&!x.is_stream_gated&&!x.is_delete)
     .map(x=>({raw:x,title:clean(x.title),artist:clean(x.user?.name||x.user?.handle),score:score(r,x),
       permalink:safe(x.permalink)||"https://audius.co/"}))
     .sort((a,b)=>b.score-a.score).slice(0,5);
   matches.set(r.id,{candidates});setStatus(candidates.length?"Выбери вариант вручную — он может быть кавером.":"Запись в Audius не найдена.");
 }catch(e){matches.set(r.id,{error:e?.name==="AbortError"?"Время поиска истекло.":"Audius недоступен. Попробуй позже."})}
 finally{clearTimeout(timer);if(searchId===r.id)render()}
}
function appendText(raw,format="auto"){
 try{
   const rows=parse(raw,format),map=new Map(records.map(x=>[x.id,x]));let count=0;
   for(const x of rows)if(!map.has(x.id)&&map.size<MAX){map.set(x.id,x);count++}
   if(save([...map.values()])){searchId="";render();setStatus("Добавлено "+count+" новых песен. Всего "+records.length+".")}
 }catch(e){setStatus(e?.message||"Не удалось импортировать",true)}
}
$("v10Import").onclick=()=>appendText($("v10Text").value);
$("v10Pick").onclick=()=>$("v10File").click();
$("v10File").addEventListener("change",async e=>{
 const f=e.target.files?.[0];e.target.value="";if(!f)return;
 if(f.size>LIMIT){setStatus("Максимум 512 КБ",true);return}
 try{appendText(await f.text(),f.name.toLowerCase().endsWith(".json")?"json":f.name.toLowerCase().endsWith(".csv")?"csv":"auto")}
 catch{setStatus("Не удалось открыть файл.",true)}
});
$("v10Clear").onclick=()=>{if(records.length&&confirm("Очистить импортированные песни?")&&save([])){matches.clear();render();setStatus("Список очищен.")}};
$("v10Export").onclick=()=>{
 const data={format:"veto-media-playlist",version:1,exported:new Date().toISOString(),tracks:records.map(x=>({artist:x.artist,title:x.title}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=create("a");a.href=url;a.download="veto-media-playlist.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);setStatus("JSON экспортирован. Аудиофайлы не экспортируются.");
};
const go=()=>{document.querySelector('.tab[data-tab="music"]')?.click();panel.scrollIntoView({behavior:"smooth",block:"start"})};
$("v10Go")?.addEventListener("click",go);
const launch=create("button","v10-launch","♫ Импортировать плейлист VK / CSV →");launch.type="button";launch.onclick=go;home?.append(launch);
render();
window.VetoMediaImport=Object.freeze({parse,list:()=>records.map(x=>({artist:x.artist,title:x.title}))});
})();