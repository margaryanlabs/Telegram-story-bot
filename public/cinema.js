/* VETOGRAM CINEMA V1 — independent Telegram Mini App. Zero pirate sources. */
(function () {
  "use strict";
  let films=[...(window.VetogramCinemaCatalog || [])];
  const $=id=>document.getElementById(id);
  const BASE="https://commons.wikimedia.org/w/api.php";
  const LIBRARY_KEY="vetogram.cinema.library.v1";
  const FILM_KEY="film";
  const fallback={favorites:[],progress:{},history:[]};
  const state={tab:"home",genre:"Все",query:"",selected:null,playing:null,request:0,
    library:loadLibrary(),sources:new Map(),posters:new Map(),posterLookups:new Set(),approvedProviders:new Map(),activePlayerSource:null,subtitleBlob:null,pendingTime:0,embedHandle:null,embedDuration:0,embedLastSave:0};
  const video=$("cinemaVideo");
  let toastTimer=0,progressTimer=0,catalogTicket=0,catalogNextOffset=null,catalogDebounce=0,providerFeedbackTimer=0;
  const studio={selected:"mosfilm",ticket:0,loading:false,nextPage:1,results:new Map(),loaded:new Set()};
  const STUDIO_LINKS={mosfilm:"https://rutube.ru/channel/25963146/",lenfilm:"https://rutube.ru/channel/1792500/",gorky:"https://rutube.ru/channel/48160110/"};
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
    $("cinemaStudios").classList.toggle("hidden",tab!=="home"&&tab!=="catalog");
    render();
    if(tab!=="library")fetchCatalog(true);
    if(tab==="search")$("cinemaSearch").focus();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  // Backend is optional until the VPS is deployed. Initial curated films remain usable.
  async function fetchCatalog(reset=true) {
    const offset=reset?0:catalogNextOffset;
    if(offset===null||state.tab==="library")return;
    const ticket=++catalogTicket;
    const query=state.query.trim();
    const genre=state.genre==="Все"?"":state.genre;
    const params=new URLSearchParams({limit:"80",offset:String(offset),q:query,genre});
    const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),4500);
    const button=$("cinemaLoadMore");
    button.disabled=true;
    if(!reset)button.textContent="Загружаем…";
    try {
      const response=await fetch("/api/cinema/movies?"+params.toString(),{
        signal:timeout.signal,headers:{Accept:"application/json"}
      });
      if(!response.ok)throw Error("catalogue offline");
      const data=await response.json();
      if(ticket!==catalogTicket)return;
      if(!data||!Array.isArray(data.movies))throw Error("invalid movie data");
      const valid=data.movies.filter(x=>x&&typeof x.id==="string"&&typeof x.title==="string"&&
        /^[a-z0-9][a-z0-9-]{2,90}$/.test(x.id)&&
        x.player&&x.player.licensed===true&&/^https:\/\//.test(x.player.url)&&
        Array.isArray(x.genres));
      for(const film of valid){
        if(film.poster&&/^https:\/\//.test(film.poster))state.posters.set(film.id,film.poster);
      }
      const incoming=new Set(valid.map(x=>x.id));
      films=[...valid,...films.filter(f=>!incoming.has(f.id))];
      catalogNextOffset=Number.isInteger(data.nextOffset)?data.nextOffset:null;
      render();
    }catch(_){
      if(ticket===catalogTicket&&reset)catalogNextOffset=null;
      // Do not interrupt the initial offline/curated catalogue.
    }finally{
      clearTimeout(timer);button.disabled=false;button.textContent="Загрузить ещё фильмы ↓";
    }
  }

  // Catalog sources are published only after operator review. The backend's
  // approved-sources endpoint is separate from any Kinobox discovery queue.
  function approvedSources(f){
    const listed=state.approvedProviders.get(f.id)||[];
    const base=f.player?[{...f.player,id:"builtin:"+f.id,
      provider:f.player.provider||"RUTUBE",
      sourcePage:f.sourcePage||filmPage(f),translation:f.spoken||"Русский",
      quality:"",language:"ru"}]:[];
    const seen=new Set();
    return [...listed,...base].filter(src=>{
      if(!src||src.licensed!==true||!src.license||!src.credit||!/^https:\/\/[^/]+/.test(src.url))return false;
      const key=src.type+"|"+src.url;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  function sourceLabel(src){
    return [src.provider||"Плеер",src.translation||src.language||"Оригинальная дорожка",src.quality||""].filter(Boolean).join(" · ").slice(0,145);
  }
  async function fetchApprovedSources(f){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
    try{
      const response=await fetch("/api/cinema/movies/"+encodeURIComponent(f.id)+"/sources",{signal:controller.signal});
      if(!response.ok) return;
      const data=await response.json();
      if(!data||!Array.isArray(data.sources))return;
      const checked=data.sources.slice(0,30).filter(x=>{
        try{
          const url=new URL(x.url);
          return x.licensed===true&&!!x.license&&!!x.credit&&
            ["iframe","video","hls"].includes(x.type)&&url.protocol==="https:"&&
            (x.type!=="iframe"||url.origin==="https://rutube.ru"||
             (window.VETOGRAM_CINEMA_EMBED_ORIGINS||[]).includes(url.origin));
        }catch(_){return false}
      });
      state.approvedProviders.set(f.id,checked);
      if(state.playing?.id===f.id){
        const selected=$("cinemaProviderSelect");
        const oldUrl=state.activePlayerSource?.url;
        const all=approvedSources(f);
        selected.replaceChildren(...all.map((src,i)=>new Option(sourceLabel(src),String(i))));
        selected.value=String(Math.max(0,all.findIndex(x=>x.url===oldUrl)));
      }
    }catch(_){/* backend may not be deployed */}
    finally{clearTimeout(timer)}
  }
  // Live archives from three verified Russian rights-holder channels.
  // Same-origin backend requests only; no CORS bypass or video proxy.
  function showStudio(){
    const list=studio.results.get(studio.selected)||[];
    const status=$("cinemaStudioStatus");
    $("cinemaStudioOfficial").href=STUDIO_LINKS[studio.selected];
    $("cinemaStudioGrid").replaceChildren(...list.slice(-180).map(filmCard));
    $("cinemaStudioMore").classList.toggle("hidden",studio.nextPage===null);
    $("cinemaStudioMore").disabled=studio.loading;
    if(list.length){
      status.textContent=list.length+" проверенных по длительности публикаций · оригинальные RUTUBE-плееры";
    }else if(!studio.loading){
      status.textContent="Архив пока недоступен в Cinema. Открыть официальный канал можно по ссылке ниже.";
    }
  }
  async function loadStudio(reset=false){
    if(studio.loading&&!reset)return;
    const target=studio.selected;
    if(reset){
      studio.nextPage=1;
      if(studio.loaded.has(target)){
        studio.nextPage=null;
        showStudio();
        return;
      }
    }
    const page=studio.nextPage;
    if(page===null)return;
    const ticket=++studio.ticket;
    studio.loading=true;
    const button=$("cinemaStudioMore");
    button.disabled=true;
    text("cinemaStudioStatus","Подключаем "+target+" · страница "+page+"…");
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    try{
      const res=await fetch("/api/cinema/channels?"+new URLSearchParams({
        channel:target,page:String(page)
      }),{signal:controller.signal,headers:{Accept:"application/json"}});
      if(!res.ok)throw Error("HTTP "+res.status);
      const data=await res.json();
      if(ticket!==studio.ticket||target!==studio.selected)return;
      if(!data||data.channel!==target||!Array.isArray(data.movies))throw Error("Неправильная выдача архива");
      const valid=data.movies.slice(0,100).filter(f=>{
        try{
          const url=new URL(f.player?.url||"");
          return f.sourceCatalog==="rutube-official-channel"&&
            f.id.startsWith("rutube-"+target+"-")&&
            f.player?.licensed===true&&f.player?.type==="iframe"&&
            url.origin==="https://rutube.ru"&&
            /^\/play\/embed\/[a-f0-9]{32}$/i.test(url.pathname)&&
            Number(f.minutes)>=35;
        }catch(_){return false}
      });
      const old=studio.results.get(target)||[];
      const existing=new Set(old.map(x=>x.id));
      for(const film of valid) {
        if(existing.has(film.id))continue;
        existing.add(film.id);
        old.push(film);
        if(film.poster&&/^https:\/\//.test(film.poster))state.posters.set(film.id,film.poster);
        if(!films.some(x=>x.id===film.id))films.push(film);
      }
      studio.results.set(target,old);
      studio.nextPage=Number.isInteger(data.nextPage)&&data.nextPage>page?data.nextPage:null;
      if(studio.nextPage===null)studio.loaded.add(target);
      render();showStudio();
    }catch(_){
      if(ticket===studio.ticket)text("cinemaStudioStatus",
        "Не удалось получить каталог канала. Попробуйте снова или откройте официальный RUTUBE.");
    }finally{
      clearTimeout(timeout);
      if(ticket===studio.ticket){studio.loading=false;button.disabled=false}
    }
  }
  function switchStudio(target){
    if(!Object.hasOwn(STUDIO_LINKS,target))return;
    studio.ticket++;
    studio.loading=false;
    studio.selected=target;
    studio.nextPage=studio.loaded.has(target)?null:1;
    document.querySelectorAll("[data-studio]").forEach(button=>{
      button.classList.toggle("active",button.dataset.studio===target);
      button.setAttribute("aria-pressed",String(button.dataset.studio===target));
    });
    showStudio();
    if(studio.nextPage!==null)loadStudio(true);
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
    const badge=node("span","cinema-card-art-badge");badge.textContent=f.player?(f.player.provider||"STREAM")+" · "+(f.spoken==="Русский"||f.spoken==="ru"?"RU":"FILM"):"OPEN FILM";div.append(badge);
    const title=node("span","cinema-card-art-title");title.textContent=f.title;div.append(title);
    const poster=state.posters.get(f.id);
    if(poster){const img=node("img");img.loading="lazy";img.src=poster;img.alt="Кадр из фильма «"+f.title+"»";img.onerror=()=>{img.remove();state.posters.delete(f.id)};div.prepend(img)}
    else requestPoster(f);
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
    $("cinemaGrid").replaceChildren(...list.slice(0,180).map(filmCard));
    $("cinemaEmpty").classList.toggle("hidden",list.length>0);
    text("cinemaCount",list.length+" из "+films.length+" фильмов · официальные источники");
    $("cinemaLoadMore").classList.toggle("hidden",catalogNextOffset===null||state.tab==="library");
    const russian=films.filter(f=>f.player&&(f.spoken==="Русский"||f.spoken==="ru"));
    const showRussian=state.tab==="home"&&!state.query.trim()&&russian.length>0;
    $("cinemaRussian").classList.toggle("hidden",!showRussian);
    if(showRussian)$("cinemaRussianRail").replaceChildren(...russian.slice(0,15).map(filmCard));
    const genres=["Все",...new Set(films.flatMap(f=>f.genres))];
    $("cinemaGenres").replaceChildren(...genres.map(g=>{
      const b=node("button","cinema-chip"+(state.genre===g?" active":""));b.type="button";b.textContent=g;
      b.setAttribute("aria-pressed",String(g===state.genre));
      b.addEventListener("click",()=>{state.genre=g;buzz();render();if(state.tab!=="library")fetchCatalog(true)});return b;
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
    if(state.posters.has(f.id)||state.posterLookups.has(f.id))return;
    state.posterLookups.add(f.id);
    const req=()=>Promise.resolve()
      .then(()=>f.player
        ?(window.VetogramCinemaArtwork?.load(f)||null)
        :getCommons(f).then(result=>result.poster))
      .then(poster=>{
        if(!poster)return;
        state.posters.set(f.id,poster);
        document.querySelectorAll(".cinema-card").forEach(card=>{
          if(card.querySelector(".cinema-card-name")?.textContent!==f.title)return;
          const art=card.querySelector(".cinema-card-art");
          if(art&&!art.querySelector("img")){
            const img=node("img");img.loading="lazy";img.alt="Кадр: "+f.title;
            img.src=poster;img.onerror=()=>img.remove();art.prepend(img);
          }
        });
        if(state.selected?.id===f.id){
          const art=$("cinemaDetailsArt");
          if(!art.querySelector("img")){
            const img=node("img");img.alt="Кадр из фильма "+f.title;img.src=poster;
            img.onerror=()=>img.remove();art.prepend(img);
          }
        }
        if(f.id===films[0]?.id)
          $("cinemaHeroBackdrop").style.backgroundImage='url("'+poster.replace(/"/g,"%22")+'")';
      }).catch(()=>{});
    if(window.requestIdleCallback)requestIdleCallback(req,{timeout:2300});
    else setTimeout(req,200);
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
    text("cinemaDetailsLanguage",f.player?"Язык: "+(f.spoken||"по данным источника")+". Видеопоток передаёт провайдер, а не наши серверы.":"Оригинальная дорожка: "+f.spoken+". Русская озвучка подключается только при подтверждённых правах и наличии файла.");
    $("cinemaDetailsSource").href=filmPage(f);
    $("cinemaDetailsLicense").href=f.licenseUrl;
    text("cinemaDetailsLicense",(f.player?"Основание встраивания: ":"Лицензия: ")+f.license+" ↗");
    $("cinemaDetailsFavorite").textContent=state.library.favorites.includes(f.id)?"♥ В избранном":"♡ В избранное";
    const art=$("cinemaDetailsArt");art.replaceChildren();
    art.style.background="radial-gradient(circle at 65% 30%,hsl("+f.hue+" 50% 45%),transparent 62%),linear-gradient(120deg,#29334f,#31223c)";
    if(state.posters.has(f.id)){const image=node("img");image.alt="Кадр из фильма "+f.title;image.src=state.posters.get(f.id);image.onerror=()=>image.remove();art.prepend(image)}
    else requestPoster(f);
    $("cinemaDetails").classList.remove("hidden");document.body.classList.add("cinema-modal-open");
    if(f.player)fetchApprovedSources(f);
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
    clearTimeout(providerFeedbackTimer);
    ++state.request;try{saveProgress(true)}catch(_){}
    try{state.embedHandle?.cleanup()}catch(_){}state.embedHandle=null;state.embedDuration=0;
    $("cinemaVideoToolbar").classList.remove("hidden");video.hidden=false;
    video.pause();video.removeAttribute("src");video.load();cleanupSubtitle();
    state.playing=null;state.activePlayerSource=null;$("cinemaPlayer").classList.add("hidden");
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
  async function play(f, chosenSource){
    if(state.playing){try{saveProgress(true)}catch(_){}}
    clearTimeout(providerFeedbackTimer);
    try{state.embedHandle?.cleanup()}catch(_){}state.embedHandle=null;
    state.playing=f;setHistory(f);updateBack();buzz();
    const choices=approvedSources(f);
    const current=choices.find(x=>chosenSource&&x.url===chosenSource.url)||chosenSource||choices[0];
    state.activePlayerSource=current||null;
    const providerSelect=$("cinemaProviderSelect");
    $("cinemaSourceSwitch").classList.toggle("hidden",!f.player);
    providerSelect.replaceChildren(...choices.map((src,i)=>new Option(sourceLabel(src),String(i))));
    providerSelect.value=String(Math.max(0,choices.findIndex(src=>src.id===current?.id)));
    providerSelect.onchange=()=>{const next=approvedSources(f)[Number(providerSelect.value)];if(next)play(f,next)};
    text("cinemaProviderHint",choices.length>1?choices.length+" проверенных вариантов":"Видеопоток предоставляется источником");
    $("cinemaPlayer").classList.remove("hidden");document.body.classList.add("cinema-modal-open");
    text("cinemaPlayerTitle",f.title);text("cinemaPlayerCredit",f.creator+" · "+f.license);
    $("cinemaPlayerSource").href=filmPage(f);
    $("cinemaOpenSource").href=filmPage(f);
    text("cinemaSubtitleStatus",current?(current.type==="iframe"?"Язык, качество и субтитры переключаются в меню самого видеоплеера.":"Аудиодорожки доступны, если их предоставляет источник."):"Проверяем русские субтитры…");
    $("cinemaAudio").replaceChildren(new Option("Оригинал · "+f.spoken,"original"));
    $("cinemaAudio").value="original";
    $("cinemaSpeed").value="1";video.playbackRate=1;
    $("cinemaQuality")?.replaceChildren();
    setPlayerMessage("Получаем доступные форматы из Wikimedia Commons…");
    cleanupSubtitle();video.pause();video.removeAttribute("src");video.load();
    const token=++state.request;
    if(current){
      state.embedDuration=0;state.embedLastSave=0;
      const embedded=current.type==="iframe";
      $("cinemaVideoToolbar").classList.toggle("hidden",embedded);
      $("cinemaPlayerMessage").classList.toggle("is-provider",embedded);
      if(!embedded)state.pendingTime=state.library.progress[f.id]?.t||0;
      video.removeAttribute("poster");
      $("cinemaPlayerSource").href=current.sourcePage||filmPage(f);
      $("cinemaOpenSource").href=current.sourcePage||filmPage(f);
      setPlayerMessage("Подключаем "+(current.provider||"видеопровайдера")+"…");
      if(embedded)providerFeedbackTimer=setTimeout(()=>{if(token===state.request)setPlayerMessage("Не получили подтверждение запуска плеера. Если видео не появилось, используйте ссылку на источник ниже.");},13000);
      try{
        if(!window.VetogramCinemaProvider)throw Error("Модуль видеопровайдера не загрузился");
        const handle=await window.VetogramCinemaProvider.attach({
          video,container:$("cinemaVideoWrap"),source:current,
          allowedIframeOrigins:["https://rutube.ru",...(window.VETOGRAM_CINEMA_EMBED_ORIGINS||[])],
          resumeAt:state.library.progress[f.id]?.t||0,
          onEvent:(event)=>{
            if(token!==state.request||state.playing?.id!==f.id)return;
            if(event.type==="duration"){state.embedDuration=event.duration;return}
            if(event.type==="ended"){
              delete state.library.progress[f.id];saveLibrary();toast("Фильм досмотрен");render();return
            }
            if(event.type==="time"&&event.time>5){
              const duration=state.embedDuration||event.duration||f.minutes*60;
              if(Date.now()-state.embedLastSave>4000){
                state.embedLastSave=Date.now();
                if(event.time/duration>.96)delete state.library.progress[f.id];
                else state.library.progress[f.id]={t:Math.floor(event.time),d:duration,at:Date.now()};
                saveLibrary();
              }
            }
          },
          onReady:()=>{clearTimeout(providerFeedbackTimer);if(token===state.request)setPlayerMessage("")},
          onError:(reason)=>{clearTimeout(providerFeedbackTimer);if(token===state.request)setPlayerMessage(reason)}
        });
        if(token!==state.request){handle.cleanup();return}
        state.embedHandle=handle;
      }catch(error){
        clearTimeout(providerFeedbackTimer);
        if(token===state.request)setPlayerMessage("Плеер недоступен: "+(error?.message||"ошибка")+". Откройте оригинал по ссылке ниже.");
      }
      return;
    }
    $("cinemaVideoToolbar").classList.remove("hidden");
    $("cinemaPlayerMessage").classList.remove("is-provider");
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
  video.addEventListener("error",()=>{if(state.playing&&state.activePlayerSource?.type!=="iframe"&&video.currentSrc)setPlayerMessage("Не удалось воспроизвести этот формат. Попробуйте другое качество или откройте оригинал по ссылке.")});
  video.addEventListener("playing",()=>setPlayerMessage(""));
  video.addEventListener("waiting",()=>{if(state.activePlayerSource?.type!=="iframe"&&!video.paused)setPlayerMessage("Буферизация…")});
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
  $("cinemaSearch").addEventListener("input",e=>{state.query=e.target.value.slice(0,90);if(state.tab==="library")setTab("search");else if(state.tab==="home"){$("cinemaHero").classList.add("hidden")}render();clearTimeout(catalogDebounce);catalogDebounce=setTimeout(()=>fetchCatalog(true),350)});
  $("cinemaClear").addEventListener("click",()=>{$("cinemaSearch").value="";state.query="";render();fetchCatalog(true)});
  $("cinemaLoadMore").addEventListener("click",()=>fetchCatalog(false));
  $("cinemaStudioMore").addEventListener("click",()=>loadStudio(false));
  document.querySelectorAll("[data-studio]").forEach(button=>button.addEventListener("click",()=>switchStudio(button.dataset.studio)));
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
    requestPoster(films[0]);
    const params=new URLSearchParams(location.search);const film=filmById(params.get(FILM_KEY));if(film)openDetails(film);
  }
  render();
  showStudio();
  loadStudio(true);
  fetchCatalog(true);
  // Exposes only safe navigation for a future Vetogram host. No Telegram privileged auth.
  window.VetogramCinema={openFilm:id=>{const f=filmById(id);if(f)openDetails(f)},openTab:setTab};
})();