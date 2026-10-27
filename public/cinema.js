/* VETOGRAM CINEMA V1 — independent Telegram Mini App. Zero pirate sources. */
(function () {
  "use strict";
  const films=window.VetogramCinemaCatalog || [];
  const $=id=>document.getElementById(id);
  const BASE="https://commons.wikimedia.org/w/api.php";
  const LIBRARY_KEY="vetogram.cinema.library.v1";
  const FILM_KEY="film";
  const fallback={favorites:[],progress:{},history:[]};
  const state={tab:"home",genre:"Все",query:"",selected:null,playing:null,request:0,
    library:loadLibrary(),sources:new Map(),posters:new Map(),subtitleBlob:null,pendingTime:0,embedHandle:null};
  const video=$("cinemaVideo");
  let toastTimer=0,progressTimer=0;
  const tg=window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.version?window.Telegram.WebApp:null;

  function loadLibrary(){
    try{
      const value=JSON.parse(localStorage.getItem(LIBRARY_KEY)||"null");
      if(!value||typeof value!=="object")return {...fallback};
      return {favorites:Array.isArray(value.favorites)?value.favorites.filter(x=>typeof x==="string"):[],
        progress:value.progress&&typeof value.progress==="object"?value.progress:{},
        history:Array.isArray(value.history)?value.history:[]};
    }catch(_){return {...fallback}}
  }
  function saveLibrary(){try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(state.library))}catch(_){/* private storage */}}
  function filmById(id){return films.find(f=>f.id===id)}
  function filmPage(f){return f.sourcePage || "https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(f.file.replace(/ /g,"_"))}
  function text(id,value){const el=$(id);if(el)el.textContent=value==null?"":String(value)}
  function node(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e}
  function toast(message){const e=$("cinemaToast");e.textContent=message;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),2600)}
  function buzz(){try{tg?.HapticFeedback?.selectionChanged()}catch(_){}}
  function updateBack(){if(!tg?.BackButton)return;
    try{if(state.playing||state.selected)tg.BackButton.show();else tg.BackButton.hide()}catch(_){}
  }
  function exitOverlay(){
    if(state.playing){closePlayer();return}
    if(state.selected){closeDetails();return}
  }
  if(tg){
    try{tg.ready();tg.expand();tg.setHeaderColor?.("#090d18");tg.setBackgroundColor?.("#090d18");tg.BackButton?.onClick(exitOverlay)}catch(_){}
  }
  function setTab(tab){
    if(!["home","catalog","search","library"].includes(tab))return;
    buzz();state.tab=tab;state.genre="Все";if(tab!=="search"){state.query="";$("cinemaSearch").value=""}
    document.querySelectorAll("[data-tab]").forEach(b=>{
      const yes=b.dataset.tab===tab;b.classList.toggle("active",yes);
      if(b.classList.contains("cinema-tab")){if(yes)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")}
    });
    $("cinemaHero").classList.toggle("hidden",tab!=="home");
    $("cinemaSearchArea").classList.toggle("hidden",tab==="library");
    render();
    if(tab==="search")$("cinemaSearch").focus();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function selectedFilms(){
    let list=films;
    if(state.tab==="library")list=films.filter(f=>state.library.favorites.includes(f.id));
    if(state.genre!=="Все")list=list.filter(f=>f.genres.includes(state.genre));
    const q=state.query.trim().toLocaleLowerCase("ru-RU");
    if(q)list=list.filter(f=>(f.title+" "+f.original+" "+f.year+" "+f.genres.join(" ")).toLocaleLowerCase("ru-RU").includes(q));
    return list;
  }
  function artElement(f,wide){
    const div=node("div",wide?"cinema-card-art cinema-card-art-wide":"cinema-card-art");
    div.style.setProperty("--film-hue",String(f.hue));
    const badge=node("span","cinema-card-art-badge");badge.textContent=f.player?"МОСФИЛЬМ · RU":"OPEN FILM";div.append(badge);
    const title=node("span","cinema-card-art-title");title.textContent=f.title;div.append(title);
    const poster=state.posters.get(f.id);
    if(poster){const img=node("img");img.loading="lazy";img.src=poster;img.alt="Кадр из фильма «"+f.title+"»";img.onerror=()=>{img.remove();state.posters.delete(f.id)};div.prepend(img)}
    else if(!f.player)requestPoster(f);
    return div;
  }
  function filmCard(f){
    const b=node("button","cinema-card");b.type="button";b.setAttribute("aria-label",f.title+", детали");
    b.append(artElement(f,false));
    const name=node("span","cinema-card-name");name.textContent=f.title;
    const meta=node("small","cinema-card-meta");meta.textContent=f.year+" · "+f.minutes+" мин · "+f.genres[0];
    b.append(name,meta);
    const p=state.library.progress[f.id];
    if(p&&p.d>0&&p.t/p.d<.96){const bar=node("div","cinema-card-progress"),line=node("i");line.style.width=Math.round(100*p.t/p.d)+"%";bar.append(line);b.append(bar)}
    b.addEventListener("click",()=>openDetails(f));
    return b;
  }
  function render(){
    const list=selectedFilms();
    $("cinemaGrid").replaceChildren(...list.map(filmCard));
    $("cinemaEmpty").classList.toggle("hidden",list.length>0);
    text("cinemaCount",list.length+" из "+films.length+" фильмов · Creative Commons");
    const genres=["Все",...new Set(films.flatMap(f=>f.genres))];
    $("cinemaGenres").replaceChildren(...genres.map(g=>{
      const b=node("button","cinema-chip"+(state.genre===g?" active":""));b.type="button";b.textContent=g;
      b.setAttribute("aria-pressed",String(g===state.genre));
      b.addEventListener("click",()=>{state.genre=g;buzz();render()});return b;
    }));
    let title="Истории, которые остаются",subtitle="Русскоязычное кино из официальных плееров и авторские открытые фильмы.";
    if(state.tab==="catalog")title="Каталог фильмов";
    if(state.tab==="search")title="Результаты поиска";
    if(state.tab==="library"){title="Моё избранное";subtitle="Сохраняется на этом устройстве."}
    text("cinemaSectionTitle",title);text("cinemaSectionDescription",subtitle);
    const progressIds=Object.keys(state.library.progress).filter(id=>filmById(id)).sort((a,b)=>(state.library.progress[b]?.at||0)-(state.library.progress[a]?.at||0));
    const show=progressIds.length>0&&(state.tab==="home"||state.tab==="library");
    $("cinemaContinue").classList.toggle("hidden",!show);
    if(show)$("cinemaContinueList").replaceChildren(...progressIds.slice(0,10).map(id=>filmCard(filmById(id))));
  }
  function requestPoster(f){
    if(state.posters.has(f.id)||state.sources.has(f.id))return;
    // Passive lazy lookups: exact file metadata, no proxy or key.
    const req=()=>getCommons(f).then(result=>{
      if(!result.poster)return;state.posters.set(f.id,result.poster);
      document.querySelectorAll(".cinema-card").forEach(card=>{
        if(card.querySelector(".cinema-card-name")?.textContent!==f.title)return;
        const art=card.querySelector(".cinema-card-art");
        if(art&&!art.querySelector("img")){const img=node("img");img.loading="lazy";img.alt="Кадр: "+f.title;img.src=result.poster;img.onerror=()=>img.remove();art.prepend(img)}
      });
      if(f.id==="sintel")$("cinemaHeroBackdrop").style.backgroundImage='url("'+result.poster.replace(/"/g,"%22")+'")';
    }).catch(()=>{});
    // Defer expensive metadata requests until the browser is idle.
    if(window.requestIdleCallback)requestIdleCallback(req,{timeout:2500});else setTimeout(req,350);
  }
  async function getCommons(f){
    if(state.sources.has(f.id))return state.sources.get(f.id);
    const promise=(async()=>{
      const params=new URLSearchParams({action:"query",format:"json",origin:"*",titles:"File:"+f.file,prop:"videoinfo",viprop:"url|derivatives",viurlwidth:"960"});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
      try{
        const res=await fetch(BASE+"?"+params.toString(),{signal:controller.signal});
        if(!res.ok)throw Error("Источник вернул HTTP "+res.status);
        const json=await res.json();
        const info=Object.values(json?.query?.pages||{})[0];
        const v=info?.videoinfo?.[0];
        if(!v)throw Error("Файл отсутствует или не содержит видеоданных.");
        const probe=document.createElement("video");
        const variants=(v.derivatives||[]).filter(d=>{
          if(!d.src||!d.transcodekey||!/^https:\/\//.test(d.src))return false;
          const mediaType=(d.type||"").split(";")[0];
          if(!mediaType.startsWith("video/")||!probe.canPlayType(d.type||mediaType))return false;
          return /^(240|360|480|720)p\b/.test(d.transcodekey);
        }).map(d=>({url:d.src,label:d.transcodekey.split(".")[0],height:parseInt(d.transcodekey,10),type:d.type}));
        variants.sort((a,b)=>{const pref=x=>x.height===480?0:x.height===720?1:x.height===360?2:3;return pref(a)-pref(b)||(/mp4/.test(b.type)?1:0)-(/mp4/.test(a.type)?1:0)});
        return {variants,poster:v.thumburl||"",page:v.descriptionurl||filmPage(f)};
      }finally{clearTimeout(timer)}
    })();
    state.sources.set(f.id,promise);
    promise.catch(()=>state.sources.delete(f.id));
    return promise;
  }
  function setHistory(f){
    state.library.history=[f.id,...state.library.history.filter(id=>id!==f.id)].slice(0,40);
    saveLibrary();
  }
  function openDetails(f){
    state.selected=f;updateBack();buzz();
    text("cinemaDetailsTitle",f.title);
    text("cinemaDetailsMeta",f.original+" · "+f.year+" · "+f.minutes+" мин · "+f.genres.join(" / "));
    text("cinemaDetailsSynopsis",f.synopsis);
    text("cinemaDetailsCreator",f.creator);
    text("cinemaDetailsLanguage",f.player?"Язык: русский. Видео воспроизводится официальным плеером RUTUBE без скачивания на наши серверы.":"Оригинальная дорожка: "+f.spoken+". Русская озвучка подключается только при подтверждённых правах и наличии файла.");
    $("cinemaDetailsSource").href=filmPage(f);
    $("cinemaDetailsLicense").href=f.licenseUrl;
    text("cinemaDetailsLicense","Лицензия: "+f.license+" ↗");
    $("cinemaDetailsFavorite").textContent=state.library.favorites.includes(f.id)?"♥ В избранном":"♡ В избранное";
    const art=$("cinemaDetailsArt");art.replaceChildren();
    art.style.background="radial-gradient(circle at 65% 30%,hsl("+f.hue+" 50% 45%),transparent 62%),linear-gradient(120deg,#29334f,#31223c)";
    $("cinemaDetails").classList.remove("hidden");document.body.classList.add("cinema-modal-open");
    if(!f.player)getCommons(f).then(src=>{
      if(state.selected?.id!==f.id||!src.poster)return;
      const image=node("img");image.alt="Кадр из фильма "+f.title;image.src=src.poster;image.onerror=()=>image.remove();art.prepend(image);
    }).catch(()=>{});
    try{history.replaceState({film:f.id},"",location.pathname+"?film="+encodeURIComponent(f.id))}catch(_){}
  }
  function closeDetails(){
    state.selected=null;$("cinemaDetails").classList.add("hidden");
    document.body.classList.toggle("cinema-modal-open",Boolean(state.playing));updateBack();
    if(!state.playing)try{history.replaceState({}, "", location.pathname)}catch(_){}
  }
  function toggleFavorite(f){
    const list=state.library.favorites;
    if(list.includes(f.id))state.library.favorites=list.filter(id=>id!==f.id);
    else state.library.favorites=[f.id,...list];
    saveLibrary();buzz();render();$("cinemaDetailsFavorite").textContent=state.library.favorites.includes(f.id)?"♥ В избранном":"♡ В избранное";
  }
  async function shareFilm(f){
    const url=location.origin+location.pathname+"?film="+encodeURIComponent(f.id);
    try{
      if(navigator.share){await navigator.share({title:f.title,url});return}
      if(navigator.clipboard){await navigator.clipboard.writeText(url);toast("Ссылка скопирована");return}
    }catch(e){if(e.name==="AbortError")return}
    toast("Ссылка: "+url);
  }
  function setPlayerMessage(message){const e=$("cinemaPlayerMessage");if(message){e.textContent=message;e.classList.remove("hidden")}else e.classList.add("hidden")}
  function cleanupSubtitle(){
    if(state.subtitleBlob)URL.revokeObjectURL(state.subtitleBlob);state.subtitleBlob=null;
    video.querySelectorAll("track").forEach(t=>t.remove());
  }
  function closePlayer(){
    ++state.request;try{saveProgress(true)}catch(_){}
    try{state.embedHandle?.cleanup()}catch(_){}state.embedHandle=null;
    $("cinemaVideoToolbar").classList.remove("hidden");video.hidden=false;
    video.pause();video.removeAttribute("src");video.load();cleanupSubtitle();
    state.playing=null;$("cinemaPlayer").classList.add("hidden");
    document.body.classList.toggle("cinema-modal-open",Boolean(state.selected));updateBack();render();
  }
  function saveProgress(force){
    const f=state.playing;if(!f||!Number.isFinite(video.duration)||video.duration<=0)return;
    if(!force&&Date.now()-progressTimer<1500)return;progressTimer=Date.now();
    const t=Math.floor(video.currentTime),d=video.duration;
    if(video.ended||t/d>.96)delete state.library.progress[f.id];
    else if(t>4)state.library.progress[f.id]={t,d,at:Date.now()};
    saveLibrary();
  }
  function changeVideo(url,from){
    if(!/^https:\/\//.test(url))return setPlayerMessage("Некорректный адрес видеопотока.");
    state.pendingTime=Number(from)||0;
    video.pause();video.src=url;video.load();
    setPlayerMessage("Подключаем видео…");
  }
  async function tryRussianSubtitles(f,token){
    const url=BASE+"?"+new URLSearchParams({action:"timedtext",title:"File:"+f.file,lang:"ru",trackformat:"vtt",origin:"*"});
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6500);
    try{
      const r=await fetch(url,{signal:ctl.signal});
      if(!r.ok)throw Error("Нет субтитров");
      const vtt=await r.text();
      if(!vtt.trimStart().startsWith("WEBVTT"))throw Error("Нет субтитров VTT");
      if(token!==state.request)return;
      const blob=URL.createObjectURL(new Blob([vtt],{type:"text/vtt"}));
      cleanupSubtitle();state.subtitleBlob=blob;
      const track=node("track");track.kind="subtitles";track.label="Русские";track.srclang="ru";track.src=blob;track.default=true;video.append(track);
      track.addEventListener("load",()=>{try{track.track.mode="showing"}catch(_){}} ,{once:true});
      text("cinemaSubtitleStatus","Русские субтитры доступны · CC в настройках плеера.");
    }catch(_){if(token===state.request)text("cinemaSubtitleStatus","Русские субтитры для этого файла не найдены. Доступна оригинальная звуковая дорожка.")}
    finally{clearTimeout(timer)}
  }
  async function play(f){
    state.playing=f;setHistory(f);updateBack();buzz();
    $("cinemaPlayer").classList.remove("hidden");document.body.classList.add("cinema-modal-open");
    text("cinemaPlayerTitle",f.title);text("cinemaPlayerCredit",f.creator+" · "+f.license);
    $("cinemaPlayerSource").href=filmPage(f);
    text("cinemaSubtitleStatus",f.player?"Оригинальная русская дорожка — управление звуком и качеством внутри плеера RUTUBE.":"Проверяем русские субтитры…");
    $("cinemaAudio").replaceChildren(new Option("Оригинал · "+f.spoken,"original"));
    $("cinemaAudio").value="original";
    $("cinemaSpeed").value="1";video.playbackRate=1;
    $("cinemaQuality")?.replaceChildren();
    setPlayerMessage("Получаем доступные форматы из Wikimedia Commons…");
    cleanupSubtitle();video.pause();video.removeAttribute("src");video.load();
    const token=++state.request;
    if(f.player){
      $("cinemaVideoToolbar").classList.add("hidden");
      video.removeAttribute("poster");
      $("cinemaPlayerSource").href=filmPage(f);
      setPlayerMessage("Подключаем официальный плеер RUTUBE…");
      try{
        if(!window.VetogramCinemaProvider)throw Error("Модуль видеопровайдера не загрузился");
        const handle=await window.VetogramCinemaProvider.attach({
          video,container:$("cinemaVideoWrap"),source:f.player,
          allowedIframeOrigins:["https://rutube.ru"],
          onReady:()=>{if(token===state.request)setPlayerMessage("")},
          onError:(reason)=>{if(token===state.request)setPlayerMessage(reason)}
        });
        if(token!==state.request){handle.cleanup();return}
        state.embedHandle=handle;
      }catch(error){
        if(token===state.request)setPlayerMessage("Плеер недоступен: "+(error?.message||"ошибка")+". Откройте оригинал по ссылке ниже.");
      }
      return;
    }
    $("cinemaVideoToolbar").classList.remove("hidden");
    try{
      const src=await getCommons(f);
      if(token!==state.request)return;
      if(src.poster)video.poster=src.poster;else video.removeAttribute("poster");
      $("cinemaPlayerSource").href=src.page;
      if(!src.variants.length){setPlayerMessage("Нет совместимого видеопотока до 720p в этом браузере. Откройте исходный файл по ссылке ниже.");return}
      const select=$("cinemaQuality");
      select.replaceChildren(...src.variants.map((v,i)=>new Option(v.label+" · "+(/mp4/.test(v.type)?"MP4":"WebM"),String(i))));
      select.dataset.film=f.id;select.value="0";
      state.pendingTime=state.library.progress[f.id]?.t||0;
      changeVideo(src.variants[0].url,state.pendingTime);
      select.onchange=()=>{const v=src.variants[Number(select.value)];if(v)changeVideo(v.url,video.currentTime)};
      (f.editions||[]).filter(e=>/^https:\/\//.test(e.url)&&e.license&&e.credit).forEach(e=>{
        $("cinemaAudio").add(new Option(e.label,e.id));
      });
      $("cinemaAudio").onchange=()=>{
        const id=$("cinemaAudio").value;
        const edition=(f.editions||[]).find(e=>e.id===id);
        const target=edition?.url||src.variants[Number(select.value)]?.url;
        if(target)changeVideo(target,video.currentTime);
        text("cinemaPlayerCredit",edition?edition.credit+" · "+edition.license:f.creator+" · "+f.license);
      };
      tryRussianSubtitles(f,token);
    }catch(e){
      if(token===state.request)setPlayerMessage("Видео сейчас недоступно: "+(e?.message||"ошибка сети")+". Перейдите на страницу источника ниже.");
    }
  }
  video.addEventListener("loadedmetadata",()=>{
    if(state.pendingTime>0&&Number.isFinite(video.duration)&&state.pendingTime<video.duration-2){
      try{video.currentTime=state.pendingTime}catch(_){}
    }
    state.pendingTime=0;
    setPlayerMessage("");
    video.play().catch(()=>{/* browser may require user interaction; native play button remains */});
  });
  video.addEventListener("timeupdate",()=>saveProgress(false));
  video.addEventListener("pause",()=>saveProgress(true));
  video.addEventListener("ended",()=>{saveProgress(true);toast("Фильм досмотрен. Выбирай следующую историю.")});
  video.addEventListener("error",()=>{if(state.playing&&!state.playing.player&&video.currentSrc)setPlayerMessage("Не удалось воспроизвести этот формат. Попробуйте другое качество или откройте оригинал по ссылке.")});
  video.addEventListener("playing",()=>setPlayerMessage(""));
  video.addEventListener("waiting",()=>{if(!state.playing?.player&&!video.paused)setPlayerMessage("Буферизация…")});
  $("cinemaRewind").addEventListener("click",()=>{video.currentTime=Math.max(0,video.currentTime-10)});
  $("cinemaForward").addEventListener("click",()=>{video.currentTime=Math.min(video.duration||Infinity,video.currentTime+10)});
  $("cinemaSpeed").addEventListener("change",e=>{video.playbackRate=Number(e.target.value)||1});
  $("cinemaFullscreen").addEventListener("click",()=>{if(video.requestFullscreen)video.requestFullscreen().catch(()=>toast("Полноэкранный режим недоступен"));else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else toast("Полноэкранный режим не поддерживается")});
  $("cinemaPip").addEventListener("click",()=>{if(document.pictureInPictureEnabled&&video.requestPictureInPicture)video.requestPictureInPicture().catch(()=>toast("Режим недоступен"));else toast("Режим не поддерживается на этом устройстве")});
  $("cinemaPlayerClose").addEventListener("click",closePlayer);
  $("cinemaDetailsClose").addEventListener("click",closeDetails);
  $("cinemaDetails").addEventListener("click",e=>{if(e.target===$("cinemaDetails"))closeDetails()});
  $("cinemaDetailsWatch").addEventListener("click",()=>{if(state.selected)play(state.selected)});
  $("cinemaDetailsFavorite").addEventListener("click",()=>{if(state.selected)toggleFavorite(state.selected)});
  $("cinemaDetailsShare").addEventListener("click",()=>{if(state.selected)shareFilm(state.selected)});
  $("cinemaHeroWatch").addEventListener("click",()=>play(films[0]));
  $("cinemaHeroDetails").addEventListener("click",()=>openDetails(films[0]));
  $("cinemaSearch").addEventListener("input",e=>{state.query=e.target.value.slice(0,90);if(state.tab==="library")setTab("search");else if(state.tab==="home"){$("cinemaHero").classList.add("hidden")}render()});
  $("cinemaClear").addEventListener("click",()=>{$("cinemaSearch").value="";state.query="";render()});
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){exitOverlay();return}
    if((e.key===" "||e.code==="Space")&&state.playing&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName||"")&&!e.repeat){
      e.preventDefault();if(video.paused)video.play().catch(()=>{});else video.pause();
    }
  });
  $("cinemaTheme").addEventListener("click",()=>{
    document.body.classList.toggle("cinema-light");
    try{localStorage.setItem("vetogram.cinema.theme",document.body.classList.contains("cinema-light")?"light":"dark")}catch(_){}
  });
  try{if(localStorage.getItem("vetogram.cinema.theme")==="light")document.body.classList.add("cinema-light")}catch(_){}
  if(films.length){
    text("cinemaHeroMeta",films[0].year+" · "+films[0].minutes+" мин · "+films[0].genres.join(" / "));
    text("cinemaHeroTitle",films[0].title);
    text("cinemaHeroDescription",films[0].synopsis);
    if(!films[0].player)getCommons(films[0]).then(src=>{if(src.poster)$("cinemaHeroBackdrop").style.backgroundImage='url("'+src.poster.replace(/"/g,"%22")+'")'}).catch(()=>{});
    const params=new URLSearchParams(location.search);const film=filmById(params.get(FILM_KEY));if(film)openDetails(film);
  }
  render();
  // Exposes only safe navigation for a future Vetogram host. No Telegram privileged auth.
  window.VetogramCinema={openFilm:id=>{const f=filmById(id);if(f)openDetails(f)},openTab:setTab};
})();