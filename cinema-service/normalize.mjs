// Explicitly reviewed importer contract for licensed playback providers.
// This validates data shape, URLs and provenance. It cannot grant content rights.
export const ALLOWED_TYPES = new Set(["iframe","hls","video"]);
export const ALLOWED_RIGHTS = new Set(["official_embed","creative_commons","contract"]);
export const idPattern = /^[a-z0-9][a-z0-9-]{2,90}$/;

function requiredText(value, max, field) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(field+" обязателен, до "+max+" символов");
  return value.trim();
}
function optionalText(value,max) {
  return typeof value==="string" ? value.trim().slice(0,max) : "";
}
export function httpsUrl(value,field,allowedOrigins=[]) {
  const text=requiredText(value,2048,field);
  let parsed;
  try {parsed=new URL(text);} catch {throw new Error(field+": некорректный URL")}
  if(parsed.protocol!=="https:" || parsed.username || parsed.password || parsed.port)
    throw new Error(field+": разрешён только HTTPS URL без учётных данных или нестандартного порта");
  if(!parsed.hostname || parsed.hostname==="localhost" || parsed.hostname.endsWith(".local"))
    throw new Error(field+": локальные адреса запрещены");
  if(allowedOrigins.length && !allowedOrigins.includes(parsed.origin))
    throw new Error(field+": неизвестный видеопровайдер "+parsed.origin);
  return parsed.href;
}
export function normalizeFilm(input,{allowedOrigins=["https://rutube.ru"]}={}) {
  if(!input || typeof input!=="object" || Array.isArray(input))throw new Error("Необходим объект фильма");
  const id=requiredText(input.id,91,"id");
  if(!idPattern.test(id))throw new Error("Недопустимый id фильма");
  const title=requiredText(input.title_ru,240,"title_ru");
  const kind=requiredText(input.source_type,12,"source_type");
  if(!ALLOWED_TYPES.has(kind))throw new Error("Неизвестный формат источника");
  const basis=requiredText(input.rights_basis,32,"rights_basis");
  if(!ALLOWED_RIGHTS.has(basis))throw new Error("Неизвестное основание показа");
  const provider=requiredText(input.provider,80,"provider");
  const rightsHolder=requiredText(input.rights_holder,240,"rights_holder");
  const attribution=requiredText(input.attribution,500,"attribution");
  const sourcePage=httpsUrl(input.source_page_url,"source_page_url");
  const evidence=httpsUrl(input.rights_evidence_url,"rights_evidence_url");
  const play=httpsUrl(input.playback_url,"playback_url",allowedOrigins);
  if(kind==="iframe" && new URL(play).origin==="https://rutube.ru" &&
      !/^\/play\/embed\/[a-f0-9]{32}\/?$/i.test(new URL(play).pathname))
    throw new Error("Некорректный адрес iframe RUTUBE");
  if(input.rights_reviewed !== true)
    throw new Error("Источник не прошёл ручную проверку прав (rights_reviewed=true)");
  const year=input.year==null?null:Number(input.year);
  if(year!==null && (!Number.isInteger(year)||year<1880||year>2200))throw new Error("Некорректный год");
  const seconds=input.duration_seconds==null?null:Number(input.duration_seconds);
  if(seconds!==null && (!Number.isInteger(seconds)||seconds<1||seconds>24*60*60*5))throw new Error("Некорректная длительность");
  const genres=Array.isArray(input.genres)?input.genres.filter(x=>typeof x==="string").map(x=>x.trim().slice(0,60)).filter(Boolean).slice(0,16):[];
  const territories=Array.isArray(input.territories)?input.territories.filter(x=>typeof x==="string"&&/^[A-Z]{2}$/.test(x)).slice(0,250):[];
  const hue=Number.isInteger(input.hue)&&input.hue>=0&&input.hue<360?input.hue:210;
  return {
    id,title,original_title:optionalText(input.original_title,240),year,synopsis:optionalText(input.description,2500),
    poster_url:input.poster_url?httpsUrl(input.poster_url,"poster_url"):null,
    duration_seconds:seconds, spoken_language:optionalText(input.spoken_language,20)||"ru",genres,hue,
    provider,rights_holder:rightsHolder,attribution,source_type:kind,playback_url:play,source_page_url:sourcePage,
    rights_basis:basis,rights_evidence_url:evidence,territories
  };
}
