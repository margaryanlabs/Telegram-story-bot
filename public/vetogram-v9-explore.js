/* Vetogram V9.3 — real discovery navigation for Media and six offline Games.
 * Presentation-only enhancement; native players/readers/game controllers retain ownership.
 */
(()=>{
 'use strict';
 const $=(selector,root=document)=>root?.querySelector?.(selector);
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
       }
     }
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
   {id:'logic',label:'На логику',names:['pairs','tic','2048','mines']}
 ];
 const typeByGame=Object.freeze({reaction:'СКОРОСТЬ',snake:'АРКАДА',pairs:'ПАМЯТЬ',tic:'ТАКТИКА','2048':'ГОЛОВОЛОМКА',mines:'ЛОГИКА'});
 for(const card of cards){
   const id=card.dataset.v9Launch;
   if(!Object.hasOwn(typeByGame,id))return;
   const badge=document.createElement('span');
   badge.className='v9-arcade-category';
   badge.textContent=typeByGame[id];
   const art=$('.v9-cover-art',card);
   if(art)card.insertBefore(badge,art.nextSibling);
 }
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
 const allButtons=[];
 function activate(id,{focus=false}={}){
   const selected=groups.find(item=>item.id===id)||groups[0];
   const allowed=new Set(selected.names);
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
 activate('all');
})();
