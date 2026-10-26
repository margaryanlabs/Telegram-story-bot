/* VETO MEDIA Films v1 · authorized open archive, no major-label/video scraping */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const ARCHIVE="https://archive.org";
  const query="collection:prelinger AND mediatype:movies AND licenseurl:*publicdomain*";
  let loaded=false,items=[],loading=false,filter="",selected=null,activeRequest=0;
  const node=(tag,klass,label)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(label!==undefined)e.textContent=String(label);return e};
  const validId=(id)=>/^[A-Za-z0-9_.-]{3,120}$/.test(String(id));
  const clean=(value)=>String(value||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").slice(0,300).trim();
  const backdrop=(item)=>"linear-gradient(180deg,rgba(8,12,23,.03),rgba(7,10,20,.87)),url("+JSON.stringify(ARCHIVE+"/services/img/"+encodeURIComponent(item.id))+")";
  function showError(msg) {
    const target=$("vetoFilmRail"); if(!target)return;
    target.replaceChildren();
    const panel=node("div","veto-film-notice",msg+" ");
    const a=node("a","","Открыть архив кино ↗"); a.href=ARCHIVE+"/details/prelinger";a.rel="noopener noreferrer";a.target="_blank";
    panel.append(a);target.append(panel);
  }
  function card(item,wide=false) {
    const el=node("article",wide?"veto-film-item veto-film-item-wide":"veto-film-item");
    el.style.backgroundImage=backdrop(item);
    const top=node("div","veto-film-top","OPEN CULTURE / ARCHIVE");
    const bottom=node("div","veto-film-bottom");
    bottom.append(node("small","",item.year+" · PUBLIC DOMAIN MARK (U.S.)"),node("strong","",item.title));
    const button=node("button","veto-film-play","▶ Смотреть");button.type="button";button.addEventListener("click",()=>open(item));
    bottom.append(button);el.append(top,bottom);return el;
  }
  function paint() {
    const rail=$("vetoFilmRail"),grid=$("vetoFilmGrid");if(!rail||!grid)return;
    rail.replaceChildren();grid.replaceChildren();
    const q=filter.toLocaleLowerCase("ru-RU").trim();
    const display=items.filter(x=>(x.title+" "+x.year).toLocaleLowerCase("ru-RU").includes(q));
    if(!display.length){rail.append(node("div","veto-film-notice",filter?"Ничего не найдено.":"Нет доступных фильмов."));return;}
    display.forEach((item,index)=>{rail.append(card(item,true));if(index<6)grid.append(card(item))});
    const first=display[0];
    $("vetoFilmTitle").textContent=first.title;
    $("vetoFilmDescription").textContent="Архивный фильм "+first.year+". Запись опубликована с отметкой public domain; проверьте права в своей стране.";
    $("vetoFilmHero").style.backgroundImage=backdrop(first);
    $("vetoFilmHero").style.backgroundPosition="center";
    $("vetoFilmHero").style.backgroundSize="cover";
    $("vetoFilmSpotlight").onclick=()=>open(first);
    $("vetoFilmCount").textContent=display.length+" фильмов";
  }
  async function load(force=false) {
    if(loading||loaded&&!force)return;
    if(!$("vetoFilmRail"))return;
    loaded=true;loading=true;const req=++activeRequest;
    $("vetoFilmRail").replaceChildren(node("div","veto-film-notice","Ищем архивное кино…"));
    const params=new URLSearchParams({q:query,rows:"24",output:"json"});
    for(const field of ["identifier","title","year","date","licenseurl"])params.append("fl[]",field);
    params.append("sort[]","downloads desc");
    const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),7500);
    try {
      const response=await fetch(ARCHIVE+"/advancedsearch.php?"+params,{signal:timeout.signal,headers:{Accept:"application/json"}});
      if(!response.ok)throw Error("HTTP "+response.status);
      const data=await response.json();
      if(req!==activeRequest)return;
      items=(Array.isArray(data.response?.docs)?data.response.docs:[])
        .filter(x=>validId(x.identifier)&&/publicdomain/i.test(String(x.licenseurl||"")))
        .map(x=>({id:String(x.identifier),title:clean(x.title)||"Без названия",year:clean(x.year||x.date||"Архив").slice(0,4)}));
      if(!items.length)throw Error("Empty selection");
      paint();
    } catch (_) {
      if(req===activeRequest)showError("Internet Archive недоступен из этого браузера. В VETO нет нелицензированных фильмов.");
    } finally {clearTimeout(timer);loading=false}
  }
  function open(item) {
    if(!item||!validId(item.id))return;
    selected=item;
    const overlay=$("vetoFilmOverlay");
    $("vetoFilmModalTitle").textContent=item.title;
    $("vetoFilmModalLabel").textContent=item.year+" · Архивное кино";
    $("vetoFilmEmbed").replaceChildren();
    $("vetoFilmOriginal").href=ARCHIVE+"/details/"+encodeURIComponent(item.id);
    $("vetoFilmEmbedButton").disabled=false;
    overlay.classList.remove("hidden");document.body.classList.add("veto-film-open");
  }
  function close() {
    $("vetoFilmOverlay")?.classList.add("hidden");
    $("vetoFilmEmbed")?.replaceChildren();
    selected=null;document.body.classList.remove("veto-film-open");
  }
  function embed() {
    if(!selected)return;
    const frame=node("iframe","veto-film-iframe");
    frame.src=ARCHIVE+"/embed/"+encodeURIComponent(selected.id);
    frame.title="Плеер Internet Archive: "+selected.title;
    frame.loading="lazy";frame.referrerPolicy="no-referrer";
    frame.allow="autoplay; fullscreen; picture-in-picture";frame.allowFullscreen=true;
    $("vetoFilmEmbed").replaceChildren(frame);
    $("vetoFilmEmbedButton").disabled=true;
  }
  function init() {
    if(!$("vetoFilmRail"))return;
    $("vetoFilmRetry").onclick=()=>load(true);
    $("vetoFilmPrev").onclick=()=>$("vetoFilmRail").scrollBy({left:-300,behavior:"smooth"});
    $("vetoFilmNext").onclick=()=>$("vetoFilmRail").scrollBy({left:300,behavior:"smooth"});
    $("vetoFilmSearch").oninput=e=>{filter=e.target.value.slice(0,100);paint()};
    $("vetoFilmClose").onclick=close;
    $("vetoFilmEmbedButton").onclick=embed;
    $("vetoFilmOverlay").addEventListener("click",e=>{if(e.target.id==="vetoFilmOverlay")close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("vetoFilmOverlay").classList.contains("hidden"))close()});
    window.VetoFilms={load,close};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();