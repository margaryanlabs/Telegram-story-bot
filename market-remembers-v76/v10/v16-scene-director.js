/* MARKET REMEMBERS V16 / SIGNAL OBSERVATORY
 * A meaningful two-world passage, source-aware event HUD and minimal active
 * tether. This module owns only EVENT CORE embellishment; People remains intact.
 */
(() => {
 'use strict';
 const app=document.getElementById('app'),scene=document.getElementById('scene');
 if(!app||!scene||document.getElementById('mhV16Portal'))return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const portal=document.createElement('div');
 portal.id='mhV16Portal';
 portal.className='mh-v16-portal';
 portal.hidden=true;
 portal.setAttribute('aria-hidden','true');
 portal.innerHTML='<div class="mh-v16-portal-shadow"></div>'+
  '<div class="mh-v16-portal-convergence"><span></span><span></span><span></span></div>'+
  '<div class="mh-v16-portal-iris"><i></i><i></i></div>'+
  '<div class="mh-v16-portal-copy"><small>THE MARKET REMEMBERS</small><strong id="mhV16PortalTitle">EVENT CORE</strong><em id="mhV16PortalSubtitle">ENTERING THE MARKET MEMORY</em></div>';
 app.append(portal);
 const optics=document.createElement('div');
 optics.className='mh-v16-optics';optics.id='mhV16Optics';
 optics.setAttribute('aria-hidden','true');
 optics.innerHTML='<span class="mh-v16-halo"></span><span class="mh-v16-ring mh-v16-ring-a"></span><span class="mh-v16-ring mh-v16-ring-b"></span><span class="mh-v16-tick-arc"></span><span class="mh-v16-scan"></span>';
 scene.append(optics);
 const hud=document.createElement('aside');
 hud.id='mhV16HUD';hud.className='mh-v16-hud';
 hud.setAttribute('aria-live','off');
 hud.innerHTML='<span class="mh-v16-hud-overline"><i></i> OBSERVATORY / 04 CASES</span>'+
  '<strong>THE MARKET <em>REMEMBERS.</em></strong>'+
  '<span class="mh-v16-hud-caption">Исследуй, как события меняли рынки.</span>';
 app.append(hud);
 const signal=document.createElement('div');
 signal.className='mh-v16-signal-readout';
 signal.setAttribute('aria-hidden','true');
 signal.innerHTML='<small>ARCHIVE SIGNAL</small><strong id="mhV16SignalYear">2008</strong><span id="mhV16SignalName">CRISIS MEMORY</span>';
 scene.append(signal);
 const ns='http://www.w3.org/2000/svg';
 const tether=document.createElementNS(ns,'svg');
 tether.setAttribute('id','mhV16Tether');
 tether.setAttribute('class','mh-v16-tether');
 tether.setAttribute('aria-hidden','true');
 tether.innerHTML='<defs><linearGradient id="mhV16TetherLine" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0" stop-color="#F2CDD6" stop-opacity=".78"/><stop offset=".6" stop-color="#C87991" stop-opacity=".45"/><stop offset="1" stop-color="#DDB9CE" stop-opacity=".12"/></linearGradient></defs><path id="mhV16TetherPath"/><circle id="mhV16TetherPulse" r="2.5"/>';
 scene.append(tether);
 const burst=document.createElement('div');
 burst.id='mhEventBurst';burst.className='mh-event-burst';
 burst.setAttribute('aria-hidden','true');
 burst.innerHTML='<i class="mh-event-burst-ring"></i><i class="mh-event-burst-ring mh-event-burst-ring-second"></i><i class="mh-event-burst-flare"></i>';
 scene.append(burst);
 let signalUntil=0,signalTimeout=0;
 function triggerEvent(){
   if(reduced)return;
   signalUntil=performance.now()+820;
   burst.classList.remove('is-live');
   void burst.offsetWidth;
   burst.classList.add('is-live');
   clearTimeout(signalTimeout);
   signalTimeout=window.setTimeout(()=>{burst.classList.remove('is-live');},850);
 }
 let busy=false,token=0;
 function run(from,to,commit){
   if(typeof commit!=='function')return;
   if(busy)return; // Portal blocks duplicate clicks, no conflicting commits.
   if(reduced||document.hidden){commit();return;}
   busy=true;const id=++token;
   const direction=to==='people'?'return':'enter';
   portal.dataset.direction=direction;
   portal.dataset.phase='collapse';
   portal.hidden=false;
   document.getElementById('mhV16PortalTitle').textContent=direction==='enter'?'EVENT CORE':'PEOPLE UNIVERSE';
   document.getElementById('mhV16PortalSubtitle').textContent=direction==='enter'?'THE MARKET REMEMBERS EVERY SHOCK':'EVERY MARKET HAS A HUMAN STORY';
   app.classList.add('mh-v16-passing');
   window.setTimeout(()=>{
     if(token!==id)return;
     commit();
     portal.dataset.phase='ignite';
   },440);
   window.setTimeout(()=>{if(token===id)portal.dataset.phase='reveal';},705);
   window.setTimeout(()=>{
     if(token!==id)return;
     portal.hidden=true;
     portal.dataset.phase='';
     app.classList.remove('mh-v16-passing');
     busy=false;
   },1190);
 }
 function setEvent(item){
   if(!item)return;
   const year=document.getElementById('mhV16SignalYear'),name=document.getElementById('mhV16SignalName');
   if(year)year.textContent=item.year;
   if(name)name.textContent=item.short||item.name||'FINANCIAL EVENT';
 }
 function position(point,sceneRect,panelRect,expanded){
   // A short opt-in optical response, never a line across the entire screen.
   // Existing selected point is tracked by the planet's 3D projection.
   if(app.dataset.mhMode==='people'||!point||!point.visible){
     tether.style.opacity='0';burst.style.opacity='0';return;
   }
   const w=sceneRect.width,h=sceneRect.height;
   if(w<1||h<1)return;
   const x=point.x,y=point.y;
   burst.style.left=x+'px';burst.style.top=y+'px';
   const live=!expanded&&performance.now()<signalUntil;
   tether.style.opacity=live?'.67':'0';
   if(!live)return;
   tether.setAttribute('viewBox','0 0 '+w+' '+h);
   const mobile=w<820;
   const targetX=panelRect?panelRect.left-sceneRect.left+(mobile?panelRect.width*.5:6):x;
   const targetY=panelRect?panelRect.top-sceneRect.top:y+100;
   const theta=Math.atan2(targetY-y,targetX-x);
   const length=mobile?64:86;
   const endX=x+Math.cos(theta)*length,endY=y+Math.sin(theta)*length;
   const side=mobile?13:21;
   const midX=x+Math.cos(theta)*length*.53-Math.sin(theta)*side;
   const midY=y+Math.sin(theta)*length*.53+Math.cos(theta)*side;
   document.getElementById('mhV16TetherPath').setAttribute('d',
     'M '+x.toFixed(1)+' '+y.toFixed(1)+' Q '+midX.toFixed(1)+' '+midY.toFixed(1)+' '+endX.toFixed(1)+' '+endY.toFixed(1));
   document.getElementById('mhV16TetherPulse').setAttribute('cx',x);
   document.getElementById('mhV16TetherPulse').setAttribute('cy',y);
 }
 const initial=window.MarketHistoryModes;
 if(initial){
   const item=initial.events.find(e=>e.id===initial.activeEvent);
   if(item)setEvent(item);
 }
 app.classList.add('mh-v16');
 window.MarketWorldTransition=Object.freeze({run,get busy(){return busy;}});
 window.MarketSignalDirector=Object.freeze({setEvent,position,triggerEvent});
})();
