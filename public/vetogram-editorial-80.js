/* VETOGRAM 8.0 — One Media architecture.
 * Reorders only real, existing module nodes; never synthesizes film/track/book
 * entries and never replaces their native handlers, playback or reader.
 * The render controller still owns every category, source and item click.
 */
(() => {
 'use strict';
 // The parent Media home is also part of the ONE APP redesign.
 // Move only the real saved Continue shelf; the existing owner-aware module
 // navigation, search and local vault controllers remain untouched.
 const home=document.getElementById('v6MediaHome');
 if(home){
   document.body?.classList?.add('vetogram-editorial-home');
   const saved=document.getElementById('v61Continue');
   const categories=home.querySelector('.v61-world-section');
   if(saved&&categories)home.insertBefore(saved,categories);
   return;
 }
 const mode=document.getElementById('v78MediaHub')?.dataset?.v78Module;
 if(!['cinema','music','books'].includes(mode))return;
 const $=id=>document.getElementById(id);
 const moveBefore=(node,anchor)=>{
   if(node&&anchor&&anchor.parentNode&&node!==anchor)
     anchor.parentNode.insertBefore(node,anchor);
 };
 const body=document.body;
 body?.classList.add('vetogram-editorial-80','vetogram-editorial-'+mode);
 const portal=$('v78MediaHub');
 if(mode==='cinema'){
   // Home: hero -> real category navigation and search -> actual artwork
   // rails -> editorial quick actions. Native film cards keep their listeners.
   const main=document.querySelector('.cinema-shell main');
   const nav=main?.querySelector('.cinema-section-nav');
   const search=$('cinemaSearchArea'),watch=$('cinemaWatchNow');
   const genres=$('cinemaGenresSection'),latest=$('cinemaLatest');
   for(const item of [nav,search,watch,genres,latest])
     moveBefore(item,portal);
   // All six source-backed genre tiles are rendered by the native controller.
   if(search)search.setAttribute('aria-label','Поиск по фильмам, сериалам и жанрам');
 }
 if(mode==='music'){
   const tracks=$('licensedHomeSection');
   // Actual permitted audio tracks take visual priority over ornamental
   // repeat heroes. Keep existing Audius/radio/user-owned logic unchanged.
   moveBefore(tracks,portal);
   const home=document.querySelector('.page[data-view="home"]');
   const prefs=home?.querySelector('.native-home');
   if(prefs)prefs.classList.add('v80-secondary-discovery');
 }
 if(mode==='books'){
   // Put the true readable cover shelf + existing source filters above the
   // duplicated intro card. Original source tabs, saved reader and import
   // listeners continue to operate on their original DOM elements.
   const featured=$('featuredEditions');
   const tabs=document.querySelector('.books-main .source-tabs');
   moveBefore(featured,portal);
   moveBefore(tabs,portal);
   tabs?.setAttribute('aria-label','Фильтры книжного каталога по доступности и языку');
 }
 // Native route: screen titles do not get fake counts or a premature READY.
 document.documentElement.dataset.vetogramEditorial='80';
})();
