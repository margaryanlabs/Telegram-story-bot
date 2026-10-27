/** Vetogram Music source adapters. Never return a pirate mirror or proxy paywalled content. */
export const SOURCE_STATUS=Object.freeze({
 audius:{name:"Audius",search:true,charts:true,playback:"provider_stream",auth:"public_read"},
 radio:{name:"Radio Browser",search:true,charts:false,playback:"broadcaster_stream",auth:"public_read"},
 vk:{name:"VK Музыка",search:false,charts:false,playback:"not_available",auth:"no_general_public_stream_api",import:"user_supplied_metadata"},
 yandex:{name:"Яндекс Музыка",search:false,charts:false,playback:"not_available",auth:"no_general_public_stream_api",import:"user_supplied_metadata"}
});
export function safeHttps(raw) {
 try {const u=new URL(String(raw));return u.protocol==="https:"&&!u.username&&!u.password?u.href:"";}catch{return""}
}
export function clean(raw,max=140){return String(raw??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max)}
export function publicId(raw){const id=clean(raw,120);return /^[A-Za-z0-9_-]{1,120}$/.test(id)?id:"";}
export function mapAudius(raw){
 const id=publicId(raw?.id);
 if(!id||!clean(raw?.title)||raw?.is_stream_gated||raw?.is_delete||raw?.is_unlisted)return null;
 return {
  id:"audius:"+id,source:"audius",provider:"Audius",
  title:clean(raw.title,140),artist:clean(raw.user?.name||raw.user?.handle||"Audius",100),
  artwork:safeHttps(raw.artwork?.["480x480"]||raw.artwork?.["150x150"]),
  permalink:safeHttps(raw.permalink)||"https://audius.co/",
  duration:Number.isFinite(Number(raw.duration))?Math.max(0,Math.round(Number(raw.duration))):0,
  stream_url:"https://api.audius.co/v1/tracks/"+encodeURIComponent(id)+"/stream",
  playable:true
 };
}
export function mapRadio(raw){
 const station=clean(raw?.stationuuid,100),stream=safeHttps(raw?.url_resolved||raw?.url);
 if(!station||!raw?.name||!raw?.lastcheckok||!stream||raw?.hls||/\.m3u8(?:\?|$)/i.test(new URL(stream).pathname))return null;
 return {id:"radio:"+station,source:"radio",provider:"Radio Browser",title:clean(raw.name),
 artist:clean(raw.country||raw.tags||"Live radio",100),artwork:safeHttps(raw.favicon),
 homepage:safeHttps(raw.homepage)||"https://www.radio-browser.info/",stream_url:stream,
 playable:true,codec:clean(raw.codec,20)};
}
export function parseQuery(q){
 const value=clean(q,80);
 if(value.length<2)throw Object.assign(new Error("Запрос должен содержать от 2 до 80 символов"),{status:400});
 return value;
}
export function buildAudiusUrl(action,params={}){
 const path=action==="charts"?"trending":action==="search"?"search":null;
 if(!path)throw Object.assign(new Error("Неизвестный ресурс Audius"),{status:400});
 const u=new URL("https://api.audius.co/v1/tracks/"+path);
 const limit=Math.min(action==="charts"?30:25,Math.max(1,Number(params.limit)||25));
 u.searchParams.set("limit",String(limit));
 if(action==="search")u.searchParams.set("query",parseQuery(params.q));
 if(action==="charts"){
  const period=params.period||"week";
  if(!["week","month","year","allTime"].includes(period))throw Object.assign(new Error("Неизвестный период"),{status:400});
  u.searchParams.set("time",period);
  if(params.genre&&params.genre!=="all"){
   if(!["Pop","Electronic","Hip-Hop/Rap","Rock","Jazz"].includes(params.genre))throw Object.assign(new Error("Неизвестный жанр"),{status:400});
   u.searchParams.set("genre",params.genre);
  }
 }
 return u.href;
}
export function buildRadioUrl(q,host="https://de1.api.radio-browser.info"){
 const u=new URL("/json/stations/search",host);
 u.searchParams.set("name",parseQuery(q));u.searchParams.set("limit","20");
 u.searchParams.set("hidebroken","true");u.searchParams.set("order","votes");u.searchParams.set("reverse","true");
 return u.href;
}
