/* V9 Media Hub: minimal owner-scoped preferences, never credentials or media bytes.
 * Works in isolated WebViews where storage is unavailable. */
(function(host){
 'use strict';
 const names=Object.freeze({music:'Музыка',cinema:'Кино',books:'Книги'});
 const valid=value=>Object.prototype.hasOwnProperty.call(names,value);
 const scope=context=>{
   const id=String(context?.user?.id||'');
   return context?.initData&&/^\d{1,20}$/.test(id)?'owner-'+id:'device';
 };
 const key=context=>'vetogram-v9-media-last:'+scope(context);
 const read=(store,context)=>{
   try{const value=store?.getItem(key(context));return valid(value)?value:''}
   catch{return ''}
 };
 const save=(store,context,name)=>{
   if(!valid(name))return false;
   try{store?.setItem(key(context),name);return Boolean(store)}
   catch{return false}
 };
 const artwork=url=>{
   try{
     const value=String(url||'');
     if(value.length>1024)return '';
     const parsed=new URL(value);
     if(parsed.protocol!=='https:'||parsed.username||parsed.password)return '';
     const host=parsed.hostname.toLowerCase();
     // Never load arbitrary stored URLs as image requests from the hub.
     if(!(/^(?:covers\.openlibrary\.org|coverartarchive\.org|upload\.wikimedia\.org)$/.test(host)||
       /(?:^|\.)(?:audius\.co|audiuscdn\.com|archive\.org)$/.test(host)))return '';
     return parsed.href;
   }catch{return ''}
 };
 const latestArt=(store,context,name)=>{
   if(!store||!['music','books'].includes(name))return '';
   try{
     const owner=scope(context);
     if(name==='music'){
       const value=JSON.parse(store.getItem('vetogram-music-v1:'+owner)||'null');
       const liked=Array.isArray(value?.liked)?value.liked:[];
       for(const item of liked.slice(0,100)){const url=artwork(item?.artwork);if(url)return url;}
     }
     if(name==='books'){
       const value=JSON.parse(store.getItem('vetogram-books-v1:'+owner+':saved')||'null');
       if(value&&typeof value==='object'&&!Array.isArray(value)){
         for(const item of Object.values(value).slice(0,100)){const url=artwork(item?.cover);if(url)return url;}
       }
     }
   }catch{}
   return '';
 };
 host.VetogramV9MediaHubCore=Object.freeze({names,valid,scope,key,read,save,artwork,latestArt});
})(typeof window!=='undefined'?window:globalThis);
