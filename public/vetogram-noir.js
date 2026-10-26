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
  // Move the *existing* owner-scoped Story strip; its controller, listeners,
  // cache and media permissions remain singular across both destinations.
  function placeStoryStrip(screen) {
    const strip = document.querySelector('.veto-story-strip');
    const target = document.getElementById('v5StoriesWatch');
    const inbox = document.getElementById('telegramChatsView');
    const heading = inbox?.querySelector('.veto-mirror-heading');
    if (!strip || !target || !heading) return;
    if (screen === 'publish') {
      if (strip.parentElement !== target) target.appendChild(strip);
    } else if (strip.parentElement !== inbox) {
      heading.insertAdjacentElement('afterend', strip);
    }
  }
  document.getElementById('v5StoriesWatchButton')?.addEventListener('click', () => {
    const target = document.getElementById('v5StoriesWatch');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target?.scrollIntoView?.({block: 'start', behavior: reduced ? 'auto' : 'smooth'});
    target?.querySelector('[data-veto-story-refresh]')?.focus({preventScroll: true});
  });
  window.addEventListener('resize', measureChrome, {passive: true});
  window.addEventListener('veto:screen-changed', event => {
    root.dataset.noirScreen = event.detail?.screen || 'home';
    placeStoryStrip(root.dataset.noirScreen);
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
  placeStoryStrip(document.querySelector('.screen.active')?.dataset.screen);
  measureChrome();
})();
