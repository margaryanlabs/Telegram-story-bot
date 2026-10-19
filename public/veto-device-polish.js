// Keep Telegram Mini App geometry honest when the on-screen keyboard,
// safe-area, browser chrome or device orientation changes.
// Cosmetic viewport measurements only; no owner data or persistence.
(() => {
  'use strict';
  const root=document.documentElement;
  const telegram=window.Telegram?.WebApp;
  let frame=0;
  let previous='';
  const editable=element=>Boolean(element?.matches?.(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"]'
  ));
  function measure() {
    frame=0;
    const vv=window.visualViewport;
    const layoutHeight=Math.max(1,window.innerHeight||document.documentElement.clientHeight||0);
    const scale=Number(vv?.scale||1);
    const visibleHeight=Math.max(1,Math.round(vv?.height||layoutHeight));
    const top=Math.max(0,Math.round(vv?.offsetTop||0));
    const bottom=Math.max(0,Math.round(layoutHeight-(top+visibleHeight)));
    // Browser toolbars may change visualViewport. Only an editable focus AND
    // a substantial viewport reduction qualify as a keyboard.
    const keyboard=editable(document.activeElement) && scale<=1.05 &&
      (bottom>110 || visibleHeight<layoutHeight*0.73);
    const signature=[visibleHeight,bottom,keyboard].join('/');
    if(signature===previous)return;
    previous=signature;
    root.style.setProperty('--veto-visible-height',visibleHeight+'px');
    root.style.setProperty('--veto-visual-bottom',keyboard?bottom+'px':'0px');
    root.classList.toggle('veto-keyboard-open',keyboard);
  }
  function schedule() {
    if(frame)return;
    frame=requestAnimationFrame(measure);
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  document.addEventListener('focusin',schedule);
  document.addEventListener('focusout',()=>{
    // Focus transfer between inputs may happen in the same turn.
    setTimeout(schedule,80);
  });
  telegram?.onEvent?.('viewportChanged',schedule);
  measure();
})();
