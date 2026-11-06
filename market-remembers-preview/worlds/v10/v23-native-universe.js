/* Market Remembers V23: universe overlay around ORIGINAL People and Event Core engines.
   Never create substitute planet spheres or fabricated trader activity. */
(()=>{
'use strict';
const app=document.getElementById('app');
if(!app||!document.getElementById('scene')||document.getElementById('v23Cosmos'))return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const manager=()=>window.MarketHistoryModes;
const $=id=>document.getElementById(id);
const worlds=[
 ['people','PEOPLE','01 / HUMAN MEMORY','Оригинальный живой глобус историй, реальных уроков и решений.',true,'✧'],
 ['events','EVENT CORE','02 / FINANCIAL HISTORY','Оригинальный глобус кризисов, исторических связей и исследования событий.',true,'◈'],
 ['decisions','DECISIONS','03 / DECISION INTELLIGENCE','Гипотезы до результата, разбор исходов и Decision Passport.',false,'◇'],
 ['agora','AGORA','04 / CONVERSATIONS','Комнаты обсуждений, вопросы, аргументы и совместные исследования.',false,'✦'],
 ['mirror','MIRROR','05 / REFLECTION','Анализ повторяющихся ошибок и развитие финансового мышления.',false,'◉'],
 ['guilds','GUILDS','06 / COLLECTIVE','Сообщества, профессиональные группы, наставники и общие исследования.',false,'⟡']
];
const escape=text=>String(text).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hub=document.createElement('section');
hub.id='v23Cosmos';hub.className='v23-cosmos';hub.hidden=true;hub.setAttribute('aria-label','Финансовая вселенная — карта настоящих миров');
hub.innerHTML=[
 '<div class="v23-sky" aria-hidden="true"></div><div class="v23-nebula" aria-hidden="true"></div>',
 '<div class="v23-orbit v23-orbit-a" aria-hidden="true"></div><div class="v23-orbit v23-orbit-b" aria-hidden="true"></div><div class="v23-orbit v23-orbit-c" aria-hidden="true"></div>',
 '<header class="v23-head"><div class="v23-brand"><img class="v27-veto-mark" src="v10/v27-veto-mark.svg" alt="" width="39" height="39"><span class="v27-wordmark">VETO</span><span><strong>MARKET REMEMBERS</strong><small>THE LIVING FINANCIAL UNIVERSE</small></span></div><button id="v23CloseHub" class="v23-close" type="button" aria-label="Закрыть карту планет">ЗАКРЫТЬ <span aria-hidden="true">×</span></button></header>',
 '<section class="v23-intro" aria-labelledby="v23Title"><div class="v23-kicker">SIX WORLDS · ONE LIVING MEMORY</div><h1 id="v23Title">THE FINANCIAL<br><em>UNIVERSE.</em></h1><p>Выбери планету для путешествия внутрь мира. PEOPLE и EVENT CORE сохраняют исходные 3D-сцены.</p></section>',
 '<div class="v23-live-name" aria-hidden="true"><span>LIVE / ORIGINAL RENDERER</span><strong id="v23PlanetLabel">PEOPLE</strong></div>',
 '<nav class="v23-index" aria-label="Выбор мира"><div class="v23-index-title"><strong>EXPLORE THE UNIVERSE</strong><span>02 ORIGINAL / 04 LABS</span></div><div class="v23-worlds">',
 worlds.map(w=>'<button type="button" class="v23-world '+(w[4]?'v23-live':'v23-future')+'" data-v23-world="'+w[0]+'"><span class="v23-emblem" aria-hidden="true">'+w[5]+'</span><span class="v23-word"><small>'+escape(w[2])+'</small><strong>'+escape(w[1])+'</strong></span><span class="v23-availability">'+(w[4]?'ENTER ↗':'EXPLORE ↗')+'</span></button>').join(''),
 '</div><div class="v23-disclaimer">Два исходных 3D-архива и четыре интерактивных локальных исследовательских мира.</div></nav>',
 '<div class="v23-flight" aria-hidden="true"><small>ENTERING THE ORIGINAL WORLD</small><strong id="v23FlightWorld">PEOPLE</strong></div>',
 '<div class="v23-detail" id="v23Detail" role="dialog" aria-modal="true" aria-labelledby="v23DetailTitle" hidden><button id="v23DetailClose" type="button" class="v23-detail-close" aria-label="Закрыть">×</button><span>WORLD IN DEVELOPMENT</span><h2 id="v23DetailTitle"></h2><p id="v23DetailBody"></p><button type="button" id="v23DetailBack">← К КАРТЕ МИРОВ</button></div>',
 '<footer class="v23-foot"><span>SIX WORLDS · TWO ORIGINAL ARCHIVES · FOUR LABS</span><span>EXPLORE · REMEMBER · CONNECT</span></footer>',
 '<div class="v23-sr" id="v23Status" role="status" aria-live="polite"></div>'
].join('');
app.append(hub);
const home=document.createElement('button');
home.type='button';home.id='v23Home';home.className='v23-home';
home.innerHTML='<span aria-hidden="true">✧</span> СИСТЕМА МИРОВ';
home.setAttribute('aria-label','Открыть космическую карту миров');app.append(home);
const detail=$('v23Detail'),status=$('v23Status');
let opened=false,entering=false,flightTimer=0;
function current(){
 return manager()?.mode==='events'||manager()?.mode==='connections'?'events':'people';
}
function mark(){
 const id=current();hub.dataset.liveWorld=id;
 $('v23PlanetLabel').textContent=id==='people'?'PEOPLE':'EVENT CORE';
 hub.querySelectorAll('[data-v23-world]').forEach(button=>{
  const chosen=button.dataset.v23World===id;
  button.classList.toggle('is-current',chosen);
  if(chosen)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
 });
}
function open(){
 if(opened)return;
 opened=true;entering=false;hub.hidden=false;app.classList.add('v23-open');
 window.MarketFourPlanets?.resume();
 home.hidden=true;mark();
 status.textContent='Карта миров открыта. Центральная сфера — оригинальный '+$('v23PlanetLabel').textContent+'.';
 $('v23CloseHub').focus({preventScroll:true});
 const url=new URL(location.href);
 if(url.searchParams.has('cosmos')){
  url.searchParams.delete('cosmos');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 }
}
function close(){
 if(!opened)return;
 opened=false;entering=false;
 if(flightTimer){clearTimeout(flightTimer);flightTimer=0;}
 hub.classList.remove('v23-entering','v26-to-events','v26-to-people');app.classList.remove('v23-open','v26-to-people');
 hub.hidden=true;detail.hidden=true;home.hidden=false;
 mark();home.focus({preventScroll:true});
}
function enter(id){
 if(entering||!['people','events'].includes(id))return;
 const core=manager();
 if(!core||typeof core.setMode!=='function'){status.textContent='Движок мира ещё загружается.';return;}
 entering=true;detail.hidden=true;
 // Measure the untransformed native planet BEFORE applying the flight class,
 // otherwise getBoundingClientRect would sample the enlarged satellite.
 if(id==='events'){
  const satellite=document.getElementById('v24EventOrbit');
  if(satellite){
   const box=satellite.getBoundingClientRect();
   const dx=innerWidth*.51-(box.left+box.width*.5);
   const dy=innerHeight*.49-(box.top+box.height*.5);
   const scale=Math.max(2.3,Math.min(5.5,innerWidth/(Math.max(1,box.width)*1.16),innerHeight/(Math.max(1,box.height)*1.16)));
   satellite.style.setProperty('--v26-flight-x',dx.toFixed(1)+'px');
   satellite.style.setProperty('--v26-flight-y',dy.toFixed(1)+'px');
   satellite.style.setProperty('--v26-flight-scale',scale.toFixed(2));
  }
 }
 // The original V20/V24 renderers stay mounted while the camera approaches.
 // Both selection and scene handoff happen inside this same document.
 hub.classList.add('v23-entering','v26-to-'+id);
 if(id==='people')app.classList.add('v26-to-people');
 $('v23FlightWorld').textContent=id==='people'?'PEOPLE':'EVENT CORE';
 status.textContent='Приближаемся к '+$('v23FlightWorld').textContent+' — переход без новой страницы.';
 flightTimer=setTimeout(()=>{
  core.setMode(id,true);mark();
  flightTimer=setTimeout(close,reduce?35:370);
 },reduce?0:690);
}
function planned(id){
 const w=worlds.find(x=>x[0]===id);if(!w||w[4])return;
 if(window.MarketWorldChambers){window.MarketWorldChambers.open(id);return;}
 $('v23DetailTitle').textContent=w[1];$('v23DetailBody').textContent=w[3];
 detail.hidden=false;$('v23DetailClose').focus({preventScroll:true});
 status.textContent=w[1]+' пока в разработке.';
}
function back(){
 detail.hidden=true;
 hub.querySelector('[data-v23-world="'+current()+'"]').focus({preventScroll:true});
}
home.addEventListener('click',open);$('v23CloseHub').addEventListener('click',close);
for(const button of hub.querySelectorAll('[data-v23-world]')){
 button.addEventListener('click',()=>{
  const w=worlds.find(x=>x[0]===button.dataset.v23World);
  if(w?.[4])enter(w[0]);else if(w)planned(w[0]);
 });
}
$('v23DetailClose').addEventListener('click',back);
$('v23DetailBack').addEventListener('click',back);
hub.addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();if(!detail.hidden)back();else close();return;}
 if(!detail.hidden&&event.key==='Tab'){
  const els=[$('v23DetailClose'),$('v23DetailBack')],i=els.indexOf(document.activeElement);
  if(i===0&&event.shiftKey){event.preventDefault();els[1].focus();}
  if(i===1&&!event.shiftKey){event.preventDefault();els[0].focus();}
 }
});
if(new URLSearchParams(location.search).get('cosmos')==='1')open();
window.MarketNativeUniverse=Object.freeze({
 open,close,enter,get active(){return opened;},
 version:'26.0.0',renderer:'ORIGINAL V20 PEOPLE & PEOPLE-MIRRORED EVENT CORE'
});
})();