/* Vetogram Music client gateway.
   Uses standalone backend when public; otherwise goes directly to published Audius/Radio APIs.
   Does not request VK/Yandex user credentials or proxy protected audio files. */
(()=>{
"use strict";
const URL_ROOT="https://vetogram-music-api.vercel.app/api/music";
const MIRRORS=["https://de1.api.radio-browser.info","https://nl1.api.radio-browser.info","https://at1.api.radio-browser.info"];
let blockUntil=0,checkedAt=0,lastStatus="unknown";
const apiUrl=(action,params={})=>{
 const u=new URL(URL_ROOT);u.searchParams.set("action",action);
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
 return u.href;
};
const limitedFetch=async(url,{signal,timeout=5500}={})=>{
 const ctl=new AbortController(),stop=setTimeout(()=>ctl.abort(),timeout);
 const listener=()=>ctl.abort();signal?.addEventListener("abort",listener,{once:true});
 try{
  const r=await fetch(url,{signal:ctl.signal,credentials:"omit",headers:{Accept:"application/json"}});
  if(!r.ok)throw Error("HTTP "+r.status);
  const length=Number(r.headers.get("content-length")||0);
  if(length>2000000)throw Error("response oversized");
  const body=await r.text();
  if(body.length>2000000)throw Error("response oversized");
  return JSON.parse(body);
 }finally{clearTimeout(stop);signal?.removeEventListener("abort",listener)}
};
async function gateway(action,params,signal){
 if(Date.now()<blockUntil)return null;
 try{
  const out=await limitedFetch(apiUrl(action,params),{signal,timeout:2700});
  if(!out?.ok||!Array.isArray(out.items))throw Error("bad API result");
  checkedAt=Date.now();lastStatus="online";
  return out;
 }catch(e){
  if(signal?.aborted)throw e;
  checkedAt=Date.now();lastStatus="fallback";blockUntil=Date.now()+300000;
  return null;
 }
}
async function search(query,signal){
 const q=String(query||"").slice(0,80);
 const backend=await gateway("search",{q,limit:25},signal);
 if(backend)return{data:backend.items,via:"gateway"};
 const u=new URL("https://api.audius.co/v1/tracks/search");
 u.searchParams.set("query",q);u.searchParams.set("limit","25");
 return {...await limitedFetch(u.href,{signal,timeout:10500}),via:"direct"};
}
async function trending({limit=12,period="week",genre="all",signal}={}){
 const backend=await gateway("charts",{limit,period,genre},signal);
 if(backend)return{data:backend.items.slice(0,limit),via:"gateway"};
 const u=new URL("https://api.audius.co/v1/tracks/trending");
 u.searchParams.set("limit",String(Math.min(30,Math.max(1,limit))));
 u.searchParams.set("time",period);if(genre!=="all")u.searchParams.set("genre",genre);
 return {...await limitedFetch(u.href,{signal,timeout:10500}),via:"direct"};
}
async function radio(query,signal){
 const q=String(query||"").slice(0,70);
 const backend=await gateway("radio",{q},signal);
 if(backend)return backend.items;
 let last;
 for(const mirror of MIRRORS){
  const u=mirror+"/json/stations/search?"+new URLSearchParams({name:q,limit:"20",hidebroken:"true",order:"votes",reverse:"true"});
  try{
   const data=await limitedFetch(u,{signal,timeout:9000});
   if(Array.isArray(data))return data;
  }catch(e){last=e;if(signal?.aborted)throw e}
 }
 throw last||Error("Радио сейчас недоступно");
}
window.VetogramGateway=Object.freeze({search,trending,radio,status:()=>({status:lastStatus,checkedAt,nextProbe:blockUntil})});
})();
