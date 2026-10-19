/* VETO launch motion: presentation only, no telemetry, network or message access.
   Does not modify Telegram events, storage, navigation or chat payloads. */
(function(){
  'use strict';
  const doc=document;
  const header=doc.querySelector('#telegramMirror .veto-mirror-heading');
  const list=doc.getElementById('telegramMirrorList');
  if(!header||!list)return;
  const reduce=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=typeof window.matchMedia==='function'&&window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(!reduce&&finePointer&&typeof window.requestAnimationFrame==='function'){
    let frame=0,coords=null;
    header.addEventListener('pointermove',function(event){
      const bounds=header.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      const nx=Math.max(-1,Math.min(1,((event.clientX-bounds.left)/bounds.width-.5)*2));
      const ny=Math.max(-1,Math.min(1,((event.clientY-bounds.top)/bounds.height-.5)*2));
      coords=[nx,ny];
      if(frame)return;
      frame=window.requestAnimationFrame(function(){
        frame=0;
        if(!coords)return;
        header.style.setProperty('--veto-light-x',(coords[0]*12).toFixed(1)+'px');
        header.style.setProperty('--veto-light-y',(coords[1]*8).toFixed(1)+'px');
        header.style.setProperty('--veto-light-reverse-x',(-coords[0]*8).toFixed(1)+'px');
        header.style.setProperty('--veto-light-reverse-y',(-coords[1]*5).toFixed(1)+'px');
      });
    },{passive:true});
    header.addEventListener('pointerleave',function(){
      coords=null;
      header.style.setProperty('--veto-light-x','0px');
      header.style.setProperty('--veto-light-y','0px');
      header.style.setProperty('--veto-light-reverse-x','0px');
      header.style.setProperty('--veto-light-reverse-y','0px');
    },{passive:true});
  }
  // Animate only the first handful of real rows on first discovery.
  // Do not inspect titles/message content or replay animation on each refresh.
  if(reduce||typeof window.MutationObserver!=='function')return;
  let finished=false,attempts=0;
  let observer=null;
  function reveal(){
    if(finished)return;
    attempts++;
    const rows=Array.from(list.querySelectorAll('.veto-mirror-chat')).slice(0,8);
    if(!rows.length)return;
    rows.forEach((row,index)=>{
      row.style.setProperty('--veto-enter-delay',String(index*32)+'ms');
      row.classList.add('veto-polish-enter');
      row.addEventListener('animationend',function(){row.classList.remove('veto-polish-enter');},{once:true});
    });
    finished=true;
    if(observer)observer.disconnect();
  }
  reveal();
  if(!finished){
    observer=new window.MutationObserver(function(){
      reveal();
      // Bound observation work if an account never connects.
      if(attempts>40&&observer)observer.disconnect();
    });
    observer.observe(list,{childList:true});
  }
})();
