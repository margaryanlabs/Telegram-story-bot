/* Same-origin adapter for trusted, separately maintained VETOGRAM modules.
 * No launch credentials in iframe URLs, storage, logs or postMessage payloads. */
(()=>{
 'use strict';
 const embedded=window.parent!==window && new URLSearchParams(location.search).get('universe')==='1';
 let context=null;
 if(embedded){try{if(parent.location.origin===location.origin)context=parent.VetogramUniverse?.context();}catch{}}
 const id=String(context?.user?.id||'');
 window.VetogramMediaContext=Object.freeze({embedded:!!context,scope:context?.initData&&/^\d{1,20}$/.test(id)?'owner-'+id:'device',
  get initData(){try{return context?parent.VetogramUniverse?.context()?.initData||'':window.Telegram?.WebApp?.initData||'';}catch{return '';}}});
 if(context){
  document.documentElement.classList.add('v6-embedded');
  document.documentElement.dataset.universeTheme=context.theme;
  // V9: keep embedded Music/Cinema/Books in the owner's chosen black/white theme.
  // Accept only same-origin messages from the actual parent frame.
  window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==parent)return;
   if(event.data?.channel!=='vetogram-universe'||event.data.action!=='theme')return;
   const next=String(event.data.theme||'');
   if(['graphite','slate','pearl','linen'].includes(next))document.documentElement.dataset.universeTheme=next;
  });
  // Child modules must not independently hide/register Telegram's global Back.
  const api=parent.Telegram?.WebApp;
  if(api)window.Telegram={WebApp:new Proxy(api,{get(target,key){
   if(key==='BackButton')return {show(){},hide(){},onClick(){},offClick(){}};
   if(['setHeaderColor','setBackgroundColor','expand','ready'].includes(key))return ()=>{};
   const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }})};
 }else{
  const sdk=document.createElement('script');sdk.src='https://telegram.org/js/telegram-web-app.js';sdk.async=true;document.head.append(sdk);
 }
 window.addEventListener('error',event=>{if(event.filename && new URL(event.filename,location.href).origin===location.origin)window.VetogramModuleError=true;});
})();
