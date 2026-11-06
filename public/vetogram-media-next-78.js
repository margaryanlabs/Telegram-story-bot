/* VETOGRAM 7.8 — actual actions in existing Cinema, Music and Books.
 * Never creates a second player, searches messages or fabricates titles.
 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const root=$('v78MediaHub');if(!root)return;
 const module=root.dataset.v78Module;
 if(!['cinema','music','books'].includes(module))return;
 const status=$('v78MediaStatus');
 const context=window.VetogramMediaContext;
 // The same four routes work in the standalone Render preview and in the
 // integrated Telegram shell. Native links are restricted to fixed local
 // HTML destinations; embedded taps preserve cached frames via the host.
 const embedded=context?.embedded && window.parent!==window;
 const routes=Object.freeze({
   cinema:'/cinema.html',music:'/music-module.html',books:'/books.html',
   hub:'/studio.html?screen=media'
 });
 const nav=document.createElement('nav');
 nav.className='v79-media-switcher';
 nav.setAttribute('aria-label','Разделы Vetogram');
 const sections=[
   ['cinema','Кино'],['music','Музыка'],['books','Книги'],['hub','Все медиа']
 ];
 for(const [name,label] of sections){
   const link=document.createElement('a');
   link.href=routes[name];
   link.className='v79-switch'+(name===module?' is-current':'');
   link.textContent=label;
   if(name===module)link.setAttribute('aria-current','page');
   link.addEventListener('click',event=>{
     if(name===module){event?.preventDefault?.();return;}
     if(!embedded)return; // Same-origin standalone navigation stays native.
     event?.preventDefault?.();
     window.parent.postMessage({
       channel:'vetogram-media',
       type:'navigate',target:name==='hub'?'hub':'module',
       ...(name==='hub'?{}:{module:name})
     },window.location.origin);
   });
   nav.appendChild(link);
 }
 root.insertBefore(nav,root.firstChild);

 const say=message=>{if(status)status.textContent=message;};
 const focusSearch=id=>{
   const field=$(id);
   if(!field)return;
   field.focus?.({preventScroll:true});
   field.scrollIntoView?.({behavior:'smooth',block:'center'});
 };
 function movie(action){
   const api=window.VetogramCinema;
   if(!api?.openTab){say('Кинотеатр ещё загружается. Повтори действие.');return;}
   if(action==='search'){api.openTab('search');focusSearch('cinemaSearch');say('Поиск по настоящему каталогу; возможность просмотра зависит от источника.');}
   if(action==='series'){api.openTab('series');say('Сериалы и доступные эпизоды. Проверяй источники на карточке.');}
   if(action==='library'){api.openTab('library');say('Избранное и сохранённые просмотры этого устройства.');}
   if(action==='continue'){
     const records=typeof api.getLibrary==='function'?api.getLibrary():[];
     const item=Array.isArray(records)?records.filter(x=>Number(x?.progress)>0&&Number(x.progress)<1)
       .sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0))[0]:null;
     if(item&&typeof api.openFilm==='function'&&api.openFilm(item.id)===true){
       say('Открыты сведения о «'+String(item.title||'фильме').slice(0,80)+'». Нажми «Смотреть» для продолжения.');
     }else{
       api.openTab('catalog');say('Незавершённых просмотров пока нет. Выбери фильм из каталога.');
     }
   }
 }
 function music(action){
   const api=window.VetogramMusic;
   if(!api?.showPage){say('Музыкальный раздел ещё загружается. Повтори действие.');return;}
   const destinations={search:['search','Ищи доступные аудиозаписи и свои треки.'],library:['library','Здесь личные файлы, сохранённые треки и избранное.'],
     radio:['radio','Выбирай доступную радиостанцию в каталоге.'],import:['import','Добавляй только собственные или разрешённые записи.']};
   const item=destinations[action];
   if(item){api.showPage(item[0]);say(item[1]);if(action==='search')focusSearch('searchInput');}
 }
 function book(action){
   const api=window.VetogramBooks;
   if(action==='continue'){
     if(!$('continueShelf')?.hidden&&$('continueAction')){
       $('continueAction').click();
       say('Восстанавливаем последнюю сохранённую страницу.');
     }else{
       $('heroReadNow')?.click();
       say('Нет сохранённой страницы. Выбери книгу с доступным полным текстом.');
     }
   }
   if(action==='library'){$('myLibrary')?.click();say('Открывается личная книжная полка.');}
   if(action==='discover'){
     const button=document.querySelector('[data-books-source="complete"]');
     button?.click();focusSearch('bookSearch');
     say('Выбраны издания для чтения. Полнота текста указана на карточке.');
   }
   if(action==='import'){
     if(typeof api?.showImport==='function'){api.showImport();say('Добавь свой EPUB, FB2 или TXT — файлы остаются на устройстве.');}
     else say('Импорт книг ещё загружается. Повтори действие.');
   }
 }
 const actions={
   cinema:new Set(['continue','series','search','library']),
   music:new Set(['search','library','radio','import']),
   books:new Set(['continue','library','discover','import'])
 };
 root.querySelectorAll('[data-v78-action]').forEach(button=>{
   button.addEventListener('click',()=>{
     const action=button.dataset.v78Action;
     if(!actions[module]?.has(action))return;
     try {
       if(module==='cinema')movie(action);
       if(module==='music')music(action);
       if(module==='books')book(action);
     }catch{say('Действие не открылось. Можно повторить, не теряя данные.');}
   });
 });
 // Watch history is generated solely from the original Cinema player's
 // recorded progress. Never display catalog-only items as unfinished videos.
 // The Reading Room mirrors the existing reader's saved shelf. The
 // originals in Books remain the only writer of page, chapter and progress.
 if(module==='books'){
   const panel=$('v710ReadingSummary'),title=$('v710ReadingTitle');
   const position=$('v710ReadingPosition');
   const updateReading=()=>{
     const shelf=$('continueShelf');
     const visible=!!shelf&&!shelf.hidden&&!!$('continueTitle')?.textContent?.trim();
     if(panel)panel.hidden=!visible;
     if(!visible)return;
     if(title)title.textContent=$('continueTitle').textContent;
     if(position)position.textContent=$('continueDetails')?.textContent||'Сохранённое место в книге';
   };
   document.addEventListener('vetogram:book-progress',updateReading);
   $('readerBack')?.addEventListener('click',updateReading);
   window.addEventListener?.('focus',updateReading);
   updateReading();
 }
 if(module==='cinema'){
   const shelf=$('v710CinemaResume'),items=$('v710CinemaResumeItems');
   const updateHistory=()=>{
     if(!shelf||!items||typeof document.createElement!=='function')return;
     const api=window.VetogramCinema;
     let data=[];
     try{data=typeof api?.getLibrary==='function'?api.getLibrary():[];}catch{}
     const rows=Array.isArray(data)?data.filter(item=>
       item&&typeof item.id==='string'&&typeof item.title==='string'&&
       Number.isFinite(Number(item.progress))&&Number(item.progress)>0.01&&
       Number(item.progress)<.96
     ).sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0)).slice(0,3):[];
     items.replaceChildren();
     shelf.hidden=rows.length===0;
     for(const entry of rows){
       const button=document.createElement('button');
       button.type='button';button.className='v710-resume-card';
       const title=document.createElement('strong');
       title.textContent=entry.title.slice(0,90);
       const subtitle=document.createElement('small');
       subtitle.textContent='Просмотрено '+Math.round(Number(entry.progress)*100)+'% · Продолжить';
       const bar=document.createElement('span');
       bar.className='v710-resume-track';
       const fill=document.createElement('i');
       fill.style.width=Math.round(Number(entry.progress)*100)+'%';
       bar.appendChild(fill);button.append(title,subtitle,bar);
       button.setAttribute('aria-label','Продолжить «'+entry.title.slice(0,75)+'»');
       button.addEventListener('click',()=>{
         if(typeof api?.openFilm==='function'&&api.openFilm(entry.id)===true)
           say('Открыты сведения о фильме. Продолжить можно в доступном видеоплеере.');
         else say('Этот фильм сейчас недоступен. Можно выбрать другой в каталоге.');
       });
       items.appendChild(button);
     }
   };
   const video=$('cinemaVideo');
   for(const event of ['pause','ended','error'])video?.addEventListener(event,updateHistory);
   document.addEventListener('vetogram:cinema-opened',updateHistory);
   document.addEventListener('vetogram:cinema-library-change',updateHistory);
   document.addEventListener('visibilitychange',()=>{
     if(!document.hidden)updateHistory();
   });
   updateHistory();
 }
 if(module==='music'){
   const audio=$('audio'),nowTitle=$('v78NowTitle'),nowArtist=$('v78NowArtist'),toggle=$('v78NowToggle');
   const progress=$('v710AudioProgress'),elapsed=$('v710AudioElapsed'),duration=$('v710AudioDuration');
   const clock=value=>{
     const whole=Math.max(0,Math.floor(Number(value)||0));
     return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');
   };
   const update=()=>{
     const track=window.VetogramMusic?.now?.();
     const playable=!!track&&!!audio?.src;
     if(nowTitle)nowTitle.textContent=track?.title||'Выбери доступную запись';
     if(nowArtist)nowArtist.textContent=track?.artist||'Плеер внутри Vetogram';
     const total=Number(audio?.duration),position=Number(audio?.currentTime);
     const live=playable&&(track?.source==='radio'||total===Infinity);
     const hasDuration=playable&&!live&&Number.isFinite(total)&&total>0;
     if(progress){
       progress.value=hasDuration?Math.max(0,Math.min(100,100*(Number.isFinite(position)?position:0)/total)):0;
       progress.setAttribute('aria-valuetext',live?'Прямой эфир · фиксированной длительности нет':
         hasDuration?clock(position)+' из '+clock(total):'Пока нет трека с известной длительностью');
     }
     if(elapsed)elapsed.textContent=live?'LIVE':hasDuration?clock(position):'0:00';
     if(duration)duration.textContent=live?'●':hasDuration?clock(total):'0:00';
     if(toggle){toggle.disabled=!playable;toggle.textContent=!audio?.paused&&playable?'Ⅱ':'▶';toggle.setAttribute('aria-label',!audio?.paused&&playable?'Приостановить музыку':'Воспроизвести музыку');}
   };
   for(const event of ['play','playing','pause','ended','loadedmetadata','error','emptied','timeupdate','durationchange'])audio?.addEventListener(event,update);
   let sourceError=false;
   document.addEventListener('vetogram:audio-error',()=>{
     sourceError=true;
     say('Источник не отдал воспроизводимый звук. Выбери другую запись или свой файл.');
     update();
   });
   audio?.addEventListener('playing',()=>{
     if(sourceError){
       sourceError=false;
       say('Звук воспроизводится в основном аудиоплеере.');
     }
   });
   document.addEventListener('vetogram:audio-playing',update);
   document.addEventListener('vetogram:library-change',update);
   toggle?.addEventListener('click',()=>{
     if(toggle.disabled)return;
     // Delegate to the existing player so queue, Media Session and sleep timer
     // stay owned by the original audio controller.
     $('miniPlay')?.click();
     update();
   });
   update();
 }
})();
