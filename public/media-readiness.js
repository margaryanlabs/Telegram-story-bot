/* VETO MEDIA launch diagnostics — opt-in, developer panel.
  No account tokens, chat data, playlist contents or files are collected. */
(()=>{
 "use strict";
 if(!/(?:[?&]media_qa=1(?:&|$)|#media-qa)/.test(location.search+location.hash))return;
 const $=id=>document.getElementById(id);
 const create=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
 const source={
   Audius:"https://api.audius.co/v1/tracks/search?query=jazz&limit=1",
   TVmaze:"https://api.tvmaze.com/search/shows?q=sherlock",
   Gutenberg:"https://gutendex.com/books?search=sherlock",
   Archive:"https://archive.org/advancedsearch.php?q=collection%3Aprelinger%20AND%20mediatype%3Amovies&rows=1&output=json"
 };
 const panel=create("aside",undefined,"v12-qa-panel");panel.id="v12Qa";
 panel.setAttribute("role","region");panel.setAttribute("aria-label","Проверка VETO MEDIA");
 panel.innerHTML='<div class="v12-qa-top"><div><small>VETO MEDIA / DEVICE LAB</small><h2>Готовность устройства</h2></div><button type="button" id="v12QaHide" aria-label="Свернуть">×</button></div>'+
 '<p>Проверка выполняется на этом устройстве. Внешние API вызываются только после нажатия кнопки, не загружаются музыка, фильмы или пользовательские данные.</p>'+
 '<div id="v12QaFacts" class="v12-qa-facts"></div>'+
 '<div class="v12-qa-buttons"><button type="button" id="v12QaRun">Проверить 4 каталога</button><button type="button" id="v12QaExport">Скачать отчёт JSON</button></div>'+
 '<div id="v12QaResults" class="v12-qa-results"></div>'+
 '<p class="v12-qa-note">Успешный запрос к каталогу не доказывает, что контент можно воспроизвести в Telegram или что на него есть коммерческие права.</p>';
 document.body.append(panel);
 const diagnostics={generatedAt:null,hostHint:false,https:false,mp3:false,m4a:false,storage:false,indexedDb:false,api:{}};
 const renderFacts=()=>{
   const box=$("v12QaFacts");box.replaceChildren();
   for(const [label,val] of [
     ["HTTPS",diagnostics.https],["Запущено через Telegram (признак)",diagnostics.hostHint],
     ["MP3",diagnostics.mp3],["M4A",diagnostics.m4a],["localStorage",diagnostics.storage],
     ["IndexedDB",diagnostics.indexedDb]
   ]){
     const row=create("div",undefined,"v12-qa-fact");row.append(create("span",label),create("strong",val?"Да":"Не подтверждено",val?"ok":"unknown"));box.append(row);
   }
 };
 diagnostics.https=location.protocol==="https:" || location.hostname==="localhost";
 diagnostics.hostHint=!!(window.Telegram?.WebApp?.initData && typeof window.Telegram.WebApp.initData==="string");
 const probeAudio=document.createElement("audio");
 diagnostics.mp3=Boolean(probeAudio.canPlayType?.("audio/mpeg"));
 diagnostics.m4a=Boolean(probeAudio.canPlayType?.("audio/mp4; codecs=mp4a.40.2"));
 try{const key="veto-qa-test";localStorage.setItem(key,"1");diagnostics.storage=localStorage.getItem(key)==="1";localStorage.removeItem(key)}catch{}
 diagnostics.indexedDb=!!window.indexedDB;
 renderFacts();
 const renderResults=()=>{
   const box=$("v12QaResults");box.replaceChildren();
   for(const [name,r] of Object.entries(diagnostics.api)){
     const line=create("div",undefined,"v12-qa-result");
     line.append(create("strong",name),create("span",r.ok?"Ответ API получен":r.error||"Нет ответа",r.ok?"ok":"warning"));
     box.append(line);
   }
 };
 let inFlight=false;
 $("v12QaRun").onclick=async()=>{
   if(inFlight)return;inFlight=true;$("v12QaRun").disabled=true;$("v12QaRun").textContent="Проверяем…";
   diagnostics.generatedAt=new Date().toISOString();diagnostics.api={};
   const results=await Promise.all(Object.entries(source).map(async([name,url])=>{
     const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9000);
     const began=performance.now();
     try{
       const response=await fetch(url,{signal:ctrl.signal,headers:{Accept:"application/json"},credentials:"omit",cache:"no-store"});
       if(!response.ok)throw Error("HTTP "+response.status);
       const type=response.headers.get("content-type")||"";
       if(!type.includes("json"))throw Error("Не JSON");
       // Limit inspection to known metadata shape, never store payload or copyrighted content.
       const body=await response.json();
       const valid=name==="Audius"?Array.isArray(body.data):name==="TVmaze"?Array.isArray(body):
         name==="Gutenberg"?Array.isArray(body.results):!!body.response?.docs;
       if(!valid)throw Error("Неизвестный формат ответа");
       return [name,{ok:true,elapsedMs:Math.round(performance.now()-began)}];
     }catch(e){return[name,{ok:false,error:e?.name==="AbortError"?"Тайм-аут 9 секунд":"Ошибка запроса / CORS: "+String(e?.message||"")}];}
     finally{clearTimeout(timer);}
   }));
   for(const [name,data] of results)diagnostics.api[name]=data;
   renderResults();inFlight=false;$("v12QaRun").disabled=false;$("v12QaRun").textContent="Проверить ещё раз";
 };
 $("v12QaExport").onclick=()=>{
   const report={schema:"veto-media-launch-diagnostic",version:1,...diagnostics};
   const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download="veto-media-device-check.json";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),3000);
 };
 $("v12QaHide").onclick=()=>{panel.classList.toggle("collapsed");$("v12QaHide").textContent=panel.classList.contains("collapsed")?"＋":"×";};
})();
