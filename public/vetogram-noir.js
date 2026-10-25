// Presentation only. Uses the existing navigation and status controllers.
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('vetogram-noir');
  const dock = document.querySelector('.bottom-nav');
  const action = document.getElementById('actionDock');
  function measureChrome() {
    const visible = element => element && getComputedStyle(element).display !== 'none' && !element.hidden;
    const nav = visible(dock) ? dock.getBoundingClientRect().height : 0;
    const publish = visible(action) && !action.classList.contains('hidden') ? action.getBoundingClientRect().height : 0;
    root.style.setProperty('--noir-nav-height', `${Math.ceil(nav)}px`);
    root.style.setProperty('--noir-action-height', `${Math.ceil(publish)}px`);
  }
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(measureChrome);
    if (dock) observer.observe(dock);
    if (action) observer.observe(action);
  }
  window.addEventListener('resize', measureChrome, {passive: true});
  window.addEventListener('veto:screen-changed', event => {
    root.dataset.noirScreen = event.detail?.screen || 'home';
    requestAnimationFrame(measureChrome);
  });
  // Native, keyboard-accessible disclosures replace repeated onboarding walls.
  document.querySelectorAll('[data-noir-disclosure]').forEach(button => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded)); panel.hidden = expanded;
    });
  });
  // The orb is driven exclusively by the actual AI request lifecycle.
  const orb = document.getElementById('vetoOrb');
  window.addEventListener('vetogram:ai-busy', event => {
    if (!orb) return;
    orb.dataset.busy = String(event.detail?.busy === true);
    orb.setAttribute('aria-label', event.detail?.busy === true ? 'ИИ обрабатывает запрос' : 'ИИ ожидает запрос');
  });
  measureChrome();
})();
