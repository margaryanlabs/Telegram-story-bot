/* VETO MEDIA V8 — genuine on-device audio, player tools and OS controls.
 * No uploads, network permissions, server state, Telegram account access or DRM bypass.
 */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const audio=$("audio")||$("audioEl");
  const music=$("musicView")||$("music");
  if(!audio||!music)return;
  const make=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e};
  const MAX_FILES=12,MAX_PER_FILE=100*1048576,MAX_TOTAL=300*1048576;
  const FORMATS=/\.(?:mp3|m4a|aac|ogg|wav|flac|opus)$/i;
  const VOLUME_KEY="veto-media-v8-volume",SPEED_KEY="veto-media-v8-speed";
  let records=[],current=-1,expiresAt=0,sleepTick=null,lastPlayerSource="";
  function stored(key,fallback){try{const value=Number(localStorage.getItem(key));return Number.isFinite(value)?value:fallback}catch{return fallback}}
  function store(key,v){try{localStorage.setItem(key,String(v))}catch{}}
  function announce(msg){
    if($("v8LocalStatus"))$("v8LocalStatus").textContent=msg;
    const toast=$("toast");if(toast){toast.textContent=msg;toast.classList.remove("hidden");}
  }
  function fileTitle(file){return String(file?.name||"Аудиофайл").replace(/\.(?:mp3|m4a|aac|ogg|wav|flac|opus)$/i,"").slice(0,130)}
  function isLocal(){return audio.src.startsWith("blob:")&&records.some(r=>r.url===audio.src)}
  function paint(){
    const root=$("v8LocalQueue");if(!root)return;root.replaceChildren();
    $("v8LocalCount").textContent=records.length+" файлов";
    if(!records.length){root.append(make("div","v8-empty","Выбери собственные треки — они появятся здесь."));return}
    records.forEach((rec,i)=>{
      const button=make("button","v8-local-track"+(isLocal()&&current===i?" active":""),"");
      button.type="button";button.append(make("span","v8-local-number",String(i+1).padStart(2,"0")),
        make("span","v8-local-name",rec.title),make("span","v8-local-play",current===i&&isLocal()?"♫":"▶"));
      button.addEventListener("click",()=>playLocal(i));root.append(button);
    });
  }
  function cleanup(){
    if(isLocal()){audio.pause();audio.removeAttribute("src");audio.load()}
    records.forEach(record=>URL.revokeObjectURL(record.url));records=[];current=-1;
    paint();announce("Локальная очередь очищена. Файлы не сохраняются в облако.");
  }
  function playLocal(i){
    const record=records[i];if(!record)return;
    current=i;
    const player=$("player");player?.classList.remove("hidden");
    const title=$("playerTitle")||$("song"),artist=$("playerArtist")||$("artist");
    if(title)title.textContent=record.title;if(artist)artist.textContent="Моя музыка · на этом устройстве";
    const cover=$("playerCover");if(cover)cover.style.backgroundImage="linear-gradient(135deg,#ee839f,#495bbc)";
    const img=$("cover");if(img){img.removeAttribute("src");img.alt="Личный аудиофайл";}
    const heart=$("favoriteNow")||$("save");heart?.classList.add("hidden");
    audio.src=record.url;audio.preload="metadata";audio.load();
    paint();
    if("mediaSession" in navigator){
      try{navigator.mediaSession.metadata=new MediaMetadata({title:record.title,artist:"Моя музыка · VETO MEDIA",album:"Личная очередь"})}catch{}
    }
    audio.play().catch(()=>announce("Не удалось воспроизвести файл: формат может не поддерживаться этим браузером."));
    announce("Играет локально: "+record.title);
  }
  function navigate(delta){
    if(!isLocal()||!records.length)return;
    playLocal((current+delta+records.length)%records.length);
  }
  const box=make("section","v8-local");
  box.setAttribute("aria-label","Моя музыка");
  const heading=make("div","v8-local-heading");
  const t=make("div");t.append(make("small","v8-label","VETO / YOUR MUSIC"),
    make("h3","","Твоя музыка. Без ожидания каталога."),
    make("p","","Добавь собственные аудиофайлы: они играют на устройстве, без загрузки на сервер. После закрытия страницы выбери файлы снова."));
  const controls=make("div","v8-local-actions");
  const add=make("button","v8-upload","＋ Добавить музыку");add.type="button";add.id="v8ChooseMusic";
  const clear=make("button","v8-clear","Очистить");clear.type="button";clear.id="v8ClearMusic";
  controls.append(add,clear);heading.append(t,controls);box.append(heading);
  const input=make("input");input.type="file";input.id="v8MusicInput";input.accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac,.opus";input.multiple=true;input.hidden=true;box.append(input);
  const queueTop=make("div","v8-local-queue-head");queueTop.append(make("strong","","Мой плейлист"));
  const count=make("small","","0 файлов");count.id="v8LocalCount";queueTop.append(count);box.append(queueTop);
  const queue=make("div","v8-local-queue");queue.id="v8LocalQueue";box.append(queue);
  const status=make("p","v8-local-status","Максимум 12 файлов до 100 МБ каждый, суммарно до 300 МБ.");status.id="v8LocalStatus";status.setAttribute("role","status");box.append(status);
  const sectionTop=music.querySelector(".section-top,.section-head");
  if(sectionTop)sectionTop.insertAdjacentElement("afterend",box);else music.prepend(box);
  add.addEventListener("click",()=>input.click());
  clear.addEventListener("click",cleanup);
  input.addEventListener("change",()=>{
    const picked=Array.from(input.files||[]);input.value="";
    const good=picked.filter(f=>(f.type.startsWith("audio/")||FORMATS.test(f.name))&&f.size>0&&f.size<=MAX_PER_FILE);
    if(!good.length){announce("Подходящие аудиофайлы не найдены. Нужен MP3, M4A или другой поддерживаемый формат.");return}
    const all=[...records.map(x=>x.file),...good].slice(0,MAX_FILES);
    const bytes=all.reduce((n,f)=>n+f.size,0);
    if(bytes>MAX_TOTAL){announce("Очередь превышает 300 МБ. Уменьши число или размер файлов.");return}
    cleanup();
    records=all.map(file=>({file,url:URL.createObjectURL(file),title:fileTitle(file)}));
    current=-1;paint();announce("Загружено на этом устройстве: "+records.length+" файлов.");
    if(records.length)playLocal(0);
  });
  // Intercept normal playlist actions only while a local audio file is active.
  document.addEventListener("click",event=>{
    if(!isLocal())return;
    const control=event.target.closest?.("#prevButton,#nextButton,#prev,#next");
    if(!control)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    navigate(control.id==="prevButton"||control.id==="prev"?-1:1);
  },true);
  document.addEventListener("ended",event=>{
    if(event.target!==audio||!isLocal())return;
    event.stopPropagation();event.stopImmediatePropagation();
    navigate(1);
  },true);
  audio.addEventListener("loadstart",()=>{
    if(audio.src!==lastPlayerSource){
      lastPlayerSource=audio.src;
      if(!isLocal())current=-1;
      paint();
    }
  });
  const tools=make("div","v8-player-tools");
  tools.id="v8PlayerTools";
  const col=make("label","v8-tool");
  col.append(make("span","","Громкость"));
  const volume=make("input");volume.type="range";volume.min="0";volume.max="100";volume.step="1";volume.id="v8Volume";volume.setAttribute("aria-label","Громкость");col.append(volume);
  const speedLabel=make("label","v8-tool");speedLabel.append(make("span","","Скорость"));
  const speed=make("select");speed.id="v8Speed";
  for(const [v,label] of [["0.75","0.75×"],["1","1×"],["1.25","1.25×"],["1.5","1.5×"],["2","2×"]]){
    const o=make("option","",label);o.value=v;speed.append(o);
  }
  speedLabel.append(speed);
  const sleepLabel=make("label","v8-tool");sleepLabel.append(make("span","","Таймер сна"));
  const sleep=make("select");sleep.id="v8Sleep";
  for(const [v,label] of [["0","Выкл."],["15","15 минут"],["30","30 минут"],["60","60 минут"]]){
    const o=make("option","",label);o.value=v;sleep.append(o);
  }sleepLabel.append(sleep);
  const timerText=make("small","v8-countdown","");timerText.id="v8Countdown";
  tools.append(col,speedLabel,sleepLabel,timerText);
  const listening=$("v4Listening");
  const shell=listening?.querySelector(".v4-detail,.v4-listening-shell");
  if(shell)shell.append(tools);else box.append(tools);
  audio.volume=Math.max(0,Math.min(1,stored(VOLUME_KEY,80)/100));
  volume.value=String(Math.round(audio.volume*100));
  const initialSpeed=stored(SPEED_KEY,1);speed.value=["0.75","1","1.25","1.5","2"].includes(String(initialSpeed))?String(initialSpeed):"1";
  audio.playbackRate=Number(speed.value);
  volume.addEventListener("input",()=>{audio.volume=Number(volume.value)/100;store(VOLUME_KEY,volume.value)});
  speed.addEventListener("change",()=>{audio.playbackRate=Number(speed.value);store(SPEED_KEY,speed.value)});
  audio.addEventListener("loadedmetadata",()=>{audio.playbackRate=Number(speed.value)});
  function countdown(){
    if(!expiresAt)return;
    const rem=Math.ceil((expiresAt-Date.now())/1000);
    if(rem<=0){expiresAt=0;clearInterval(sleepTick);sleepTick=null;sleep.value="0";audio.pause();timerText.textContent="Таймер: воспроизведение остановлено";return}
    timerText.textContent="Остановится через "+Math.floor(rem/60)+":"+String(rem%60).padStart(2,"0");
  }
  sleep.addEventListener("change",()=>{
    if(sleepTick)clearInterval(sleepTick);
    const minutes=Number(sleep.value);expiresAt=minutes?Date.now()+minutes*60000:0;
    if(!minutes){timerText.textContent="";sleepTick=null;return}
    sleepTick=setInterval(countdown,1000);countdown();
  });
  // Integrate with the OS media panel where available, without authentication.
  if("mediaSession" in navigator && typeof navigator.mediaSession.setActionHandler==="function"){
    for(const [name,fn] of Object.entries({
      play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),
      previoustrack:()=>isLocal()?navigate(-1):($("prevButton")||$("prev"))?.click(),
      nexttrack:()=>isLocal()?navigate(1):($("nextButton")||$("next"))?.click(),
      seekto:details=>{if(Number.isFinite(details?.seekTime)&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(details.seekTime,audio.duration));},
      seekbackward:()=>{audio.currentTime=Math.max(0,audio.currentTime-10)},
      seekforward:()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+10)}
    })){
      try{navigator.mediaSession.setActionHandler(name,fn)}catch{}
    }
  }
  window.addEventListener("pagehide",()=>{
    if(sleepTick)clearInterval(sleepTick);
    records.forEach(rec=>URL.revokeObjectURL(rec.url));records=[];current=-1;
  });
  paint();
  window.VetoMediaV8=Object.freeze({
    isLocal,queueCount:()=>records.length,playLocal,
    currentTitle:()=>records[current]?.title||null
  });
})();