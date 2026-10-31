/* Vetogram Music Gateway — public catalog metadata; no copyrighted file proxy.
   Vercel Node function: /api/music?action=search|charts|radio|providers|health */
import {SOURCE_STATUS,mapAudius,mapRadio,buildAudiusUrl,buildRadioUrl,parseQuery} from "../lib/providers.mjs";
const ALLOWED=new Set(["https://vetogram-music-live.vercel.app","http://localhost:3000","http://localhost:8787"]);
const RADIO_HOSTS=["https://de1.api.radio-browser.info","https://nl1.api.radio-browser.info","https://at1.api.radio-browser.info"];
const cache=new Map(),pending=new Map(),requests=new Map(),TTL=90000;
function respond(res,status,data){
 res.statusCode=status;
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control",status===200?"public, s-maxage=40, stale-while-revalidate=60":"no-store");
 res.end(JSON.stringify(data));
}
function requestLimit(req){
 // Per-instance best-effort guard; configure an edge/CDN shared limiter for real production.
 const address=String(req.headers?.["x-real-ip"]||req.socket?.remoteAddress||"unknown").slice(0,100);
 const now=Date.now(),previous=requests.get(address)||{start:now,count:0};
 if(now-previous.start>60000){previous.start=now;previous.count=0}
 previous.count++;requests.set(address,previous);
 if(requests.size>2000)for(const [k,v] of requests){if(now-v.start>120000)requests.delete(k)}
 return previous.count<=50;
}
async function upstreamJSON(url,signal){
 const response=await fetch(url,{signal,credentials:"omit",headers:{Accept:"application/json","User-Agent":"VetogramMusic/0.2 (+public music discovery)"}});
 if(!response.ok)throw Object.assign(new Error("Ошибка внешнего каталога"),{status:502});
 const length=Number(response.headers.get("content-length")||0);
 if(length>2000000)throw Object.assign(new Error("Слишком большой ответ провайдера"),{status:502});
 const text=await response.text();
 if(text.length>2000000)throw Object.assign(new Error("Слишком большой ответ провайдера"),{status:502});
 return JSON.parse(text);
}
async function callProvider(key,loader){
 const stored=cache.get(key),now=Date.now();
 if(stored&&now-stored.timestamp<TTL)return stored.body;
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
  try{
   const output=await loader(controller.signal);
   const body={ok:true,...output,checked_at:new Date().toISOString()};
   cache.set(key,{timestamp:Date.now(),body});
   if(cache.size>150){for(const [k,v] of cache)if(Date.now()-v.timestamp>TTL)cache.delete(k);
    while(cache.size>150)cache.delete(cache.keys().next().value)}
   return body;
  }finally{clearTimeout(timeout);pending.delete(key)}
 })();
 pending.set(key,task);return task;
}
async function lookup(action,search){
 if(action==="health")return{ok:true,service:"vetogram-music-gateway",version:1};
 if(action==="providers")return{ok:true,providers:SOURCE_STATUS};
 if(action==="search"||action==="charts"){
  const url=buildAudiusUrl(action,{q:search.get("q"),period:search.get("period")||"week",genre:search.get("genre")||"all",limit:search.get("limit")});
  return callProvider(url,async(signal)=>{
   const raw=await upstreamJSON(url,signal),tracks=Array.isArray(raw?.data)?raw.data:[];
   return {provider:"audius",type:action,items:tracks.map(mapAudius).filter(Boolean),count:tracks.length};
  });
 }
 if(action==="radio"){
  const query=parseQuery(search.get("q")),key="radio:"+query.toLowerCase();
  return callProvider(key,async(signal)=>{
   let last;
   for(const host of RADIO_HOSTS){
    try{const items=await upstreamJSON(buildRadioUrl(query,host),signal);
     if(!Array.isArray(items))throw Error("Неверный формат радиокаталога");
     const mapped=items.map(mapRadio).filter(Boolean);
     return{provider:"radio-browser",type:"radio",items:mapped,count:mapped.length};
    }catch(err){if(signal.aborted)throw err;last=err}
   }
   throw last||Error("Радио недоступно");
  });
 }
 throw Object.assign(new Error("Неизвестное действие"),{status:400});
}
export async function handler(req,res){
 const origin=req.headers?.origin||"";
 if(ALLOWED.has(origin)){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin")}
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Content-Type");
 if(req.method==="OPTIONS"){res.statusCode=204;res.end();return}
 if(req.method!=="GET"){respond(res,405,{ok:false,error:"Разрешён только GET"});return}
 if(!requestLimit(req)){respond(res,429,{ok:false,error:"Слишком много запросов. Попробуй через минуту."});return}
 try{
  const url=new URL(req.url||"/api/music","https://api.vetogram.local");
  const action=url.searchParams.get("action")||"health";
  const body=await lookup(action,url.searchParams);
  respond(res,200,body);
 }catch(err){
  const status=Number(err?.status)|| (err?.name==="AbortError"?504:502);
  respond(res,status,{ok:false,error:status>=500?"Внешний музыкальный источник временно недоступен":String(err.message)});
 }
}
export default handler;
