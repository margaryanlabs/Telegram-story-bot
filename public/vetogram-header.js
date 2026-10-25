/* Vetogram inbox header: accessible manual expand and collapse.
   No network, chat inspection, storage, or account-side effects. */
(() => {
  'use strict';
  const heading=document.querySelector('#telegramMirror .vetogram-header');
  const toggle=document.getElementById('vetogramHeaderToggle');
  if(!heading||!toggle)return;

  let expanded=false;
  // Only apply the Telegram chrome inset to an in-app launch (visual hint only; API verifies the signature).
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

  // Chat content comes first on phones, tools remain one explicit tap away.
  // Desktop keeps the expanded presentation. No scroll-driven surprise changes.
  const compactOnPhone=typeof window.matchMedia==='function'
    && window.matchMedia('(max-width: 620px)').matches;
  setExpanded(!compactOnPhone);
})();
