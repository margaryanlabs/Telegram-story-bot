/* V9 Media Hub: real routes, a quiet continue-category shortcut and saved artwork.
 * The existing Universe controller remains the only module navigation owner. */
(()=>{
 'use strict';
 const core=window.VetogramV9MediaHubCore;
 const api=window.VetogramUniverse;
 const home=document.getElementById('v6MediaHome');
 const stage=document.getElementById('v6MediaStage');
 const title=document.getElementById('v6ModuleTitle');
 const resume=document.getElementById('v9MediaResume');
 const button=document.getElementById('v9MediaResumeOpen');
 const label=document.getElementById('v9MediaResumeLabel');
 if(!core||!api||!home||!stage||!title||!resume||!button||!label)return;
 const store=()=>{try{return window.localStorage}catch{return null}};
 const context=()=>{try{return api.context()}catch{return null}};
 const cards=Array.from(home.querySelectorAll('.v72-media-grid [data-v6-module]'));
 const nameFromTitle=()=>{
   if(!home.hidden||stage.hidden)return '';
   const current=title.textContent?.trim();
   return Object.keys(core.names).find(name=>core.names[name]===current)||'';
 };
 let lastScope='';
 function refreshArtwork(){
   const current=context(),storage=store(),scope=core.scope(current);
   if(scope!==lastScope){
     // Do not show the previous owner's cover while identity changes.
     for(const card of cards){
       card.querySelector('.v9-media-source-cover')?.remove();
       card.classList.remove('v9-has-source-cover');
       delete card.dataset.v9CoverUrl;
     }
     lastScope=scope;
   }
   for(const card of cards){
     const name=card.dataset.v6Module;
     const art=card.querySelector('.v72-card-art');
     if(!art||!['music','books'].includes(name))continue;
     const source=core.latestArt(storage,current,name);
     if(card.dataset.v9CoverUrl===source)continue;
     card.querySelector('.v9-media-source-cover')?.remove();
     card.classList.remove('v9-has-source-cover');
     card.dataset.v9CoverUrl=source;
     if(!source)continue;
     const image=document.createElement('img');
     image.className='v9-media-source-cover';
     image.alt=''; // Decorative: the parent button has the category name.
     image.loading='lazy';image.decoding='async';
     image.referrerPolicy='no-referrer';
     image.addEventListener('load',()=>{
       if(card.dataset.v9CoverUrl===source)card.classList.add('v9-has-source-cover');
     },{once:true});
     image.addEventListener('error',()=>{
       if(card.dataset.v9CoverUrl===source){
         card.classList.remove('v9-has-source-cover');
         card.dataset.v9CoverUrl=''; // Keep the original typographic fallback.
       }
       image.remove();
     },{once:true});
     image.src=source;
     art.prepend(image);
   }
 }
 function render(){
   const previous=core.read(store(),context());
   const continueShelf=document.getElementById('v61Continue');
   // A real saved film/book/track takes priority over this category shortcut.
   resume.hidden=!previous||Boolean(continueShelf&&!continueShelf.hidden);
   if(previous){
     label.textContent=core.names[previous];
     button.dataset.module=previous;
     button.setAttribute('aria-label','Продолжить в разделе '+core.names[previous]);
   }else{
     button.dataset.module='';
     label.textContent='';
   }
   refreshArtwork();
 }
 function recordActualModule(){
   const name=nameFromTitle();
   if(!name)return;
   core.save(store(),context(),name);
   render();
 }
 button.addEventListener('click',()=>{
   const name=core.read(store(),context());
   if(name)api.open(name); // Existing module controller handles iframe, Back and audio.
 });
 if(typeof MutationObserver==='function'){
   const observer=new MutationObserver(()=>{recordActualModule();if(!home.hidden)render()});
   observer.observe(stage,{attributes:true,attributeFilter:['hidden']});
   observer.observe(title,{childList:true,subtree:true,characterData:true});
   observer.observe(home,{attributes:true,attributeFilter:['hidden']});
 }else{
   // Old WebViews: existing module buttons remain fully functional.
   document.addEventListener('click',event=>{
     if(!event.target?.closest?.('[data-v6-module]'))return;
     setTimeout(recordActualModule,0);
   });
 }
 window.addEventListener('vetogram:identity-change',render);
 window.addEventListener('vetogram:media-recent',()=>setTimeout(render,0));
 window.addEventListener('vetogram:media-library',()=>setTimeout(render,0));
 window.addEventListener('vetogram:music-library',()=>setTimeout(render,0));
 window.addEventListener('veto:screen-changed',event=>{
   if(event.detail?.screen==='media')render();
 });
 window.addEventListener('focus',render);
 render();
})();
