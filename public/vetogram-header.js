/* A compact, fixed-height messenger title replaces the legacy expanding
   dashboard. Telegram owns its native top bar; this script only detects
   a verified Mini App launch for safe-area styling. */
(() => {
  'use strict';
  const webApp=window.Telegram?.WebApp;
  // This is a presentation hint only. Server checks signed initData itself.
  if(webApp?.initData)document.body.classList.add('vetogram-in-tg');
  const title=document.querySelector('#telegramMirror .vetogram-header');
  if(!title)return;
  title.classList.remove?.('is-expanded');
  title.setAttribute('aria-label','VETOGRAM — чаты');
})();
