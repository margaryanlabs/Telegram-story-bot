/* VETO MEDIA · provider hub: capability truth, no fake connections. */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id),home=$("homeView")||$("home");
 if(!home||$("v14ProviderHub"))return;
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
 const entries=[
 {mark:"♫",name:"Audius",note:"Независимая музыка",status:"Потоки · по доступности",kind:"stream",page:"music"},
 {mark:"◉",name:"Live Radio",note:"Radio Browser",status:"Прямой эфир · по доступности",kind:"stream",page:"music",target:"v14Broadcast"},
 {mark:"◎",name:"Apple Podcasts",note:"Поиск и переходы",status:"Каталог",kind:"catalog",page:"music",target:"v14Broadcast",podcasts:true},
 {mark:"◈",name:"TVmaze",note:"Сериалы, актёры и жанры",status:"Каталог · без серий",kind:"catalog",page:"discover"},
 {mark:"▤",name:"Gutenberg",note:"Классика и чтение",status:"Открытые произведения",kind:"open",page:"books"},
 {mark:"✦",name:"Internet Archive",note:"Историческое кино",status:"Архив · проверка прав",kind:"open",page:"films"},
 {mark:"◍",name:"LibriVox",note:"Аудиокниги",status:"Открытые записи",kind:"open",page:"audiobooks"},
 {mark:"⇄",name:"VK / Spotify",note:"Перенос названий и плейлистов",status:"CSV / JSON / TXT · без MP3",kind:"import",page:"music",target:"v10Import"}
 ];
 const section=el("section","v14-providers");section.id="v14ProviderHub";
 const head=el("div","v14-providers-head");
 const desc=el("div");desc.append(el("small","v14-providers-overline","VETO MEDIA · CONNECTED UNIVERSE"),
  el("h2","","Разные источники. Одна вселенная."),
  el("p","","Всё в одном интерфейсе — с честным указанием прав и типа доступа. Мы не требуем пароли от музыкальных сервисов."));
 head.append(desc);
 const count=el("div","v14-provider-count");
 count.append(el("strong","",String(entries.length).padStart(2,"0")),el("span","","источников и способов импорта"));
 head.append(count);section.append(head);
 const grid=el("div","v14-provider-grid");section.append(grid);
 function jump(entry){
  const alternate={audiobooks:"audio",library:"mine"};
  const btn=document.querySelector('.tab[data-tab="'+entry.page+'"]')||
    document.querySelector('.v4-dock [data-open="'+entry.page+'"]')||
    document.querySelector('[data-page="'+entry.page+'"]')||
    document.querySelector('[data-page="'+(alternate[entry.page]||entry.page)+'"]');
  if(btn&&btn.tagName!=="SECTION")btn.click();
  const target=entry.target&&$(entry.target);
  if(entry.podcasts&&window.VetoMediaBroadcast?.setTab)window.VetoMediaBroadcast.setTab("podcast");
  if(target)target.scrollIntoView({behavior:"smooth",block:"start"});
  else window.scrollTo({top:0,behavior:"smooth"});
 }
 for(const entry of entries){
  const card=el("button","v14-provider-card");card.type="button";
  card.append(el("span","v14-provider-symbol",entry.mark));
  const text=el("div","v14-provider-cardcopy");text.append(el("strong","",entry.name),el("small","",entry.note));
  const label=el("span","v14-provider-status "+entry.kind,entry.status);
  const arrow=el("span","v14-provider-arrow","↗");
  card.append(text,label,arrow);
  card.addEventListener("click",()=>jump(entry));
  grid.append(card);
 }
 const note=el("p","v14-provider-note","Нет лицензированного доступа к платной музыке VK, Spotify или Яндекса через VETO. Импортируем только списки, если пользователь их предоставляет. Apple Podcasts здесь — каталог, не собственный сервис распространения выпусков.");
 section.append(note);
 const hero=home.querySelector(".hero,.v4-home-hero");
 if(hero)hero.insertAdjacentElement("afterend",section);
 else home.append(section);
})();
