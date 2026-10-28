#!/usr/bin/env node
/**
 * Kinobox provider discovery (review queue ONLY, not public playback).
 * Public docs: https://kinobox.tv/api
 * Search a SINGLE user-provided title / ID. No DB scraping, crawler, DRM
 * bypass, autoplay of third-party sources or unreviewed URL publication.
 */
import process from "node:process";

const endpoint="https://kinobox.tv/api/players";
const ALLOWED_PARAMS=new Set(["title","kinopoisk","imdb","tmdb"]);
export function normalizeDiscoveredProviders(raw) {
  if(!Array.isArray(raw))throw Error("Kinobox API response was not an array");
  const candidates=[];
  for(const p of raw.slice(0,30)){
    if(!p || typeof p!=="object" || p.success===false)continue;
    const provider=String(p.source||"").slice(0,70);
    if(!/^[\w-]{2,70}$/i.test(provider))continue;
    const variants=Array.isArray(p.translations)&&p.translations.length?
      p.translations.slice(0,80).map(t=>({
        translation_name:String(t?.name||"Оригинал").slice(0,120),
        quality_label:String(t?.quality||"").slice(0,24),
        iframeUrl:t?.iframeUrl
      })):[{translation_name:"Оригинал",quality_label:"",iframeUrl:p.iframeUrl}];
    for(const variant of variants){
      let url;
      try {
        url=new URL(variant.iframeUrl);
        if(url.protocol!=="https:"||url.username||url.password||url.port)continue;
      }catch{continue}
      candidates.push({
        provider,source_type:"iframe",playback_url:url.href,
        translation_name:variant.translation_name,quality_label:variant.quality_label,
        rights_reviewed:false,
        review_status:"requires_provider_authorization_and_rights_review"
      });
    }
  }
  return candidates;
}
export async function discover({key,value,fetchFn=fetch}) {
  if(!ALLOWED_PARAMS.has(key))throw Error("Unsupported search parameter");
  const search=String(value||"").trim();
  if(!search||search.length>120)throw Error("Search title or ID is required");
  const url=new URL(endpoint);
  url.searchParams.set(key,search);
  const response=await fetchFn(url,{signal:AbortSignal.timeout(10000),
    headers:{"accept":"application/json"}});
  if(!response.ok)throw Error("Kinobox HTTP "+response.status);
  const raw=await response.json();
  return {
    searched:{[key]:search},source:"Kinobox API discovery",checkedAt:new Date().toISOString(),
    caveat:"No permission to distribute third-party streams is established by this discovery.",
    candidates:normalizeDiscoveredProviders(raw)
  };
}

if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href){
  const key=process.argv[2]||"title",value=process.argv.slice(3).join(" ");
  discover({key,value}).then(result=>{
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }).catch(error=>{console.error("Kinobox discovery:",error.message);process.exitCode=1});
}
