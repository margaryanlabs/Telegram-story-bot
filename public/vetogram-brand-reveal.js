/* VETOGRAM • one-time signed-session brand reveal.
   Listens for the main app's owner-verified session event.
   Does not touch authentication, messages, API keys or Telegram APIs. */
(() => {
  'use strict';
  const stage = document.getElementById('vetoBrandReveal');
  if (!stage) return;
  let alreadyPlayed = false;
  let hideTask = null;
  let cleanupTask = null;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const hide = () => {
    clearTimeout(hideTask);
    clearTimeout(cleanupTask);
    stage.classList.remove('is-visible');
    stage.hidden = true;
  };
  const reveal = () => {
    if (alreadyPlayed || document.hidden) return;
    // Wait until first-time guidance is dismissed; do not consume the reveal.
    if (!document.getElementById('vetoWelcome')?.hidden) return;
    alreadyPlayed = true;
    stage.hidden = false;
    requestAnimationFrame(() => stage.classList.add('is-visible'));
    hideTask = setTimeout(() => {
      stage.classList.remove('is-visible');
      cleanupTask = setTimeout(() => { stage.hidden = true; }, reduced ? 10 : 360);
    }, reduced ? 450 : 1750);
  };
  window.addEventListener('vetogram:telegram-session-connected', reveal);
  window.addEventListener('pagehide', hide);
  window.VetoBrandReveal = reveal;
})();
