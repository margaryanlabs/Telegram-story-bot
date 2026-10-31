/* VETOGRAM CINEMA V1 — independent Telegram Mini App. Zero pirate sources. */
(function () {
  "use strict";
  const filmInputs=[...(window.VetogramCinemaCatalog || []),...(window.VetogramCinemaFeatured200||[]),...(window.VetogramCinemaAdditionalOfficial63||[]),...(window.VetogramCinemaSeriesEpisodes||[]),...(window.VetogramCinemaPopularSeries||[]),...(window.VetogramCinemaForeignRutube||[]),...(window.VetogramCinemaFranchises||[])];
  let films=[...new Map(filmInputs.map(f=>[f.id,f])).values()];
  const $=id=>document.getElementById(id);
  const BASE="https://commons.wikimedia.org/w/api.php";
  const LIBRARY_KEY="vetogram.cinema.library.v1:"+(window.VetogramMediaContext?.scope||"device");
  const FILM_KEY="film";
  const fallback={favorites:[],progress:{},history:[]};
  const state={tab:"home",genre:"Все",query:"",sort:"recent",visible:100,showUnverified:false,foreignIncludeUnverified:false,selected:null,playing:null,request:0,
    library:loadLibrary(),sources:new Map(),posters:new Map(),posterLookups:new Set(),approvedProviders:new Map(),activePlayerSource:null,subtitleBlob:null,pendingTime:0,embedHandle:null,embedDuration:0,embedLastSave:0};
  const video=$("cinemaVideo");
  let toastTimer=0,progressTimer=0,catalogTicket=0,catalogNextOffset=null,catalogDebounce=0,providerFeedbackTimer=0;
  // Fail-closed on provider-reported playback errors for this device session.
  // A timeout is not proof of unavailability (the user may not press ▶).
  const failedEmbeds=new Set();
  const studio={selected:"mosfilm",ticket:0,loading:false,nextPage:1,results:new Map(),loaded:new Set(),pages:new Map(),firstPages:new Set()};
  const STUDIO_LINKS={mosfilm:"https://rutube.ru/channel/25963146/",lenfilm:"https://rutube.ru/channel/1792500/",gorky:"https://rutube.ru/channel/48160110/",starmedia:"https://rutube.ru/channel/141565/",marsmedia:"https://rutube.ru/channel/29207414/",soyuzmultfilm:"https://rutube.ru/u/soyuzmultfilm/"};
  // The initial 200 feature films appear instantly in their studio tabs.
  // Their RUTUBE API cursor still begins from page 1 and remains authoritative.
  for(const film of [...(window.VetogramCinemaFeatured200||[]),...(window.VetogramCinemaAdditionalOfficial63||[])]){
    const target=film.id.match(/^rutube-(mosfilm|lenfilm|gorky|starmedia|marsmedia|soyuzmultfilm)-[a-f0-9]{32}$/i)?.[1];
    if(!target||!Object.hasOwn(STUDIO_LINKS,target))continue;
    const rows=studio.results.get(target)||[];
    rows.push(film);studio.results.set(target,rows);
  }
  const discovery={slides:[],index:0,lastKey:"",timer:null,prefetching:false,expanding:false,received:0,franchise:"mcu"};
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
  function saveLibrary(){
    try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(state.library))}catch(_){/* private storage */}
    if(typeof CustomEvent!=='undefined'&&typeof document.dispatchEvent==='function')
      document.dispatchEvent(new CustomEvent('vetogram:cinema-library-change'));
  }
  function filmById(id){return films.find(f=>f.id===id)}
  function filmPage(f){return f.sourcePage || (f.file?"https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(f.file.replace(/ /g,"_")):"https://www.justwatch.com/ru")}
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
    try{tg.ready();tg.expand();tg.setHeaderColor?.("#08090d");tg.setBackgroundColor?.("#08090d");tg.BackButton?.onClick(exitOverlay)}catch(_){}
  }else{
    // Async Telegram SDK must never block the normal website from rendering.
    window.addEventListener("load",()=>{
      try{
        const delayed=window.Telegram?.WebApp;
        if(!delayed?.version)return;
        delayed.ready();delayed.expand();
        delayed.setHeaderColor?.("#08090d");
        delayed.setBackgroundColor?.("#08090d");
        delayed.BackButton?.onClick(exitOverlay);
      }catch(_){}
    },{once:true});
  }
  function setTab(tab){
    if(!["home","foreign","catalog","series","search","library"].includes(tab))return;
    if(tab==="foreign")tab="catalog"; // no external-only streaming catalog
    buzz();state.tab=tab;state.genre="Все";state.visible=100;if(tab!=="search"){state.query="";$("cinemaSearch").value=""}
    document.querySelectorAll("[data-tab]").forEach(b=>{
      const yes=b.dataset.tab===tab;b.classList.toggle("active",yes);
      if(b.classList.contains("cinema-tab")){if(yes)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")}
    });
    $("cinemaHero").classList.toggle("hidden",tab!=="home");
    if(tab==="series")$("cinemaSearch").placeholder="Найти сериал по названию…";
    else if(tab==="foreign")$("cinemaSearch").placeholder="Найти зарубежный фильм с русской озвучкой…";
    else $("cinemaSearch").placeholder="Найти фильм, сериал, актёра или жанр…";
    $("cinemaSearchArea").classList.toggle("hidden",tab==="library");
    $("cinemaStudios").classList.toggle("hidden",tab!=="home"&&tab!=="catalog");
    $("cinemaSeriesHub").classList.toggle("hidden",tab!=="series");
    $("cinemaForeignHub").classList.add("hidden");
    for(const id of ["cinemaLatest","cinemaGenresSection","cinemaSeries","cinemaAnimations","cinemaRussian","cinemaFranchises","cinemaForeignShelf"])
      $(id).classList.toggle("hidden",tab!=="home");
    if(tab==="home")setHeroSlide(discovery.index);
    render();
    if(tab!=="library"&&tab!=="series"&&tab!=="foreign")fetchCatalog(true);
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
        $("cinemaSourceSwitch").classList.toggle("hidden",all.length<=1);
        selected.replaceChildren(...all.map((src,i)=>new Option(sourceLabel(src),String(i))));
        selected.value=String(Math.max(0,all.findIndex(x=>x.url===oldUrl)));
      }
    }catch(_){/* backend may not be deployed */}
    finally{clearTimeout(timer)}
  }
  // Live archives from three verified Russian rights-holder channels.
  // Same-origin backend requests only; no CORS bypass or video proxy.
  // All studio feeds return public original-player metadata. Never proxy videos.
  const isValidStudioFilm=(f,target)=>{
    try {
      const u=new URL(f?.player?.url||"");
      return f?.sourceCatalog==="rutube-official-channel" &&
        f?.id?.startsWith("rutube-"+target+"-")&&
        f?.player?.licensed===true&&f?.player?.type==="iframe"&&
        u.origin==="https://rutube.ru"&&
        /^\/play\/embed\/[a-f0-9]{32}$/i.test(u.pathname)&&
        Number(f.minutes)>=(target==="soyuzmultfilm"?3:35)&&
        typeof f.title==="string"&&f.title.length>0;
    }catch(_){return false}
  };
  function mergeStudioPage(target,page,data){
    if(!data||data.channel!==target||!Array.isArray(data.movies))throw Error("Некорректная выдача киностудии");
    const old=studio.results.get(target)||[];
    const seen=new Set(old.map(f=>f.id));
    const global=new Set(films.map(f=>f.id));
    let added=0;
    for(const film of data.movies.slice(0,60).filter(x=>isValidStudioFilm(x,target))){
      if(seen.has(film.id))continue;
      seen.add(film.id);old.push(film);added++;
      if(film.poster&&/^https:\/\/pic\.(?:rutube\.ru|rutubelist\.ru|rtbcdn\.su|rtbcdn\.ru)\//.test(film.poster))
        state.posters.set(film.id,film.poster);
      if(!global.has(film.id)){global.add(film.id);films.push(film)}
    }
    studio.results.set(target,old);
    if(page===1)studio.firstPages.add(target);
    const next=Number.isInteger(data.nextPage)&&data.nextPage>page?data.nextPage:null;
    studio.pages.set(target,next);
    if(next===null)studio.loaded.add(target);
    if(target===studio.selected)studio.nextPage=next;
    discovery.received+=added;
    return added;
  }
  async function studioPage(target,page,signal){
    const res=await fetch("/api/cinema-channels?"+new URLSearchParams({
      channel:target,page:String(page)
    }),{signal,headers:{Accept:"application/json"}});
    if(!res.ok)throw Error("Канал "+target+": HTTP "+res.status);
    return res.json();
  }
  function showStudio(){
    const list=studio.results.get(studio.selected)||[];
    $("cinemaStudioOfficial").href=STUDIO_LINKS[studio.selected];
    $("cinemaStudioGrid").replaceChildren(...list.slice(-180).map(filmCard));
    $("cinemaStudioMore").classList.toggle("hidden",studio.nextPage===null);
    $("cinemaStudioMore").disabled=studio.loading;
    text("cinemaStudioStatus",list.length
      ?list.length+" фильмов и серий · просмотр внутри Cinema"
      :studio.loading?"Загружаем каталог…":"Архив временно недоступен. Откройте официальный канал по ссылке ниже.");
  }
  async function loadStudio(reset=false){
    if(studio.loading)return;
    const target=studio.selected;
    if(reset&&studio.firstPages.has(target)){
      studio.nextPage=studio.pages.get(target)??null;showStudio();return;
    }
    const page=reset?1:studio.nextPage;
    if(page===null)return;
    const ticket=++studio.ticket;
    studio.loading=true;showStudio();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11500);
    try{
      let data;
      try{data=await studioPage(target,page,controller.signal)}
      catch(error){
        if(page!==1)throw error;
        const local=await fetch("./cinema-"+target+"-feed.json",{signal:controller.signal});
        if(!local.ok)throw error;
        data=await local.json();data.nextPage=null;
      }
      if(ticket!==studio.ticket||target!==studio.selected)return;
      mergeStudioPage(target,page,data);
      render();
    }catch(_){
      if(ticket===studio.ticket)text("cinemaStudioStatus","Не удалось загрузить архив. Попробуйте ещё раз или откройте официальный канал.");
    }finally{
      clearTimeout(timer);
      if(ticket===studio.ticket){studio.loading=false;showStudio()}
    }
  }
  function switchStudio(target){
    if(!Object.hasOwn(STUDIO_LINKS,target))return;
    studio.ticket++;studio.loading=false;studio.selected=target;
    studio.nextPage=studio.pages.has(target)?studio.pages.get(target):1;
    document.querySelectorAll("[data-studio]").forEach(button=>{
      button.classList.toggle("active",button.dataset.studio===target);
      button.setAttribute("aria-pressed",String(button.dataset.studio===target));
    });
    showStudio();
    if(!studio.firstPages.has(target))loadStudio(true);
  }
  // Lightweight background ingestion: up to three pages per real publisher,
  // sequentially paced, for a larger *actually sourced* watchable library.
  // Never manufacture static film titles or video links on provider failure.
  async function warmStudioFeeds(){
    if(discovery.prefetching)return;
    discovery.prefetching=true;
    const targets=Object.keys(STUDIO_LINKS);
    const plan=[...targets.filter(x=>x!=="mosfilm").map(x=>[x,1]),
      ...targets.map(x=>[x,2]),
      ...targets.map(x=>[x,3])];
    for(const [target,page] of plan){
      if(page>1&&!studio.firstPages.has(target))continue;
      if(page===1&&studio.firstPages.has(target))continue;
      if(page>1&&studio.pages.get(target)!==page)continue;
      const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),11500);
      try{
        const data=await studioPage(target,page,ctrl.signal);
        mergeStudioPage(target,page,data);
        render();
        if(studio.selected===target)showStudio();
      }catch(_){/* individual studio failures do not block other studios */}
      finally{clearTimeout(timeout)}
      text("cinemaSyncStatus",films.length+" записей · 6 источников");
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    discovery.prefetching=false;
    text("cinemaSyncStatus",films.length+" записей в коллекции");
  }
  // Incremental client-side catalogue expansion: one page per studio per click.
  // Original videos stay on RUTUBE; only public metadata is loaded here.
  async function loadMoreStudioArchives(){
    if(discovery.prefetching||discovery.expanding){
      text("cinemaArchiveStatus","Сначала завершаем загрузку предыдущих страниц.");return;
    }
    if(films.length>=1800){
      text("cinemaArchiveStatus","Уже загружено 1800 записей. Уточните поиск или выберите киностудию.");return;
    }
    const targets=Object.keys(STUDIO_LINKS).filter(x=>
      studio.firstPages.has(x)&&Number.isInteger(studio.pages.get(x))&&
      studio.pages.get(x)>0&&studio.pages.get(x)<=120);
    if(!targets.length){
      text("cinemaArchiveStatus","Больше страниц пока нет. Используйте поиск и жанры.");
      $("cinemaMoreStudios").disabled=true;return;
    }
    discovery.expanding=true;
    const button=$("cinemaMoreStudios");
    button.disabled=true;
    let added=0,failures=0;
    try{
      for(const target of targets){
        const page=studio.pages.get(target);
        if(!page||films.length>=1800)break;
        text("cinemaArchiveStatus","Загружаем следующую страницу: "+target+"…");
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),11000);
        try{
          const data=await studioPage(target,page,controller.signal);
          added+=mergeStudioPage(target,page,data);
        }catch(_){failures++}
        finally{clearTimeout(timer)}
        await new Promise(resolve=>setTimeout(resolve,260));
      }
      // On a fresh expansion show newly added material, not always the first 100.
      state.visible=Math.min(1800,Math.max(state.visible+120,films.length));
      render();
      if(studio.firstPages.has(studio.selected))showStudio();
      text("cinemaArchiveStatus",added>0
        ?("Добавлено "+added+" записей · теперь "+films.length+" в открытом каталоге"+(failures?" · "+failures+" архивов ответили с ошибкой":""))
        :("Новых записей не нашлось"+(failures?". У некоторых архивов временная ошибка.":".")));
    }finally{
      discovery.expanding=false;
      button.disabled=false;
    }
  }
  function selectedFilms(){
    // User requested a playback-only library. External-only discovery and
    // titles without a validated provider stream stay out of public shelves.
    let list=films.filter(f=>!f.externalRutube&&!f.discoveryOnly&&
      (f.player?.licensed===true||Boolean(f.file)));
    if(state.tab==="foreign")list=list.filter(f=>f.externalRutube&&(state.foreignIncludeUnverified||f.audioClaim||f.featuredForeign));
    if(state.tab==="series")list=list.filter(f=>f.contentType==="Сериалы"&&f.player?.licensed===true);
    if(state.tab==="catalog")list=list.filter(f=>f.contentType!=="Сериалы"&&!f.externalRutube);
    if(state.tab==="library")list=films.filter(f=>state.library.favorites.includes(f.id));
    if(state.genre!=="Все")list=list.filter(f=>(f.genres||[]).includes(state.genre)||
      (state.genre==="Фильмы"&&!f.contentType&&Number(f.minutes)>30));
    const q=state.query.trim().toLocaleLowerCase("ru-RU");
    if(q)list=list.filter(f=>(f.title+" "+(f.original||"")+" "+(f.year||"")+" "+(f.creator||"")+" "+(f.genres||[]).join(" ")).toLocaleLowerCase("ru-RU").includes(q));
    if(state.sort==="year")
      return [...list].sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||(uploadTime(b)-uploadTime(a)));
    if(state.sort==="title")
      return [...list].sort((a,b)=>a.title.localeCompare(b.title,"ru"));
    return [...list].sort((a,b)=>uploadTime(b)-uploadTime(a)||((Number(b.year)||0)-(Number(a.year)||0)));
  }
  function artElement(f,wide){
    const div=node("div",wide?"cinema-card-art cinema-card-art-wide":"cinema-card-art");
    div.style.setProperty("--film-hue",String(f.hue));
    const badge=node("span","cinema-card-art-badge");badge.textContent=f.externalRutube?(f.audioClaim?"ЗАЯВЛЕН ДУБЛЯЖ":"ОЗВУЧКА НЕ ПРОВЕРЕНА"):f.discoveryOnly?(f.russianAudioStatus==="catalog-listed"?"РУССКАЯ ДОРОЖКА В КАТАЛОГЕ":"ОЗВУЧКА НЕ ПОДТВЕРЖДЕНА"):f.contentType==="Мультфильмы"?"АНИМАЦИЯ":f.contentType==="Сериалы"?"СЕРИАЛ":f.player?"СМОТРЕТЬ":"ОТКРЫТЫЙ ФИЛЬМ";div.append(badge);
    const title=node("span","cinema-card-art-title");title.textContent=f.title;div.append(title);
    const poster=state.posters.get(f.id)||f.poster;
    if(poster){const img=node("img");img.loading="lazy";img.src=poster;img.alt="Кадр из фильма «"+f.title+"»";img.onerror=()=>{img.remove();state.posters.delete(f.id)};div.prepend(img)}
    else if(!f.discoveryOnly)requestPoster(f);
    return div;
  }
  function filmCard(f){
    const b=node("button","cinema-card");b.type="button";b.setAttribute("aria-label",f.title+", детали");
    b.append(artElement(f,false));
    const name=node("span","cinema-card-name");name.textContent=f.title;
    const meta=node("small","cinema-card-meta");meta.textContent=[f.year||"Русский",f.minutes?f.minutes+" мин":null,f.externalRutube?(f.audioClaim?"Дубляж заявлен":"Проверь озвучку"):f.discoveryOnly?(f.watchAvailability==="unavailable"?"Нет доступа у источника":f.russianAudio?"Русская дорожка указана":"Язык неизвестен"):f.contentType||f.genres?.[0]].filter(Boolean).join(" · ");
    b.append(name,meta);
    const p=state.library.progress[f.id];
    if(p&&p.d>0&&p.t/p.d<.96){const bar=node("div","cinema-card-progress"),line=node("i");line.style.width=Math.round(100*p.t/p.d)+"%";bar.append(line);b.append(bar)}
    b.addEventListener("click",()=>openDetails(f));
    return b;
  }
  const GENRE_TILES=[
    ["Фильмы","◈",18],["Сериалы","▥",288],["Мультфильмы","✳",198],
    ["Комедия","☺",40],["Драма","◌",340],["Приключения","↗",215]
  ];
  const isHome=()=>state.tab==="home"&&!state.query.trim();
  const uploadTime=f=>{const time=Date.parse(f.publishedAt||"");return Number.isFinite(time)?time:0};
  function setHeroSlide(index){
    if(!discovery.slides.length)return;
    const length=discovery.slides.length;
    discovery.index=(index+length)%length;
    const f=discovery.slides[discovery.index];
    const image=state.posters.get(f.id)||f.poster;
    $("cinemaHeroBackdrop").style.backgroundImage=image?'url("'+String(image).replace(/"/g,"%22")+'")':"none";
    text("cinemaHeroEyebrow",f.externalRutube?"ЗАРУБЕЖНОЕ · НАЙДЕНО НА RUTUBE":f.publishedAt?"ДОБАВЛЕНО В КИНОТЕКУ · "+(f.creator||"КИНО"): "ИЗБРАННОЕ · "+(f.creator||"КИНО"));
    text("cinemaHeroTitle",f.title.length>85?f.title.slice(0,82)+"…":f.title);
    text("cinemaHeroDescription",f.synopsis?.slice(0,195)||"Смотрите историю в официальном видеоплеере.");
    text("cinemaHeroMeta",f.externalRutube?[f.year,f.minutes?f.minutes+" МИН":null,f.audioClaim?"ДУБЛЯЖ ЗАЯВЛЕН":"ОЗВУЧКА НЕ ПРОВЕРЕНА"].filter(Boolean).join(" · "):[f.year||"Кино",f.minutes?f.minutes+" МИН":null,f.contentType||f.genres?.[0],"РУССКАЯ ДОРОЖКА"].filter(Boolean).join(" · "));
    text("cinemaHeroWatch",f.externalRutube?"↗ Открыть видео":"▶ Смотреть фильм");
    text("cinemaHeroCounter",String(discovery.index+1).padStart(2,"0")+" / "+String(length).padStart(2,"0"));
    $("cinemaHeroDots").replaceChildren(...discovery.slides.map((film,i)=>{
      const b=node("button","cinema-hero-dot");b.type="button";
      b.setAttribute("aria-label","Выбрать фильм "+(i+1)+": "+film.title);
      b.setAttribute("aria-current",String(i===discovery.index));
      b.addEventListener("click",()=>setHeroSlide(i));return b;
    }));
    if(!image)requestPoster(f);
  }
  function updateHeroDeck(){
    const foreign=[]; // Unlicensed external links must never lead a Play hero.
    const recents=films.filter(f=>f.player&&f.contentType!=="Сериалы"&&Number(f.minutes)>=35)
      .sort((a,b)=>uploadTime(b)-uploadTime(a));
    // Lead with films which actually have an in-app player. The foreign
    // discovery cards may only have an external source URL.
    const all=[...recents,...films.filter(f=>f.player?.licensed===true&&Number(f.minutes)>=40)];
    const used=new Set(),deck=[];
    for(const film of all) {
      if(used.has(film.id))continue;
      used.add(film.id);deck.push(film);
      if(deck.length===6)break;
    }
    const key=deck.map(x=>x.id).join("|");
    if(key===discovery.lastKey)return;
    const oldId=discovery.slides[discovery.index]?.id;
    discovery.lastKey=key;discovery.slides=deck;
    const prior=deck.findIndex(x=>x.id===oldId);
    setHeroSlide(prior>=0?prior:0);
  }
  function renderFranchise(){
    const rows=films.filter(f=>f.discoveryOnly&&f.franchise===discovery.franchise&&
      (state.showUnverified||f.russianAudioStatus==="catalog-listed"));
    $("cinemaFranchiseRail").replaceChildren(...rows.map(filmCard));
    text("cinemaFranchiseNote",rows.length+" названий · русский звук указан в каталоге только у отмеченных фильмов. Просмотр и региональная доступность не гарантированы.");
    document.querySelectorAll("[data-franchise]").forEach(button=>{
      const yes=button.dataset.franchise===discovery.franchise;
      button.classList.toggle("active",yes);
      button.setAttribute("aria-pressed",String(yes));
    });
  }
  // Identify episodes of the SAME TV show; do not invent season count.
  // The original uploader titles retain their exact episode numbers.
  function seriesShowName(f){
    if(f.seriesName)return f.seriesName;
    return String(f.title||"").replace(/(?:^|[\s.,-])(?:все серии|серии подряд|\d+\s*серия|серии\s+\d+)(?=\s|[.,:()!?]|$)[\s\S]*$/i,"")
      .replace(/\s*\([^)]*\)[\s\S]*$/,"").replace(/[.,:\s-]+$/g,"").trim()||f.title;
  }
  function seriesSeasonNumber(f){
    if(Number.isInteger(f.season)&&f.season>0)return f.season;
    const m=String(f.title||"").match(/(?:^|[\s.,-])(\d+)\s*сезон(?=\s|[.,:()!?]|$)/i);
    return m?Number(m[1]):1;
  }
  function seriesEpisodeNumber(f){
    if(Number.isInteger(f.episode))return f.episode;
    const m=String(f.title||"").match(/(?:^|[\s.,-])(\d+)\s*серия(?=\s|[.,:()!?]|$)|(?:^|[\s.,-])серии\s+(\d+)(?=\s|[.,:()!?]|$)/i);
    return m?Number(m[1]||m[2]):0;
  }
  function groupedSeries(){
    const shows=new Map();
    for(const film of films){
      if(film.contentType!=="Сериалы"||film.player?.licensed!==true)continue;
      const name=seriesShowName(film), key=name.toLocaleLowerCase("ru");
      if(!shows.has(key))shows.set(key,[]);
      shows.get(key).push(film);
    }
    const comparator=(a,b)=>seriesSeasonNumber(a)-seriesSeasonNumber(b)||
      ((seriesEpisodeNumber(a)||999)-(seriesEpisodeNumber(b)||999))||a.title.localeCompare(b.title,"ru");
    return [...shows.values()].map(group=>group.sort(comparator))
      .sort((a,b)=>b.length-a.length||uploadTime(b[0])-uploadTime(a[0]));
  }
  function seriesShowCard(group){
    const show=group[0];
    const button=node("button","cinema-card cinema-series-show-card");
    button.type="button";button.setAttribute("aria-label","Открыть сериал "+seriesShowName(show));
    const artwork=artElement(show,false);
    const title=artwork.querySelector(".cinema-card-art-title");
    if(title)title.textContent=seriesShowName(show);
    const badge=artwork.querySelector(".cinema-card-art-badge");
    if(badge)badge.textContent="СЕРИАЛ · RU";
    button.append(artwork);
    const label=node("strong","cinema-card-name");label.textContent=seriesShowName(show);
    const seasons=new Set(group.map(seriesSeasonNumber)).size;
    const meta=node("small","cinema-card-meta");
    meta.textContent=seasons+" "+(seasons===1?"сезон":"сезона / сезонов")+" · "+group.length+" видео · русский";
    button.append(label,meta);
    button.addEventListener("click",()=>openDetails(show));
    return button;
  }
  function renderEpisodeChooser(f){
    const section=$("cinemaEpisodeChooser");
    if(f.contentType!=="Сериалы"||!f.player){section.classList.add("hidden");return}
    const group=films.filter(x=>x.contentType==="Сериалы"&&x.player?.licensed===true&&seriesShowName(x)===seriesShowName(f));
    if(!group.length){section.classList.add("hidden");return}
    section.classList.remove("hidden");
    const seasons=[...new Set(group.map(seriesSeasonNumber))].sort((a,b)=>a-b);
    const current=seriesSeasonNumber(f);
    const tabs=$("cinemaSeasonTabs");
    tabs.replaceChildren(...seasons.map(n=>{
      const b=node("button","cinema-season-tab"+(n===current?" active":""));
      b.type="button";b.textContent="Сезон "+n;b.setAttribute("aria-pressed",String(n===current));
      b.addEventListener("click",()=>{
        const first=group.filter(x=>seriesSeasonNumber(x)===n).sort((a,b)=>
          (seriesEpisodeNumber(a)||999)-(seriesEpisodeNumber(b)||999))[0];
        if(first)openDetails(first);
      });return b;
    }));
    const sorted=group.filter(x=>seriesSeasonNumber(x)===current).sort((a,b)=>
      (seriesEpisodeNumber(a)||999)-(seriesEpisodeNumber(b)||999));
    text("cinemaEpisodeCount",sorted.length+" видео · выбери серию для просмотра");
    $("cinemaEpisodeGrid").replaceChildren(...sorted.map(item=>{
      const n=seriesEpisodeNumber(item);
      const b=node("button","cinema-episode-item"+(item.id===f.id?" active":""));
      b.type="button";b.setAttribute("aria-current",String(item.id===f.id));
      const art=node("span","cinema-episode-thumbnail");
      const image=item.poster||state.posters.get(item.id);
      if(image){const img=node("img");img.src=image;img.loading="lazy";img.alt="";art.append(img)}
      const playBadge=node("span","cinema-episode-play");playBadge.textContent="▶";art.append(playBadge);
      const caption=node("span","cinema-episode-caption");
      const name=node("strong");name.textContent=n>0?"Серия "+n:"Все серии / сборник";
      const desc=node("small");desc.textContent=(item.minutes||"?")+" мин · Русский";
      caption.append(name,desc);b.append(art,caption);
      b.addEventListener("click",()=>openDetails(item));
      return b;
    }));
  }
  function renderPopularSeries(){
    const rail=$("cinemaSeriesPopularRail");
    const list=(window.VetogramCinemaPopularSeries||[]).filter(x=>x.seriesGroup==="global");
    rail.replaceChildren(...list.map(item=>{
      // Text-only editorial identity: no false cinema player and no borrowed poster licensing.
      const card=node("article","cinema-popular-show");
      card.style.setProperty("--film-hue",String(item.hue||210));
      const artwork=node("div","cinema-popular-show-art");
      const badge=node("small","cinema-popular-show-badge");badge.textContent="ВСТРОЕННЫЙ ПЛЕЕР НЕ ПОДКЛЮЧЁН";
      const label=node("strong","cinema-popular-show-name");label.textContent=item.title;
      artwork.append(badge,label);
      const desc=node("span","cinema-popular-show-info");
      desc.textContent=item.year+" · русская дорожка указана в каталоге";
      card.append(artwork,desc);
      return card;
    }));
  }
  function renderSeriesCollections(){
    const groups=groupedSeries();
    $("cinemaSeriesHub").classList.toggle("hidden",state.tab!=="series");
    if(state.tab==="series"){
      renderPopularSeries();
      const q=state.query.trim().toLocaleLowerCase("ru");
      const visible=q?groups.filter(g=>seriesShowName(g[0]).toLocaleLowerCase("ru").includes(q)):groups;
      $("cinemaSeriesPlayableRail").replaceChildren(...visible.slice(0,80).map(seriesShowCard));
      const count=visible.reduce((sum,g)=>sum+g.length,0);
      text("cinemaSeriesStats",count+" реальных видео · "+groups.length+" сериалов · обложки, сезоны и серии");
    }
  }
  function refreshDiscovery(){
    const home=isHome();
    // Hiding discovery-only foreign uploads: no permission to embed them.
    $("cinemaForeignShelf").classList.add("hidden");
    const external=films.filter(f=>f.externalRutube);
    if(home)$("cinemaForeignRail").replaceChildren(...external.slice(0,20).map(filmCard));
    text("cinemaForeignNote",external.filter(f=>f.audioClaim).length+" публикаций с заявленным дубляжом · "+external.length+" найденных публикаций. Право на их встраивание не установлено.");
    renderSeriesCollections();
    const recent=films.filter(f=>f.player&&uploadTime(f)>0)
      .sort((a,b)=>uploadTime(b)-uploadTime(a));
    const series=groupedSeries();
    const cartoons=films.filter(f=>f.contentType==="Мультфильмы")
      .sort((a,b)=>uploadTime(b)-uploadTime(a));
    const shelves=[
      ["cinemaLatest","cinemaLatestRail",recent],
      ["cinemaSeries","cinemaSeriesRail",series],
      ["cinemaAnimations","cinemaAnimationsRail",cartoons]
    ];
    for(const [sectionId,railId,rows] of shelves){
      $(sectionId).classList.toggle("hidden",!home||rows.length===0);
      if(home&&rows.length)$(railId).replaceChildren(...rows.slice(0,18).map(sectionId==="cinemaSeries"?seriesShowCard:filmCard));
    }
    $("cinemaGenresSection").classList.toggle("hidden",!home);
    $("cinemaFranchises").classList.add("hidden");
    // Franchise title metadata is not playable: never render fake Watch cards.
    if(home){
      $("cinemaGenreTiles").replaceChildren(...GENRE_TILES.map(([label,glyph,hue])=>{
        const button=node("button","cinema-genre-tile");
        button.type="button";button.style.setProperty("--tile-hue",String(hue));
        button.dataset.glyph=glyph;
        const small=node("small");small.textContent="ОТКРЫТЬ";
        const strong=node("strong");strong.textContent=label;
        button.append(small,strong);
        button.setAttribute("aria-pressed",String(state.genre===label));
        button.addEventListener("click",()=>{
          setTab("catalog");state.genre=label;state.visible=100;render();
          $("cinemaBrowse").scrollIntoView?.({behavior:"smooth",block:"start"});
        });return button;
      }));
    }
    updateHeroDeck();
  }
  // A truly one-tap shelf. Foreign/discovery-only titles cannot masquerade
  // as playable films; every entry must have a first-party-approved embed.
  function renderWatchNow(){
    const host=$("cinemaWatchNowRail"),section=$("cinemaWatchNow");
    if(!host||!section)return;
    const live=films.filter(f=>{
      if(f.externalRutube||f.discoveryOnly||f.contentType==="Сериалы"||failedEmbeds.has(f.id))return false;
      if(!f.player||f.player.licensed!==true||f.player.type!=="iframe")return false;
      try{
        const url=new URL(f.player.url);
        return url.origin==="https://rutube.ru"&&
          /^\/play\/embed\/[a-f0-9]{32}$/i.test(url.pathname)&&
          Number(f.minutes)>=35;
      }catch{return false}
    }).sort((a,b)=>uploadTime(b)-uploadTime(a));
    section.classList.toggle("hidden",state.tab!=="home"||Boolean(state.query.trim())||!live.length);
    if(section.classList.contains("hidden"))return;
    const unique=new Set(),choices=[];
    for(const movie of live){
      const normalized=String(movie.title||"").toLocaleLowerCase("ru").replace(/[^а-яёa-z0-9]/g,"").slice(0,90);
      if(unique.has(normalized))continue;
      unique.add(normalized);choices.push(movie);
      if(choices.length===24)break;
    }
    text("cinemaWatchNowCount",live.length+" фильмов со встроенным плеером");
    host.replaceChildren(...choices.map(film=>{
      const button=filmCard(film);
      button.classList.add("cinema-watch-card");
      button.setAttribute("aria-label","Смотреть "+film.title+" во встроенном плеере");
      const playMark=node("span","cinema-watch-play","▶");
      playMark.setAttribute("aria-hidden","true");
      button.querySelector(".cinema-card-art")?.append(playMark);
      // Replace the normal "details" action only in this dedicated shelf.
      // Existing catalog cards still open full metadata and sources.
      const clean=button.cloneNode(true);
      clean.addEventListener("click",()=>play(film));
      return clean;
    }));
  }
  function render(){
    const list=selectedFilms();
    renderWatchNow();
    $("cinemaBrowse").classList.toggle("hidden",state.tab==="series");
    $("cinemaGrid").replaceChildren(...list.slice(0,state.visible).map(filmCard));
    $("cinemaMoreResults").classList.toggle("hidden",list.length<=state.visible||state.tab==="library");
    $("cinemaMoreStudios").classList.toggle("hidden",state.tab==="library"||state.tab==="series");
    $("cinemaEmpty").classList.toggle("hidden",list.length>0);
    const actuallyPlayable=films.filter(f=>!f.externalRutube&&!f.discoveryOnly&&
      (f.player?.licensed===true||Boolean(f.file))).length;
    text("cinemaCount",list.length+" из "+actuallyPlayable+" видео с источниками просмотра");
    $("cinemaLoadMore").classList.toggle("hidden",catalogNextOffset===null||state.tab==="library");
    const russian=films.filter(f=>f.player&&(f.spoken==="Русский"||f.spoken==="ru"));
    const showRussian=state.tab==="home"&&!state.query.trim()&&russian.length>0;
    $("cinemaRussian").classList.toggle("hidden",!showRussian);
    if(showRussian)$("cinemaRussianRail").replaceChildren(...russian.slice(0,15).map(filmCard));
    const genres=["Все",...new Set(["Фильмы","Сериалы","Мультфильмы",...films.flatMap(f=>f.genres||[])])];
    $("cinemaGenres").replaceChildren(...genres.map(g=>{
      const b=node("button","cinema-chip"+(state.genre===g?" active":""));b.type="button";b.textContent=g;
      b.setAttribute("aria-pressed",String(g===state.genre));
      b.addEventListener("click",()=>{state.genre=g;state.visible=100;buzz();render();if(state.tab!=="library")fetchCatalog(true)});return b;
    }));
    let title=state.genre==="Все"?"Вся коллекция":state.genre,subtitle="Фильмы, сериалы и мультфильмы из официальных видеоканалов. Новые записи появляются в каталоге.";
    if(state.tab==="catalog")title="Каталог фильмов";
    if(state.tab==="foreign"){title="Зарубежное с русским дубляжом";subtitle="Найденные на RUTUBE публикации. Озвучка указана загрузчиком; исходное видео открывается на RUTUBE.";}
    if(state.tab==="series"){title="Серии для просмотра";subtitle="Публикации официальных каналов со встроенными плеерами. Доступность конкретного видео зависит от источника и региона.";}
    if(state.tab==="search")title="Результаты поиска";
    if(state.tab==="library"){title="Моё избранное";subtitle="Сохраняется на этом устройстве."}
    text("cinemaSectionTitle",title);text("cinemaSectionDescription",subtitle);
    const progressIds=Object.keys(state.library.progress).filter(id=>filmById(id)).sort((a,b)=>(state.library.progress[b]?.at||0)-(state.library.progress[a]?.at||0));
    const show=progressIds.length>0&&(state.tab==="home"||state.tab==="library");
    $("cinemaContinue").classList.toggle("hidden",!show);
    if(show)$("cinemaContinueList").replaceChildren(...progressIds.slice(0,10).map(id=>filmCard(filmById(id))));
    refreshDiscovery();
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
        if(f.id===discovery.slides[discovery.index]?.id)
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
    if(typeof CustomEvent!=='undefined'&&typeof document.dispatchEvent==='function')document.dispatchEvent(new CustomEvent('vetogram:cinema-opened',{detail:{
      id:String(f.id),title:f.title,subtitle:f.contentType||'Фильм',
      progress:state.library.progress[f.id]?.d?state.library.progress[f.id].t/state.library.progress[f.id].d:0
    }}));
    text("cinemaDetailsTitle",f.title);
    text("cinemaDetailsMeta",[f.original,f.year,f.minutes?f.minutes+" мин":null,...(f.genres||[])].filter(Boolean).join(" · "));
    text("cinemaDetailsSynopsis",f.synopsis);
    if(f.contentType==="Сериалы"&&f.player){
      text("cinemaDetailsTitle",seriesShowName(f));
      text("cinemaDetailsMeta","Сезон "+seriesSeasonNumber(f)+" · "+(seriesEpisodeNumber(f)?"серия "+seriesEpisodeNumber(f):"сборник")+" · "+(f.minutes||"?")+" мин");
      text("cinemaDetailsSynopsis","Выбери сезон и серию. Полный выпуск открывается во встроенном плеере источника.");
    }
    renderEpisodeChooser(f);
    text("cinemaDetailsCreator",f.creator);
    text("cinemaDetailsLanguage",f.externalRutube?(f.audioClaim?"Загрузчик указывает дубляж, но звуковая дорожка не проверена. Откроется оригинальная страница RUTUBE; права на встраивание не установлены.":"Русская дорожка не проверена. Откроется оригинальная страница RUTUBE."):f.discoveryOnly?(f.russianAudio?f.russianAudio.note+" Источник: "+f.watchProvider+".":"Русскую дорожку для этого фильма пока не подтвердил ни один проверенный официальный источник."):f.player?"Язык: "+(f.spoken||"по данным источника")+". Видеопоток передаёт провайдер, а не наши серверы.":"Оригинальная дорожка: "+f.spoken+". Русская озвучка подключается только при подтверждённых правах и наличии файла.");
    $("cinemaDetailsWatch").textContent=f.externalRutube?"↗ Открыть видео на RUTUBE":f.contentType==="Сериалы"&&f.player?"▶ Смотреть выбранную серию":f.discoveryOnly?(f.watchAvailability==="unavailable"?"↗ Проверить статус у сервиса":f.russianAudio?"↗ Проверить просмотр на русском":"↗ Найти легальный просмотр"):"▶ Смотреть";
    $("cinemaDetailsSource").textContent=f.externalRutube?"Оригинальная публикация RUTUBE ↗":f.discoveryOnly?"Страница с языками и доступностью ↗":"Перейти к источнику ↗";
    $("cinemaDetailsSource").href=filmPage(f);
    $("cinemaDetailsLicense").href=f.licenseUrl;
    text("cinemaDetailsLicense",(f.player?"Основание встраивания: ":"Лицензия: ")+f.license+" ↗");
    $("cinemaDetailsFavorite").textContent=state.library.favorites.includes(f.id)?"♥ В избранном":"♡ В избранное";
    const art=$("cinemaDetailsArt");art.replaceChildren();
    art.style.background="radial-gradient(circle at 65% 30%,hsl("+f.hue+" 50% 45%),transparent 62%),linear-gradient(120deg,#29334f,#31223c)";
    if(state.posters.has(f.id)){const image=node("img");image.alt="Кадр из фильма "+f.title;image.src=state.posters.get(f.id);image.onerror=()=>image.remove();art.prepend(image)}
    else if(!f.discoveryOnly)requestPoster(f);
    $("cinemaDetails").classList.remove("hidden");document.body.classList.add("cinema-modal-open");
    if(f.player)fetchApprovedSources(f);
    if(!f.player&&!f.discoveryOnly)getCommons(f).then(src=>{
      if(state.selected?.id!==f.id||!src.poster)return;
      const image=node("img");image.alt="Кадр из фильма "+f.title;image.src=src.poster;image.onerror=()=>image.remove();art.prepend(image);
    }).catch(()=>{});
    try{history.replaceState({film:f.id},"",location.pathname+"?"+new URLSearchParams({...(window.VetogramMediaContext?.embedded?{universe:"1"}:{}),film:f.id}))}catch(_){}
  }
  function closeDetails(){
    state.selected=null;$("cinemaDetails").classList.add("hidden");
    document.body.classList.toggle("cinema-modal-open",Boolean(state.playing));updateBack();
    if(!state.playing)try{history.replaceState({}, "", location.pathname+(window.VetogramMediaContext?.embedded?"?universe=1":""))}catch(_){}
  }
  function toggleFavorite(f){
    const list=state.library.favorites;
    if(list.includes(f.id))state.library.favorites=list.filter(id=>id!==f.id);
    else state.library.favorites=[f.id,...list];
    saveLibrary();buzz();render();$("cinemaDetailsFavorite").textContent=state.library.favorites.includes(f.id)?"♥ В избранном":"♡ В избранное";
  }
  async function shareFilm(f){
    const url=location.origin+location.pathname+"?"+new URLSearchParams({...(window.VetogramMediaContext?.embedded?{universe:"1"}:{}),film:f.id});
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
    if(f.discoveryOnly){
      const official=filmPage(f);
      if(!/^https:\/\//.test(official))return;
      try{if(tg?.openLink)tg.openLink(official);else window.open(official,"_blank","noopener,noreferrer")}
      catch(_){toast("Откройте официальный сервис через ссылку в карточке фильма")}
      return;
    }
    if(state.playing){try{saveProgress(true)}catch(_){}}
    clearTimeout(providerFeedbackTimer);
    try{state.embedHandle?.cleanup()}catch(_){}state.embedHandle=null;
    state.playing=f;setHistory(f);updateBack();buzz();
    window.dispatchEvent(new CustomEvent('vetogram:cinema-playing'));
    const choices=approvedSources(f);
    const current=choices.find(x=>chosenSource&&x.url===chosenSource.url)||chosenSource||choices[0];
    state.activePlayerSource=current||null;
    const providerSelect=$("cinemaProviderSelect");
    $("cinemaSourceSwitch").classList.toggle("hidden",!f.player||choices.length<=1);
    providerSelect.replaceChildren(...choices.map((src,i)=>new Option(sourceLabel(src),String(i))));
    providerSelect.value=String(Math.max(0,choices.findIndex(src=>src.id===current?.id)));
    providerSelect.onchange=()=>{const next=approvedSources(f)[Number(providerSelect.value)];if(next)play(f,next)};
    text("cinemaProviderHint",choices.length>1?choices.length+" проверенных вариантов":"Видеопоток предоставляется источником");
    $("cinemaPlayer").classList.remove("hidden");document.body.classList.add("cinema-modal-open");
    text("cinemaPlayerTitle",f.title);text("cinemaPlayerCredit",f.creator+" · условия источника доступны по ссылке");
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
      if(embedded)providerFeedbackTimer=setTimeout(()=>{
        if(token===state.request)setPlayerMessage("Плеер загружен, но начало просмотра не подтверждено. Нажмите ▶ внутри видео. Если возникает ошибка, выберите другой фильм.");
      },20000);
      try{
        if(!window.VetogramCinemaProvider)throw Error("Модуль видеопровайдера не загрузился");
        const handle=await window.VetogramCinemaProvider.attach({
          video,container:$("cinemaVideoWrap"),source:current,
          allowedIframeOrigins:["https://rutube.ru",...(window.VETOGRAM_CINEMA_EMBED_ORIGINS||[])],
          resumeAt:state.library.progress[f.id]?.t||0,
          onEvent:(event)=>{
            if(token!==state.request||state.playing?.id!==f.id)return;
            if(event.type==="duration"){state.embedDuration=event.duration;return}
            if(event.type==="playStarted"||(event.type==="state"&&event.state==="playing")){
              clearTimeout(providerFeedbackTimer);
              failedEmbeds.delete(f.id);
              setPlayerMessage("");
              return;
            }
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
          onReady:()=>{
            if(token===state.request)setPlayerMessage("Плеер готов. Нажмите ▶, чтобы начать фильм.");
          },
          onError:(reason)=>{
            if(token!==state.request)return;
            clearTimeout(providerFeedbackTimer);
            failedEmbeds.add(f.id);
            setPlayerMessage("Источник не воспроизводит это видео: "+String(reason||"ошибка").slice(0,140)+". Попробуйте другой фильм.");
            render();
          }
        });
        if(token!==state.request){handle.cleanup();return}
        state.embedHandle=handle;
      }catch(error){
        clearTimeout(providerFeedbackTimer);
        if(token===state.request){
        failedEmbeds.add(f.id);
        setPlayerMessage("Плеер недоступен: "+(error?.message||"ошибка")+". Выберите другой фильм.");
        render();
      }
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
  $("cinemaHeroWatch").addEventListener("click",()=>{const f=discovery.slides[discovery.index];if(f)play(f)});
  $("cinemaHeroDetails").addEventListener("click",()=>{const f=discovery.slides[discovery.index];if(f)openDetails(f)});
  $("cinemaHeroPrev").addEventListener("click",()=>setHeroSlide(discovery.index-1));
  $("cinemaHeroNext").addEventListener("click",()=>setHeroSlide(discovery.index+1));
  $("cinemaSearch").addEventListener("input",e=>{state.query=e.target.value.slice(0,90);state.visible=100;if(state.tab==="library")setTab("search");else if(state.tab==="home"){$("cinemaHero").classList.add("hidden")}render();clearTimeout(catalogDebounce);catalogDebounce=setTimeout(()=>fetchCatalog(true),350)});
  $("cinemaClear").addEventListener("click",()=>{$("cinemaSearch").value="";state.query="";state.visible=100;render();fetchCatalog(true)});
  $("cinemaLoadMore").addEventListener("click",()=>fetchCatalog(false));
  $("cinemaStudioMore").addEventListener("click",()=>loadStudio(false));
  $("cinemaForeignAll").addEventListener("click",()=>setTab("foreign"));
  $("cinemaForeignIncludeUnverified").addEventListener("change",event=>{
    state.foreignIncludeUnverified=Boolean(event.target.checked);state.visible=100;render();
  });
  $("cinemaFranchiseAllLanguages").addEventListener("change",event=>{
    state.showUnverified=Boolean(event.target.checked);state.visible=100;
    render();renderFranchise();
  });
  document.querySelectorAll("[data-franchise]").forEach(button=>button.addEventListener("click",()=>{
    discovery.franchise=button.dataset.franchise;renderFranchise();buzz();
  }));
  $("cinemaMoreResults").addEventListener("click",()=>{state.visible=Math.min(1800,state.visible+100);render()});
  $("cinemaMoreStudios").addEventListener("click",loadMoreStudioArchives);
  $("cinemaSort").addEventListener("change",event=>{
    state.sort=["recent","year","title"].includes(event.target.value)?event.target.value:"recent";
    state.visible=100;render();
  });
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
  loadStudio(true).then(()=>{
    if(typeof window.setTimeout==="function")
      window.setTimeout(()=>warmStudioFeeds(),700);
    else warmStudioFeeds();
  });
  fetchCatalog(true);
  if(typeof window.setInterval==="function"&&!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){
    discovery.timer=window.setInterval(()=>{
      if(!document.hidden&&isHome()&&!state.playing&&!state.selected&&discovery.slides.length>1)
        setHeroSlide(discovery.index+1);
    },6800);
  }
  // Exposes only safe navigation for a future Vetogram host. No Telegram privileged auth.
  window.VetogramCinema={
   openFilm:id=>{const f=filmById(id);if(!f)return false;openDetails(f);return true},
   openTab:setTab,
   search:query=>{
    const value=String(query||'').trim().slice(0,90);
    if(value.length<2)return false;
    state.query=value;$("cinemaSearch").value=value;setTab("search");
    return true;
   },
   getLibrary:()=>[...new Set([...(state.library.favorites||[]),...(state.library.history||[]),...Object.keys(state.library.progress||{})])].slice(0,120).flatMap(id=>{
     const f=filmById(id);if(!f)return[];
     const p=state.library.progress[id]||{};
     return[{id:String(id),title:String(f.title||'').slice(0,150),subtitle:String(f.contentType||'Фильм').slice(0,110),
       at:Number(p.at)||0,progress:p.d?Math.max(0,Math.min(1,p.t/p.d)):0,
       source:state.library.favorites.includes(id)?'saved':p.d?'progress':'recent'}];
   })
  };
})();