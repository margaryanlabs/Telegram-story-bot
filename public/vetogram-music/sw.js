/* Vetogram Music PWA: cache application shell ONLY. Never cache copyrighted streams,
   personal files, Telegram tokens or third-party catalog responses. */
const CACHE="vetogram-music-shell-v1";
const SHELL=["./","./index.html","./app.css","./app.js","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("vetogram-music-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=="GET"||url.origin!==self.location.origin||req.destination==="audio"||req.headers.has("range"))return;
 const pathname=url.pathname.split("/").pop();
 if(!["","index.html","app.css","app.js","icon.svg","manifest.webmanifest"].includes(pathname))return;
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok)caches.open(CACHE).then(cache=>cache.put(req,res.clone())).catch(()=>{});return res})));
});