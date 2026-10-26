/* VETO MEDIA V11 · unified human-initiated search across distinct legal source types.
   Catalog != streaming rights. Uses only public read APIs and HTTPS source links. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const root = $("discoverView"); if (!root) return;
  const el=(tag,cls,value)=>{const item=document.createElement(tag);if(cls)item.className=cls;if(value!==undefined)item.textContent=String(value);return item;};
  const clean=(v,max=220)=>String(v??"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim().slice(0,max);
  const url=(value)=>{try{const valueUrl=new URL(String(value));return valueUrl.protocol==="https:"?valueUrl.href:"";}catch{return"";}};
  const types=["music","shows","books","films"];
  const sourceNames={music:"Audius",shows:"TVmaze",books:"Project Gutenberg",films:"Internet Archive"};
  const typeNames={music:"Музыка",shows:"Сериалы",books:"Книги",films:"Киноархив"};
  const sourceState={music:"idle",shows:"idle",books:"idle",films:"idle"};
  const groups={music:[],shows:[],books:[],films:[]};
  const cache=new Map();const savedKey="veto-media-discovery-v11";
  let selected="all",sequence=0,abort=null,currentQuery="",chosen=null,saved=[];
  function savedRead(){
    try{const parsed=JSON.parse(localStorage.getItem(savedKey)||"[]");
      return Array.isArray(parsed)?parsed.slice(0,100).filter(x=>x&&types.includes(x.type)&&typeof x.id==="string"&&typeof x.title==="string"&&url(x.href)).map(x=>({type:x.type,id:clean(x.id,110),title:clean(x.title,150),subtitle:clean(x.subtitle,130),href:url(x.href)})):[];
    }catch{return[]}
  }
  saved=savedRead();
  const isSaved=item=>saved.some(x=>x.type===item.type&&x.id===item.id);
  const save=item=>{
    const before=saved.slice(),index=saved.findIndex(x=>x.type===item.type&&x.id===item.id);
    if(index>=0)saved.splice(index,1);
    else saved.unshift({type:item.type,id:item.id,title:item.title,subtitle:item.subtitle,href:item.href});
    saved=saved.slice(0,100);
    try{localStorage.setItem(savedKey,JSON.stringify(saved));}
    catch{saved=before;announce("Локальное сохранение недоступно.");return;}
    paintSaved();render();
  };
  function announce(text){$("v11Status").textContent=text;}
  function audio(raw){
    const art=url(raw?.artwork?.["480x480"]||raw?.artwork?.["150x150"]||"");
    return {type:"music",id:clean(raw?.id,110),title:clean(raw?.title,150),
      subtitle:clean(raw?.user?.name||raw?.user?.handle||"Независимый артист",130),
      image:art,href:url(raw?.permalink)||"https://audius.co/",label:"ТРЕК · AUDIUS",raw};
  }
  function show(raw){
    const sh=raw?.show||raw;
    if(!Number.isFinite(Number(sh?.id))||!sh?.name)return null;
    return {type:"shows",id:String(sh.id),title:clean(sh.name,150),
      subtitle:clean([sh.premiered?.slice(0,4),sh.genres?.slice(0,2)?.join(" · ")].filter(Boolean).join(" · ")||"Сериал",130),
      image:url(sh.image?.medium||sh.image?.original),href:url(sh.url)||"https://www.tvmaze.com/",
      label:"СЕРИАЛ · ИНФОРМАЦИЯ",detail:clean(sh.summary||"",850),lang:clean(sh.language||"",25),
      genres:Array.isArray(sh.genres)?sh.genres.slice(0,5).map(x=>clean(x,30)):[],status:clean(sh.status||"",40)};
  }
  function book(raw){
    if(raw?.copyright!==false||!Number.isInteger(Number(raw.id)))return null;
    return {type:"books",id:String(raw.id),title:clean(raw.title,150),
      subtitle:clean(raw.authors?.[0]?.name||"Автор не указан",130),
      image:url(raw.formats?.["image/jpeg"]),href:"https://www.gutenberg.org/ebooks/"+encodeURIComponent(raw.id),
      label:"КНИГА · ОБЩЕСТВЕННОЕ ДОСТОЯНИЕ",raw};
  }
  function archive(raw){
    const id=String(raw?.identifier||"");
    if(!/^[A-Za-z0-9_.-]{3,120}$/.test(id)||!/publicdomain/i.test(String(raw.licenseurl||"")))return null;
    return {type:"films",id,title:clean(raw.title||"Архивная запись",150),
      subtitle:clean(raw.year||raw.date||"Архивная запись",130),
      image:"https://archive.org/services/img/"+encodeURIComponent(id),
      href:"https://archive.org/details/"+encodeURIComponent(id),
      label:"АРХИВ · ОТМЕТКА PUBLIC DOMAIN"};
  }
  function endpoint(type,q){
    if(type==="music")return "https://api.audius.co/v1/tracks/search?query="+encodeURIComponent(q)+"&limit=10";
    if(type==="shows")return "https://api.tvmaze.com/search/shows?q="+encodeURIComponent(q);
    if(type==="books")return "https://gutendex.com/books?search="+encodeURIComponent(q);
    const words=q.replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(x=>x.length>1).slice(0,5);
    const terms=words.map(x=>"title:"+x+"*").join(" AND ");
    const args=new URLSearchParams({q:"collection:prelinger AND mediatype:movies AND licenseurl:*publicdomain*"+(terms?" AND ("+terms+")":""),
      output:"json",rows:"10"});
    ["identifier","title","year","date","licenseurl"].forEach(x=>args.append("fl[]",x));
    return "https://archive.org/advancedsearch.php?"+args;
  }
  function parseProvider(type,body){
    let arr=[];
    if(type==="music")arr=(Array.isArray(body?.data)?body.data:[]).filter(x=>x?.id&&x?.title&&!x.is_stream_gated&&!x.is_delete&&!x.is_unlisted).map(audio);
    if(type==="shows")arr=(Array.isArray(body)?body:[]).map(show);
    if(type==="books")arr=(Array.isArray(body?.results)?body.results:[]).map(book);
    if(type==="films")arr=(Array.isArray(body?.response?.docs)?body.response.docs:[]).map(archive);
    return arr.filter(x=>x?.title&&x.href).slice(0,10);
  }
  async function one(type,query,seq,controller){
    const key=type+"|"+query.toLocaleLowerCase("ru-RU");
    const previous=cache.get(key);
    if(previous&&Date.now()-previous.when<300000){
      if(seq!==sequence)return;
      groups[type]=previous.data;sourceState[type]="done";render();return;
    }
    try{
      const resp=await fetch(endpoint(type,query),{signal:controller.signal,headers:{Accept:"application/json"}});
      if(!resp.ok)throw Error("HTTP "+resp.status);
      const data=parseProvider(type,await resp.json());
      if(seq!==sequence)return;
      groups[type]=data;cache.set(key,{when:Date.now(),data});sourceState[type]="done";
    }catch(err){
      if(seq!==sequence)return;
      sourceState[type]=err?.name==="AbortError"?"timeout":"error";groups[type]=[];
    }finally{if(seq===sequence)render();}
  }
  async function run(value){
    const text=clean(value,80);
    if(text.length<2){announce("Введи не менее двух символов для поиска.");return;}
    currentQuery=text;$("v11Search").value=text;
    const seq=++sequence;if(abort)abort.abort();
    abort=new AbortController();
    for(const type of types){sourceState[type]="loading";groups[type]=[];}
    announce("Ищем «"+text+"» в четырёх каталогах…");render();
    const timer=setTimeout(()=>abort?.abort(),11000);
    try{await Promise.allSettled(types.map(type=>one(type,text,seq,abort)));}finally{clearTimeout(timer);}
    if(seq!==sequence)return;
    const total=types.reduce((n,t)=>n+groups[t].length,0);
    const failures=types.filter(t=>sourceState[t]!=="done").length;
    announce("Найдено "+total+" результатов"+(failures?"; "+failures+" источника(ов) не ответили":"")+". У каждого свой источник и права.");
  }
  function plainLink(item,text){
    const a=el("a","v11-source",text);a.href=item.href;a.target="_blank";a.rel="noopener noreferrer";return a;
  }
  function photo(item){
    const div=el("div","v11-artwork");
    if(item.image){const img=el("img");img.src=item.image;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";img.addEventListener("error",()=>img.remove());div.append(img);}
    div.append(el("span","v11-fallback",item.type==="music"?"♫":item.type==="shows"?"◉":item.type==="books"?"▤":"✦"));
    return div;
  }
  function card(item){
    const article=el("article","v11-card");article.append(photo(item));
    const body=el("div","v11-card-body");
    body.append(el("small","v11-type",item.label),el("h4","",item.title),el("p","",item.subtitle));
    if(item.type==="shows"){body.append(el("div","v11-legal","Метаданные TVmaze. Не видеоплеер."));}
    if(item.type==="films")body.append(el("div","v11-legal","Архивная запись. Проверяй права для своей страны."));
    const actions=el("div","v11-card-actions");
    if(item.type==="music"){
      const play=el("button","v11-primary","▶ Слушать");
      play.type="button";play.addEventListener("click",()=>{
        try{window.VetoMediaMusic?.playMatchedAudius(item.raw);
          if(!window.VetoMediaMusic)throw Error("Player unavailable");
          announce("Пробуем воспроизвести через Audius. Доступность потока зависит от записи.");}
        catch{announce("Не удалось запустить запись. Открой источник Audius.");}
      });
      actions.append(play);
    } else if(item.type==="books"){
      const read=el("button","v11-primary","▤ Читать");
      read.type="button";read.addEventListener("click",()=>{
        if(typeof window.VetoMediaBooks?.openPublicDomain==="function"){window.VetoMediaBooks.openPublicDomain(item.raw);}
        else window.open(item.href,"_blank","noopener,noreferrer");
      });actions.append(read);
    } else if(item.type==="shows"){
      const button=el("button","v11-primary","Описание");button.type="button";button.addEventListener("click",()=>openDetail(item));actions.append(button);
    }
    actions.append(plainLink(item,"Источник ↗"));
    const fav=el("button","v11-heart",isSaved(item)?"♥":"♡");
    fav.type="button";fav.setAttribute("aria-label",isSaved(item)?"Удалить из Моего":"Сохранить в Моё");fav.setAttribute("aria-pressed",String(isSaved(item)));
    fav.addEventListener("click",()=>save(item));actions.append(fav);
    body.append(actions);article.append(body);return article;
  }
  function counts(){
    const line=$("v11ProviderStatus");line.replaceChildren();
    for(const type of types){
      const state=sourceState[type];
      const b=el("span","v11-provider"+(state==="done"?" ok":state==="error"||state==="timeout"?" fail":""),
        sourceNames[type]+" · "+(state==="loading"?"ищем":state==="done"?groups[type].length:state==="idle"?"—":"недоступен"));
      line.append(b);
    }
    for(const chip of root.querySelectorAll("[data-v11-filter]")){
      const t=chip.dataset.v11Filter;
      chip.classList.toggle("active",selected===t);
      chip.setAttribute("aria-pressed",String(selected===t));
      const count=t==="all"?types.reduce((n,x)=>n+groups[x].length,0):groups[t].length;
      chip.querySelector("small").textContent=String(count);
    }
  }
  function render(){
    counts();const target=$("v11Results");target.replaceChildren();
    const cat=selected==="all"?types:[selected];
    const items=cat.flatMap(t=>groups[t]);
    if(!items.length){
      const started=!!currentQuery,loading=cat.some(t=>sourceState[t]==="loading");
      target.append(el("div","v11-empty",!started?"Введи запрос или выбери готовую тему для поиска.":loading?"Каталоги отвечают…":"Здесь пока нет результатов. Попробуй другой запрос или раздел."));
      return;
    }
    const grid=el("div","v11-results-grid");
    for(const item of items)grid.append(card(item));
    target.append(grid);
  }
  function paintSaved(){
    const target=$("v11Saved");target.replaceChildren();
    $("v11SavedCount").textContent=saved.length+" сохранено";
    if(!saved.length){target.append(el("span","v11-muted","Добавь произведения из результатов поиска — они сохранятся только в этом браузере."));return;}
    for(const item of saved.slice(0,15)){
      const row=el("div","v11-saved-row");
      const meta=el("div");meta.append(el("strong","",item.title),el("small","",typeNames[item.type]+" · "+item.subtitle));
      const a=plainLink(item,"Источник ↗");
      const b=el("button","v11-save-remove","×");b.type="button";b.setAttribute("aria-label","Удалить "+item.title);b.onclick=()=>save(item);
      row.append(meta,a,b);target.append(row);
    }
  }
  function openDetail(item){
    chosen=item;
    $("v11DetailTitle").textContent=item.title;
    $("v11DetailInfo").textContent=[item.subtitle,item.status,item.lang,item.genres.join(" · ")].filter(Boolean).join(" · ");
    $("v11DetailText").textContent=item.detail||"Дополнительное описание не предоставлено.";
    const a=$("v11DetailSource");a.href=item.href;a.textContent="Подробнее на TVmaze ↗";
    const modal=$("v11DetailModal");modal.classList.remove("hidden");document.body.classList.add("v11-modal-open");
    $("v11DetailClose").focus();
  }
  function closeDetail(){chosen=null;$("v11DetailModal").classList.add("hidden");document.body.classList.remove("v11-modal-open");}
  $("v11DetailClose").addEventListener("click",closeDetail);
  $("v11DetailModal").addEventListener("click",e=>{if(e.target===$("v11DetailModal"))closeDetail();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("v11DetailModal").classList.contains("hidden"))closeDetail();});
  $("v11SearchForm").addEventListener("submit",e=>{e.preventDefault();run($("v11Search").value);});
  for(const b of root.querySelectorAll("[data-v11-filter]"))b.addEventListener("click",()=>{selected=b.dataset.v11Filter;render();});
  for(const b of root.querySelectorAll("[data-v11-prompt]"))b.addEventListener("click",()=>run(b.dataset.v11Prompt));
  const go=()=>{document.querySelector('.tab[data-tab="discover"]')?.click();root.scrollIntoView({behavior:"smooth",block:"start"});};
  const home=$("homeView");
  if(home){
    const link=el("button","v11-home-link","✦ Искать музыку, фильмы, сериалы и книги →");link.type="button";link.addEventListener("click",go);
    home.append(link);
  }
  const library=$("libraryView");
  if(library){
    const panel=el("section","v11-library-saved");
    const head=el("div","v11-library-head");head.append(el("strong","","Сохранённые из поиска"));
    const count=el("small","v11-saved-count","0 сохранено");count.id="v11SavedCount";head.append(count);
    const rows=el("div","v11-library-rows");rows.id="v11Saved";
    panel.append(head,rows);library.append(panel);
  }
  paintSaved();render();
  window.VetoMediaDiscovery=Object.freeze({search:run,results:()=>Object.fromEntries(types.map(t=>[t,groups[t].map(x=>({type:x.type,title:x.title,id:x.id}))]))});
})();