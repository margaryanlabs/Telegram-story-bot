/* Vetogram Music: mainstream release discovery and original provider playback.
 * The Apple iTunes Search API is used ONLY for promotional metadata and store links,
 * not raw 30-second previews or commercial standalone stream replication.
 * Spotify/Yandex/Apple official embeds belong to their respective providers.
 * No API key, scraping, downloads, DRM bypass, autoplay or hidden players.
 */
(()=>{
"use strict";
const V=window.VetogramMusic,root=document.querySelector('[data-view="hits"]');
if(!V||!root)return;
const $=id=>document.getElementById(id);
const el=(name,cls,content)=>{const t=document.createElement(name);if(cls)t.className=cls;if(content!==undefined)t.textContent=String(content);return t};
const COUNTRY=Object.freeze({ru:"Россия",am:"Армения",us:"США",ge:"Грузия"});
const GENRES=Object.freeze([
 {name:"MACAN",country:"ru"},
 {name:"Баста",country:"ru"},
 {name:"Miyagi",country:"ru"},
 {name:"Sirusho",country:"am"},
 {name:"Rosa Linn",country:"am"},
 {name:"Aram MP3",country:"am"},
 {name:"The Weeknd",country:"us"},
 {name:"Billie Eilish",country:"us"},
 {name:"Dua Lipa",country:"us"},
 {name:"Taylor Swift",country:"us"},
 {name:"Drake",country:"us"}
]);
const LIMIT=45;
function safeUrl(raw,hosts){
 try{
  const url=new URL(String(raw));
  return url.protocol==="https:"&&hosts.includes(url.hostname)&&!url.username&&!url.password?url:"";
 }catch{return""}
}
function safeText(v,max=135){return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function searchUrl(q,c){
 const u=new URL("https://itunes.apple.com/search");
 u.searchParams.set("term",q);u.searchParams.set("media","music");u.searchParams.set("entity","song");
 u.searchParams.set("country",c);u.searchParams.set("limit",String(LIMIT));u.searchParams.set("explicit","Yes");
 return u.href;
}
function fromApple(t){
 if(t?.wrapperType!=="track"||t.kind!=="song"||!Number.isSafeInteger(Number(t.trackId)))return null;
 const trackUrl=safeUrl(t.trackViewUrl,["music.apple.com","itunes.apple.com"]);
 if(!trackUrl)return null;
 const cover=safeUrl(t.artworkUrl100,["is1-ssl.mzstatic.com","is2-ssl.mzstatic.com","is3-ssl.mzstatic.com","is4-ssl.mzstatic.com","is5-ssl.mzstatic.com"]);
 const title=safeText(t.trackName),artist=safeText(t.artistName);
 if(!title||!artist)return null;
 return {id:"apple:"+Number(t.trackId),title,artist,album:safeText(t.collectionName),
  artwork:cover?cover.href:"",url:trackUrl.href,source:"Apple Music",trackId:Number(t.trackId)};
}
// Only accept existing official Spotify, Yandex Music and Apple Music share links.
function fromShare(input){
 const src=safeUrl(input,["open.spotify.com","music.yandex.ru","music.apple.com","embed.music.apple.com"]);
 if(!src)return null;
 if(src.hostname==="open.spotify.com"){
  const p=src.pathname.match(/^\/(track|album|playlist)\/([A-Za-z0-9]{22})\/?$/);
  if(!p)return null;
  return {provider:"Spotify",type:p[1],page:"https://open.spotify.com/"+p[1]+"/"+p[2],
    embed:"https://open.spotify.com/embed/"+p[1]+"/"+p[2],title:"Spotify · "+(p[1]==="track"?"Трек":p[1]==="album"?"Альбом":"Плейлист"),height:p[1]==="track"?160:355};
 }
 if(src.hostname==="music.yandex.ru"){
  let track="",album="";
  const p=src.pathname.match(/^\/album\/(\d+)\/track\/(\d+)\/?$/);
  const f=src.hash.match(/^#track\/(\d+)\/(\d+)$/);
  if(p){album=p[1];track=p[2]}else if(f){track=f[1];album=f[2]}else return null;
  return {provider:"Яндекс Музыка",type:"track",title:"Яндекс Музыка · Трек",
    page:"https://music.yandex.ru/album/"+album+"/track/"+track,
    embed:"https://music.yandex.ru/iframe/#track/"+track+"/"+album,height:185};
 }
 const p=src.pathname.match(/^\/([a-z]{2})\/album\/([^/]+)\/(\d+)\/?$/);
 if(!p)return null;
 const id=src.searchParams.get("i");
 if(id&&!/^\d{1,19}$/.test(id))return null;
 const url="https://embed.music.apple.com/"+p[1]+"/album/"+encodeURIComponent(p[2])+"/"+p[3]+(id?"?i="+id:"");
 const page="https://music.apple.com/"+p[1]+"/album/"+encodeURIComponent(p[2])+"/"+p[3]+(id?"?i="+id:"");
 return {provider:"Apple Music",type:id?"track":"album",title:"Apple Music · "+(id?"Трек":"Альбом"),page,embed:url,height:id?180:440};
}
let query="",country="ru",controller=null,results=[],active=null;
function hint(message){$("hitsStatus").textContent=message}
function actionLink(text,href,cls){
 const anchor=el("a",cls,text);anchor.href=href;anchor.target="_blank";anchor.rel="noopener noreferrer";return anchor;
}
function openFrame(obj,headline){
 const box=$("hitsEmbed");box.replaceChildren();
 // Pauses the existing player, preserving the official provider player UI and controls.
 try{document.getElementById("audio")?.pause()}catch{}
 const frame=el("iframe","hits-iframe");frame.src=obj.embed;frame.title=headline||obj.title;
 frame.loading="eager";frame.referrerPolicy="strict-origin-when-cross-origin";
 frame.allow="encrypted-media; autoplay; clipboard-write; fullscreen; picture-in-picture";
 frame.allowFullscreen=true;
 frame.height=String(obj.height||200);
 box.append(frame);
 const caption=$("hitsCurrent");caption.textContent=headline||obj.title;
 const link=$("hitsExternal");link.href=obj.page;link.textContent="Открыть у "+obj.provider+" ↗";
 $("hitsFrameNotice").textContent="Работает официальный плеер "+obj.provider+". Доступность полного трека зависит от аккаунта, региона, браузера и правил поставщика. Здесь нет собственного MP3-потока.";
 active=obj;
 $("hitsPlayer").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function render(){
 const list=$("hitsResults");list.replaceChildren();
 if(!results.length){list.append(el("div","hits-empty","По этому запросу результатов нет. Попробуй имя исполнителя или другое название."));return}
 for(const t of results){
  const card=el("article","hits-track");
  if(t.artwork){const img=el("img","hits-cover");img.src=t.artwork;img.loading="lazy";img.alt="";card.append(img)}
  else card.append(el("span","hits-placeholder","♫"));
  const body=el("div","hits-meta");body.append(el("strong","",t.title),el("span","",t.artist),el("small","","APPLE MUSIC · "+t.album));
  const actions=el("div","hits-actions");
  const official=actionLink("Источник: Apple Music ↗",t.url,"hits-apple-link");
  official.setAttribute("aria-label","Открыть "+t.title+" у Apple Music");
  const embed=el("button","hits-embed-button","◈ Официальный плеер Apple");embed.type="button";
  embed.setAttribute("aria-label","Открыть официальный плеер "+t.title);
  embed.onclick=()=>{const ep=fromShare(t.url);if(ep)openFrame(ep,t.artist+" — "+t.title);else hint("Плеер для этой ссылки недоступен. Отображаем только информацию о релизе.")};
  actions.append(embed,official);body.append(actions);card.append(body);list.append(card);
 }
}
async function search(q,region){
 const term=safeText(q,80);
 if(term.length<2){hint("Введи минимум два символа");return}
 if(!Object.hasOwn(COUNTRY,region))region="am";
 controller?.abort();const ctl=new AbortController();controller=ctl;
 query=term;country=region;results=[];
 $("hitsQuery").value=term;$("hitsCountry").value=region;
 const list=$("hitsResults");list.replaceChildren(el("div","hits-empty","Ищем официальные релизы…"));
 hint("Apple Music: поиск "+term+" · "+COUNTRY[region]+"…");
 const timer=setTimeout(()=>ctl.abort(),13000);
 try{
  const response=await fetch(searchUrl(term,region),{signal:ctl.signal,credentials:"omit"});
  if(!response.ok)throw Error("HTTP "+response.status);
  if(Number(response.headers.get("content-length")||0)>1400000)throw Error("Response too large");
  const raw=await response.text();if(raw.length>1400000)throw Error("Response too large");
  const data=JSON.parse(raw);if(controller!==ctl)return;
  const ids=new Set();
  for(const t of Array.isArray(data.results)?data.results:[]){
   const song=fromApple(t);if(song&&!ids.has(song.id)){results.push(song);ids.add(song.id)}
  }
  hint(results.length+" официальных релизов · "+COUNTRY[region]+". Это поиск названий и плеер Apple Music внутри страницы, а НЕ свободные аудиопотоки для нашего плеера.");
  render();
 }catch(e){
  if(controller!==ctl)return;
  list.replaceChildren(el("div","hits-empty","Сервис поиска сейчас недоступен. Попробуй позднее или открой официальный источник."));
  hint(e?.name==="AbortError"?"Превышено время ожидания Apple Search API.":"Не удалось выполнить поиск. Apple может ограничивать число запросов.");
 }finally{clearTimeout(timer)}
}
function presets(){
 const box=$("hitsPresets");box.replaceChildren();
 for(const p of GENRES){
  const b=el("button","hits-pill",p.name);b.type="button";
  b.onclick=()=>{country=p.country;search(p.name,country)};
  box.append(b);
 }
}
$("hitsForm").onsubmit=e=>{e.preventDefault();search($("hitsQuery").value,$("hitsCountry").value)};
$("hitsProviderForm").onsubmit=e=>{
 e.preventDefault();const t=fromShare($("hitsProviderLink").value.trim());
 if(!t){hint("Поддерживаются официальные ссылки Spotify, Apple Music и Яндекс Музыки. Для Яндекса нужна ссылка с ID альбома и трека.");return}
 openFrame(t,t.title);
 hint("Открыт официальный плеер "+t.provider+". Воспроизведение зависит от его ограничений.");
};
$("hitsClose").onclick=()=>{$("hitsEmbed").replaceChildren();$("hitsCurrent").textContent="Плеер закрыт";$("hitsExternal").removeAttribute("href");active=null};
presets();
document.addEventListener("vetogram:hits-open",()=>{if(!query&&!controller)search("MACAN","ru")});
window.VetogramHits=Object.freeze({search,fromApple,fromShare,searchUrl,state:()=>({query,country,count:results.length,provider:active?.provider||""})});
})();
