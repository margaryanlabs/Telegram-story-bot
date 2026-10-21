/* Vetogram inbox header: accessible manual expand, automatic collapse when scrolling.
   No network, chat inspection, storage, or account-side effects. */
(() => {
  'use strict';
  const heading=document.querySelector('#telegramMirror .vetogram-header');
  const toggle=document.getElementById('vetogramHeaderToggle');
  if(!heading||!toggle)return;

  let expanded=false;
  let lastScrollY=Math.max(0,window.scrollY||0);
  let ticking=false;
  const activate=Boolean(window.Telegram?.WebApp?.HapticFeedback?.impactOccurred);

  function setExpanded(next) {
    expanded=Boolean(next);
    heading.classList.toggle('is-expanded',expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.setAttribute('aria-label',expanded?'Свернуть верхнюю панель чатов':'Развернуть верхнюю панель чатов');
    toggle.title=expanded?'Свернуть':'Развернуть';
  }
  toggle.addEventListener('click',()=>{
    setExpanded(!expanded);
    if(activate){
      try{window.Telegram.WebApp.HapticFeedback.impactOccurred('light')}catch{}
    }
  });

  function onScroll(){
    ticking=false;
    const y=Math.max(0,window.scrollY||0);
    const movingDown=y>lastScrollY+5;
    if(expanded&&movingDown&&y>64&&
       document.body.classList.contains('veto-chat-active')&&
       !document.body.classList.contains('veto-chat-thread')){
      setExpanded(false);
    }
    lastScrollY=y;
  }
  window.addEventListener('scroll',()=>{
    if(ticking)return;
    ticking=true;
    if(typeof window.requestAnimationFrame==='function'){
      window.requestAnimationFrame(onScroll);
    }else{
      onScroll();
    }
  },{passive:true});
  setExpanded(false);
})();
