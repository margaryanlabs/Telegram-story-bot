/**
 * Public RUTUBE metadata for VERIFIED film-studio channels only.
 * Video bytes are NEVER downloaded or proxied. Every title uses the platform
 * public embed and an exact source page. This is not a Netflix/movie scraper.
 *
 * API shape: rutube/ShowcaseTutorial and yt-dlp/extractor/rutube.py.
 * Feed responses have not been validated live in this environment.
 */
export const CHANNELS=Object.freeze({
  mosfilm:Object.freeze({id:25963146,label:"Киноконцерн «Мосфильм»",hue:349,
    channelUrl:"https://rutube.ru/channel/25963146/"}),
  lenfilm:Object.freeze({id:1792500,label:"Киностудия «Ленфильм»",hue:218,
    channelUrl:"https://rutube.ru/channel/1792500/"}),
  gorky:Object.freeze({id:48160110,label:"Киностудия Горького",hue:28,
    channelUrl:"https://rutube.ru/channel/48160110/"})
});
const VIDEO_ID=/^[a-f0-9]{32}$/i;
const EXCLUDE=/(трейлер|тизер|анонс|подкаст|интервью|пресс[- ]?конференц|съёмк|съемк|кастинг|репортаж|фильм о фильме|реклама|шортс|промо)/i;
const IMAGE_HOSTS=new Set(["pic.rutube.ru","pic.rutubelist.ru","pic.rtbcdn.su"]);
const SHORT_TEXT=s=>String(s||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
export function cleanPoster(raw){
  try {const u=new URL(raw);return u.protocol==="https:"&&IMAGE_HOSTS.has(u.hostname)?u.href:null}catch{return null}
}
export function parseVideo(video,channelKey){
  const channel=CHANNELS[channelKey];
  if(!channel||!video||typeof video!=="object")return null;
  const id=String(video.id||"");
  // Some RUTUBE channel APIs represent uploader ID as a number, some as text.
  if(!VIDEO_ID.test(id)||String(video.author?.id||"")!==String(channel.id))return null;
  if(video.is_paid===true||video.is_private===true||video.is_livestream===true||
     video.is_live===true||video.is_embeddable===false||video.embed_allowed===false)return null;
  const seconds=Number(video.duration);
  if(!Number.isFinite(seconds)||seconds<35*60||seconds>6*60*60)return null;
  const title=SHORT_TEXT(video.title).slice(0,230);
  if(!title||EXCLUDE.test(title))return null;
  const description=SHORT_TEXT(video.description).slice(0,1300);
  const yearMatch=/\b(19\d{2}|20[012]\d)\b/.exec(title);
  const year=yearMatch?Number(yearMatch[1]):null;
  const page="https://rutube.ru/video/"+id+"/";
  const embed="https://rutube.ru/play/embed/"+id;
  return {
    id:"rutube-"+channelKey+"-"+id,
    title,original:title,year,minutes:Math.ceil(seconds/60),
    synopsis:description||"Полная версия фильма на официальном канале "+channel.label+".",
    poster:cleanPoster(video.thumbnail_url),
    genres:["Русское кино",channel.label],hue:channel.hue,
    creator:channel.label,spoken:"Русский",
    sourcePage:page,
    license:"Публичный iframe-плеер RUTUBE",
    licenseUrl:"https://rutube.ru/info/embed/",
    player:{id:"rutube:"+id,type:"iframe",provider:"RUTUBE",url:embed,
      licensed:true,license:"Публичное встраивание RUTUBE",credit:channel.label,
      translation:"Русская дорожка (источник)",sourcePage:page},
    editions:[],sourceCatalog:"rutube-official-channel"
  };
}
export function parsePage(data,channelKey,page){
  if(!CHANNELS[channelKey])throw Error("Неизвестный официальный канал");
  if(!data||!Array.isArray(data.results))throw Error("Неверный ответ RUTUBE");
  const reasons={missingId:0,wrongPublisher:0,unknownPublisher:0,shortOrLong:0,blocked:0,notFilm:0};
  const movies=[];
  for(const v of data.results){
    const parsed=parseVideo(v,channelKey);
    if(parsed){movies.push(parsed);continue}
    if(!VIDEO_ID.test(String(v?.id||"")))reasons.missingId++;
    else if(!v?.author?.id)reasons.unknownPublisher++;
    else if(String(v.author.id)!==String(CHANNELS[channelKey].id))reasons.wrongPublisher++;
    else if(!Number.isFinite(Number(v.duration))||Number(v.duration)<35*60||Number(v.duration)>6*60*60)reasons.shortOrLong++;
    else if(v.is_paid===true||v.is_private===true||v.is_livestream===true||v.is_live===true||
        v.is_embeddable===false||v.embed_allowed===false)reasons.blocked++;
    else reasons.notFilm++;
  }
  // RUTUBE reports next as a relative URL or has_next boolean. We never follow
  // arbitrary URLs from its JSON; only increment validated numeric page.
  const hasNext=Boolean(data.has_next||data.next);
  const nextPage=hasNext&&page<120?page+1:null;
  return {channel:channelKey,movies,nextPage,received:data.results.length,
    skipped:data.results.length-movies.length,diagnostics:reasons};
}
const cache=new Map();
const CACHE_MS=10*60*1000;
export async function fetchChannelPage(channelKey,page=1,{fetchFn=fetch,now=Date.now}={}){
  if(!CHANNELS[channelKey])throw Error("Неизвестный официальный канал");
  if(!Number.isInteger(page)||page<1||page>120)throw Error("Неверная страница");
  const key=channelKey+":"+page,time=now();
  const cached=cache.get(key);
  if(cached&&cached.exp>time)return cached.value;
  const id=CHANNELS[channelKey].id;
  const url="https://rutube.ru/api/video/person/"+id+"/?page="+page+"&format=json&origin__type=rtb,rst,ifrm,rspa";
  const response=await fetchFn(url,{
    signal:AbortSignal.timeout(8500),
    headers:{"Accept":"application/json"}
  });
  if(!response.ok)throw Error("RUTUBE metadata: HTTP "+response.status);
  const parsed=parsePage(await response.json(),channelKey,page);
  cache.set(key,{exp:time+CACHE_MS,value:parsed});
  if(cache.size>180){const oldest=cache.keys().next().value;cache.delete(oldest)}
  return parsed;
}
