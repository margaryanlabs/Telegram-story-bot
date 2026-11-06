/* Vetogram V9.3 — real discovery navigation for Media and six offline Games.
 * Presentation-only enhancement; native players/readers/game controllers retain ownership.
 */
(()=>{
 'use strict';
 const $=(selector,root=document)=>root?.querySelector?.(selector);
 // Home-level routes reuse the three real cards and their established navigation.
 // This is an immediate-access menu, not a second media controller.
 const mediaHome=$('#v6MediaHome');
 if(mediaHome&&!$('#v9MediaQuickNav',mediaHome)){
   const cardGrid=$('.v72-media-grid',mediaHome);
   const destinations=[
     {id:'cinema',label:'Кино',detail:'Фильмы и сериалы',glyph:'▶'},
     {id:'music',label:'Музыка',detail:'Плеер и коллекция',glyph:'♫'},
     {id:'books',label:'Книги',detail:'Тексты и читалка',glyph:'▤'}
   ];
   if(cardGrid&&destinations.every(item=>$('[data-v6-module="'+item.id+'"]',cardGrid))){
     const shortcuts=document.createElement('nav');
     shortcuts.id='v9MediaQuickNav';
     shortcuts.className='v9-media-quick-nav';
     shortcuts.setAttribute('aria-label','Быстрый переход к медиа');
     for(const item of destinations){
       const button=document.createElement('button');
       button.type='button';
       button.className='v9-media-quick-link';
       button.dataset.v9Module=item.id;
       const icon=document.createElement('span');
       icon.className='v9-media-quick-icon';
       icon.setAttribute('aria-hidden','true');
       icon.textContent=item.glyph;
       const copy=document.createElement('span');
       const label=document.createElement('strong');
       label.textContent=item.label;
       const hint=document.createElement('small');
       hint.textContent=item.detail;
       copy.append(label,hint);
       const arrow=document.createElement('span');
       arrow.className='v9-media-quick-arrow';
       arrow.setAttribute('aria-hidden','true');
       arrow.textContent='↗';
       button.append(icon,copy,arrow);
       button.addEventListener('click',()=>{
         // Delegate to the original media button. Its owner-scoped frame,
         // Back handling, retained audio and iframe handshake stay intact.
         $('[data-v6-module="'+item.id+'"]',cardGrid)?.click();
       });
       shortcuts.appendChild(button);
     }
     mediaHome.insertBefore(shortcuts,mediaHome.firstElementChild);
   }
 }
 const media=$('#v78MediaHub[data-v78-module]');
 if(media){
   const mode=media.dataset.v78Module;
   const nav=$('.v79-media-switcher',media);
   const shell=mode==='cinema'?$('.cinema-shell'):mode==='books'?$('#booksMain'):$('#main');
   const anchor=mode==='cinema'?$('main',shell):shell?.firstElementChild;
   if(nav&&shell&&anchor){
     const dock=document.createElement('div');
     dock.className='v9-explore-dock';
     dock.dataset.v9Module=mode;
     const heading=document.createElement('div');
     heading.className='v9-explore-dock-heading';
     const eyebrow=document.createElement('span');
     eyebrow.textContent='VETOGRAM / НАВИГАЦИЯ';
     const title=document.createElement('strong');
     title.textContent={cinema:'Кино',music:'Музыка',books:'Книги'}[mode]||'Медиа';
     heading.append(eyebrow,title);
     dock.append(heading,nav);
     nav.setAttribute('aria-label','Перейти в раздел медиа');
     // V7.9 owns link routing; move its actual nodes, never clone their listeners.
     shell.insertBefore(dock,anchor);
     if(mode==='cinema'){
       const cinemaNav=$('.cinema-section-nav',anchor);
       const hero=$('#cinemaHero',anchor);
       if(cinemaNav&&hero&&cinemaNav.parentNode===hero.parentNode){
         hero.parentNode.insertBefore(cinemaNav,hero);
         cinemaNav.classList.add('v9-cinema-primary-menu');
         // Reposition the actual search form, preserving its provider,
         // state and search listeners. No duplicate input or query fetch.
         const search=$('#cinemaSearchArea',anchor);
         if(search&&search.parentNode===hero.parentNode){
           hero.parentNode.insertBefore(search,hero);
           search.classList.add('v9-cinema-search-front');
         }
       }
     }
   }
 }
 // Books: four honest entry points into actual sources, never fake editions.
 // The existing source controller still loads texts, languages and local files.
 const booksMain=$('#booksMain');
 if(booksMain&&!$('#v9BooksLanes',booksMain)){
   const sources=$('.source-tabs',booksMain);
   const dock=$('.v9-explore-dock',booksMain);
   const lanes=[
     {id:'complete',label:'Читать целиком',desc:'Доступные тексты'},
     {id:'ru',label:'На русском',desc:'Русская Викитека'},
     {id:'hy',label:'Հայերեն',desc:'Армянская библиотека'},
     {id:'local',label:'Мои книги',desc:'EPUB · FB2 · TXT'}
   ];
   if(sources&&dock&&lanes.every(x=>$('[data-books-source="'+x.id+'"]',sources))){
     const shelf=document.createElement('nav');
     shelf.id='v9BooksLanes';
     shelf.className='v9-books-lanes';
     shelf.setAttribute('aria-label','Выбрать тип книжной библиотеки');
     const buttons=new Map();
     const sync=()=>{
       for(const lane of lanes){
         const source=$('[data-books-source="'+lane.id+'"]',sources);
         const active=source?.classList?.contains('active')===true;
         const button=buttons.get(lane.id);
         if(button){
           button.classList.toggle('is-active',active);
           button.setAttribute('aria-pressed',String(active));
         }
       }
     };
     for(const lane of lanes){
       const button=document.createElement('button');
       button.type='button';
       button.className='v9-books-lane';
       const name=document.createElement('strong');
       name.textContent=lane.label;
       const desc=document.createElement('small');
       desc.textContent=lane.desc;
       button.append(name,desc);
       button.addEventListener('click',()=>{
         const source=$('[data-books-source="'+lane.id+'"]',sources);
         source?.click();
         sync();
         const target=lane.id==='local'?$('#importBanner',booksMain):$('#catalogGrid',booksMain);
         if(target&&!target.hidden){
           const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
           target.scrollIntoView?.({block:'start',behavior:reduce?'auto':'smooth'});
         }
       });
       buttons.set(lane.id,button);
       shelf.appendChild(button);
     }
     dock.insertAdjacentElement('afterend',shelf);
     if(typeof MutationObserver==='function'){
       const observer=new MutationObserver(sync);
       observer.observe(sources,{subtree:true,attributes:true,attributeFilter:['class']});
     }
     sync();
   }
 }
 const gameScreen=$('.screen[data-screen="play"]');
 const launcher=$('#v9ArcadeLauncher',gameScreen);
 const grid=$('.v9-arcade-launch-grid',launcher);
 const heading=$('.v9-arcade-heading',launcher);
 if(!launcher||!grid||!heading||!gameScreen?.classList?.contains('v9-arcade-enhanced'))return;
 const cards=Array.from(grid.querySelectorAll('button[data-v9-launch]'));
 if(cards.length!==6)return;
 const groups=[
   {id:'all',label:'Все игры',names:['reaction','pairs','tic','2048','mines','snake']},
   {id:'skill',label:'На скорость',names:['reaction','snake']},
   {id:'logic',label:'На логику',names:['pairs','tic','2048','mines']},
   {id:'saved',label:'Избранное',names:[]}
 ];
 const typeByGame=Object.freeze({reaction:'СКОРОСТЬ',snake:'АРКАДА',pairs:'ПАМЯТЬ',tic:'ТАКТИКА','2048':'ГОЛОВОЛОМКА',mines:'ЛОГИКА'});
 const recordSpecs=Object.freeze({
   reaction:['vetogram:play:reaction-best:v1','мс','Реакция'],
   pairs:['vetogram:play:memory-best:v1','ходов','Пары'],
   tic:['vetogram:play:tic-wins:v1','побед','Крестики-нолики'],
   '2048':['vetogram:play:2048-best:v1','очков','2048'],
   mines:['vetogram:play:mines-wins:v1','побед','Сапёр'],
   snake:['vetogram:play:snake-best:v1','очков','Змейка']
 });
 const recordNodes=new Map();
 function recordValue(key){
   try{
     const raw=window.localStorage?.getItem(key);
     if(raw===null||raw===undefined||raw==='')return null;
     const value=Number(raw);
     if(!Number.isSafeInteger(value)||value<0||value>100000000)return null;
     return value;
   }catch{return null;}
 }
 const refreshRecords=()=>{
   for(const [id,element] of recordNodes){
     const [key,unit]=recordSpecs[id];
     const value=recordValue(key);
     element.textContent=value===null||(value===0&&id!=='reaction'&&id!=='pairs')
       ?'Твой рекорд ещё впереди':'Личный рекорд · '+value.toLocaleString('ru-RU')+' '+unit;
   }
 };
 for(const card of cards){
   const id=card.dataset.v9Launch;
   if(!Object.hasOwn(typeByGame,id))return;
   const badge=document.createElement('span');
   badge.className='v9-arcade-category';
   badge.textContent=typeByGame[id];
   const art=$('.v9-cover-art',card);
   if(art)card.insertBefore(badge,art.nextSibling);
   const record=document.createElement('span');
   record.className='v9-arcade-record';
   record.setAttribute('aria-live','off');
   card.appendChild(record);
   recordNodes.set(id,record);
 }
 refreshRecords();
 const toolbar=document.createElement('div');
 toolbar.className='v9-arcade-filters';
 const tabs=document.createElement('div');
 tabs.className='v9-arcade-filter-tabs';
 tabs.setAttribute('role','group');
 tabs.setAttribute('aria-label','Категории игр');
 const counter=document.createElement('output');
 counter.className='v9-arcade-filter-count';
 counter.setAttribute('aria-live','polite');
 toolbar.append(tabs,counter);
 heading.insertAdjacentElement('afterend',toolbar);
 const empty=document.createElement('div');
 empty.className='v9-arcade-empty';
 empty.hidden=true;
 const emptyTitle=document.createElement('strong');
 emptyTitle.textContent='Здесь появятся твои любимые игры';
 const emptyHint=document.createElement('p');
 emptyHint.textContent='Открой любую игру, нажми «☆ В избранное», и она появится здесь.';
 const showAll=document.createElement('button');
 showAll.type='button';
 showAll.textContent='Посмотреть все игры';
 empty.append(emptyTitle,emptyHint,showAll);
 grid.insertAdjacentElement('afterend',empty);
 const favorites=()=>window.VetogramPlayFavorites instanceof Set
   ?window.VetogramPlayFavorites:new Set();
 let activeFilter='all';
 const allButtons=[];
 function activate(id,{focus=false}={}){
   const selected=groups.find(item=>item.id===id)||groups[0];
   activeFilter=selected.id;
   const allowed=selected.id==='saved'?favorites():new Set(selected.names);
   let count=0;
   for(const card of cards){
     const visible=allowed.has(card.dataset.v9Launch);
     card.hidden=!visible;
     if(visible)count++;
   }
   for(const button of allButtons){
     const current=button.dataset.v9Filter===selected.id;
     button.setAttribute('aria-pressed',String(current));
     button.classList.toggle('is-active',current);
     if(focus&&current)button.focus({preventScroll:true});
   }
   empty.hidden=selected.id!=='saved'||count!==0;
   counter.textContent=count+' '+(count===1?'игра':count<5?'игры':'игр')+' · офлайн';
 }
 for(const group of groups){
   const button=document.createElement('button');
   button.type='button';
   button.className='v9-arcade-filter';
   button.dataset.v9Filter=group.id;
   button.textContent=group.label;
   button.setAttribute('aria-pressed',String(group.id==='all'));
   button.addEventListener('click',()=>activate(group.id));
   tabs.appendChild(button);allButtons.push(button);
 }
 tabs.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const current=allButtons.indexOf(document.activeElement);
   if(current<0)return;
   event.preventDefault();
   const last=allButtons.length-1;
   const next=event.key==='Home'?0:event.key==='End'?last:
     (current+(event.key==='ArrowRight'?1:-1)+allButtons.length)%allButtons.length;
   activate(allButtons[next].dataset.v9Filter,{focus:true});
 });
 showAll.addEventListener('click',()=>activate('all'));
 window.addEventListener?.('vetogram:play-favorites-changed',()=>{
   if(activeFilter==='saved')activate('saved');
 });
 for(const event of ['vetogram:game-close','storage','focus']){
   window.addEventListener?.(event,refreshRecords);
 }
 window.addEventListener?.('veto:screen-changed',event=>{
   if(event?.detail?.screen==='play'){
     refreshRecords();
     if(activeFilter==='saved')activate('saved');
   }
 });
 activate('all');
})();
