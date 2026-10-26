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
  const editableOnActiveScreen=element=>{
    if(!editable(element))return false;
    const screen=element.closest?.('.screen');
    return !screen||screen.classList.contains('active');
  };
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
    const keyboard=editableOnActiveScreen(document.activeElement) && scale<=1.05 &&
      (bottom>110 || visibleHeight<layoutHeight*0.73);
    // Telegram content safe area and device notch overlap: never sum them.
    const safeNumber=value=>Math.max(0,Math.min(160,Number(value)||0));
    const contentTop=safeNumber(telegram?.contentSafeAreaInset?.top);
    const deviceTop=safeNumber(telegram?.safeAreaInset?.top);
    const signature=[visibleHeight,bottom,keyboard,contentTop,deviceTop].join('/');
    if(signature===previous)return;
    previous=signature;
    root.style.setProperty('--veto-visible-height',visibleHeight+'px');
    root.style.setProperty('--vetogram-sdk-content-top',contentTop+'px');
    root.style.setProperty('--vetogram-sdk-device-top',deviceTop+'px');
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
  // Navigation can hide the focused input before the keyboard resize event.
  // Clear the abandoned focus so a prior screen cannot hold keyboard geometry.
  window.addEventListener('veto:screen-changed',()=>{
    const focused=document.activeElement;
    const screen=focused?.closest?.('.screen');
    if(editable(focused)&&screen&&!screen.classList.contains('active'))
      focused.blur?.();
    schedule();
  });
  document.addEventListener('focusout',()=>{
    // Focus transfer between inputs may happen in the same turn.
    setTimeout(schedule,80);
  });
  telegram?.onEvent?.('viewportChanged',schedule);
  telegram?.onEvent?.('safeAreaChanged',schedule);
  telegram?.onEvent?.('contentSafeAreaChanged',schedule);
  measure();
})();
