(() => {
  'use strict';
  // Appearance is a non-sensitive preference only. No chat, Telegram ID,
  // message body, initData, permission or session is ever persisted here.
  const root=document.getElementById('telegramMirror');
  const panel=document.getElementById('telegramChatThemes');
  if(!root||!panel)return;
  const KEY='veto-chat-appearance-v1';
  const allowed=new Set(['graphite','pearl','slate','linen']);
  const normalize=value=>allowed.has(value)?value:'graphite';
  function paint(value){
    const theme=normalize(value);
    root.dataset.chatTheme=theme;
    panel.querySelectorAll('[data-chat-theme-option]').forEach(button=>{
      const selected=button.dataset.chatThemeOption===theme;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
      button.setAttribute('aria-label',(selected?'Выбрано: ':'Оформление: ')+button.textContent.trim());
    });
  }
  let saved='graphite';
  try{saved=window.localStorage.getItem(KEY)||saved;}catch{}
  paint(saved);
  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-chat-theme-option]');
    if(!button||!panel.contains(button))return;
    const theme=normalize(button.dataset.chatThemeOption);
    paint(theme);
    try{window.localStorage.setItem(KEY,theme);}catch{}
    try{window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();}catch{}
  });
  window.addEventListener('storage',event=>{
    if(event.key===KEY)paint(event.newValue);
  });
})();
