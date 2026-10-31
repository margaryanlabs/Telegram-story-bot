/* Cinema visual metadata from the actual source's public record.
 * Graceful fallback to gradients if RUTUBE metadata is blocked by CORS/geo.
 * No video downloading or proxying; no artwork generated for unrelated films.
 */
(function(){
 "use strict";
 const cache=new Map();
 const allowedImageHosts=new Set(["pic.rutube.ru","pic.rtbcdn.su","pic.rutubelist.ru","pic.rtbcdn.ru"]);
 function rutubeVideoId(film){
   if(!film?.player?.url)return null;
   try{
     const u=new URL(film.player.url);
     if(u.origin!=="https://rutube.ru")return null;
     return /^\/play\/embed\/([0-9a-f]{32})\/?$/i.exec(u.pathname)?.[1]||null;
   }catch(_){return null}
 }
 function allowedThumbnail(value){
   try{
     const u=new URL(value);
     if(u.protocol!=="https:"||!allowedImageHosts.has(u.hostname))return null;
     return u.href;
   }catch(_){return null}
 }
 function load(film){
   if(film?.poster)return Promise.resolve(allowedThumbnail(film.poster)||null);
   const id=rutubeVideoId(film);
   if(!id)return Promise.resolve(null);
   if(cache.has(id))return cache.get(id);
   const p=(async()=>{
     const ctrl=new AbortController();
     const timer=setTimeout(()=>ctrl.abort(),5000);
     try{
       const res=await fetch("https://rutube.ru/api/video/"+id+"/",{signal:ctrl.signal,headers:{Accept:"application/json"}});
       if(!res.ok)return null;
       const data=await res.json();
       return allowedThumbnail(data?.thumbnail_url);
     }catch(_){return null}
     finally{clearTimeout(timer)}
   })();
   cache.set(id,p);
   return p;
 }
 window.VetogramCinemaArtwork=Object.freeze({load,rutubeVideoId,allowedThumbnail});
})();
