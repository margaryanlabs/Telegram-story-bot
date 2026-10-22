/* Vetogram inbox header: accessible manual expand, automatic collapse when scrolling.
   No network, chat inspection, storage, or account-side effects. */
(() => {
  'use strict';
  const heading=document.querySelector('#telegramMirror .vetogram-header');
  const toggle=document.getElementById('vetogramHeaderToggle');
  if(!heading||!toggle)return;

  let expanded=true;
  // Only apply the Telegram chrome inset to a signed in-app launch.
  if(window.Telegram?.WebApp?.initData){document.body.classList.add('vetogram-in-tg');}
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

  // The header remains expanded when scrolling; collapse is manual only.
  setExpanded(true);
})();
