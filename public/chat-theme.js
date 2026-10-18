(() => {
  'use strict';
  // App-wide appearance is a cosmetic preference, never account/chat data.
  const root=document.getElementById('telegramMirror');
  const panel=document.getElementById('telegramChatThemes');
  const toggle=document.getElementById('vetoGlobalThemeToggle');
  const menu=document.getElementById('vetoGlobalThemeMenu');
  const control=document.getElementById('vetoGlobalAppearance');
  const bar=document.querySelector('.topbar');
  const KEY='veto-chat-appearance-v1';
  if(!root||!panel||!toggle||!menu||!control||!bar)return;
  const allowed=new Set(['graphite','pearl','slate','linen']);
  const normalize=value=>allowed.has(value)?value:'graphite';
  const symbols={graphite:'◐',pearl:'☼',slate:'◕',linen:'◒'};
  const labels={graphite:'Графит',pearl:'Белый',slate:'Сланец',linen:'Лён'};
  function paint(value) {
    const theme=normalize(value);
    root.dataset.chatTheme=theme;
    document.documentElement.dataset.vetoTheme=theme;
    toggle.textContent=symbols[theme];
    toggle.setAttribute('aria-label','Тема приложения: '+labels[theme]);
    panel.querySelectorAll('[data-chat-theme-option]').forEach(button=>{
      const chosen=button.dataset.chatThemeOption===theme;
      button.classList.toggle('selected',chosen);
      button.setAttribute('aria-pressed',String(chosen));
    });
    const bright=['pearl','linen'].includes(theme);
    const color=theme==='pearl'?'#f4f7fb':theme==='linen'?'#f2eee6':
      theme==='slate'?'#182534':'#080c13';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',color);
    try{window.Telegram?.WebApp?.setBackgroundColor?.(color)}catch{}
    try{window.Telegram?.WebApp?.setHeaderColor?.(color)}catch{}
    document.body.classList.toggle('veto-light-theme',bright);
  }
  function closeMenu(){
    menu.hidden=true;toggle.setAttribute('aria-expanded','false');
  }
  function placeMenu(){
    const rect=toggle.getBoundingClientRect();
    menu.style.setProperty('--veto-theme-menu-top',
      Math.min(window.innerHeight-236,Math.max(10,rect.bottom+9))+'px');
  }
  function dock(where) {
    const inMessenger=document.querySelector('.screen[data-screen="telegram"]')?.classList.contains('active')===true;
    const inThread=inMessenger&&(where==='thread'||document.getElementById('telegramThreadView')?.hidden===false);
    document.body.classList.toggle('veto-chat-active',inMessenger);
    document.body.classList.toggle('veto-chat-thread',inThread);
    const target=inThread?document.querySelector('#telegramThreadView .veto-mirror-thread-bar'):
      inMessenger?document.querySelector('#telegramMirror .veto-mirror-header-actions'):
      bar;
    if(target&&control.parentElement!==target){
      closeMenu();
      if(inThread)target.insertBefore(control,document.getElementById('telegramThreadRefresh'));
      else if(inMessenger)target.insertBefore(control,target.firstChild);
      else bar.insertBefore(control,document.getElementById('profileButton'));
    }
  }
  let selected='graphite';
  try{selected=window.localStorage.getItem(KEY)||selected}catch{}
  paint(selected);
  // Keep the popover outside the clipped chat scroller when the toggle docks into a thread.
  document.body.appendChild(menu);
  dock();
  toggle.addEventListener('click',()=>{
    const show=menu.hidden;
    if(show)placeMenu();
    menu.hidden=!show;toggle.setAttribute('aria-expanded',String(show));
    try{window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()}catch{}
  });
  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-chat-theme-option]');
    if(!button||!panel.contains(button))return;
    const theme=normalize(button.dataset.chatThemeOption);
    paint(theme);closeMenu();
    try{window.localStorage.setItem(KEY,theme)}catch{}
    try{window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()}catch{}
  });
  document.addEventListener('pointerdown',event=>{
    if(!menu.hidden&&!control.contains(event.target)&&!menu.contains(event.target))closeMenu();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!menu.hidden){closeMenu();toggle.focus()}
  });
  window.addEventListener('storage',event=>{
    if(event.key===KEY)paint(event.newValue);
  });
  window.addEventListener('veto:screen-changed',()=>dock());
  window.addEventListener('resize',()=>{if(!menu.hidden)placeMenu()});
  window.VetoThemeDock=dock;
})();