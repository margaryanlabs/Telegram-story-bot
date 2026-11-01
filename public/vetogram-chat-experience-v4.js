/* VETOGRAM V4 — contextual actions on real Telegram message elements.
   Presentation-only. Never auto-sends or accesses messages beyond the currently
   visible, owner-verified thread. User actions invoke existing local controllers. */
(() => {
  'use strict';
  const host = document.getElementById('telegramThreadMessages');
  if (!host || document.getElementById('v4MessageActions')) return;
  const $ = id => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  let selectedBubble = null, selectedInitData = '', selectedThreadKey = '';
  const activePointers = new Set();
  const threadKey = () => [
    host.dataset.mirrorOwnerId||'',host.dataset.mirrorThreadId||'',
    host.dataset.mirrorThreadGeneration||''
  ].join(':');
  let activePress = null, activeSwipe = null;
  const menu = document.createElement('dialog');
  menu.id = 'v4MessageActions';
  menu.className = 'v4-message-actions';
  menu.setAttribute('aria-label', 'Действия с сообщением');
  const panel = document.createElement('div');
  panel.className = 'v4-message-actions-panel';
  const header = document.createElement('div');
  header.className = 'v4-message-actions-heading';
  const title = document.createElement('strong');
  title.textContent = 'Сообщение';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'v4-message-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Закрыть действия');
  header.append(title, close);
  const excerpt = document.createElement('p');
  excerpt.className = 'v4-message-excerpt';
  const actions = document.createElement('div');
  actions.className = 'v4-message-actions-grid';
  const buttons = {};
  for (const [key,label] of [
    ['reply','↩ Ответить'],
    ['ai','✦ AI-ответ на это сообщение'],
    ['copy','⧉ Скопировать текст'],
    ['search','⌕ Найти в переписке'],
    ['archive','◈ Архив и защита']
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v4Action = key;
    button.textContent = label;
    actions.append(button);
    buttons[key] = button;
  }
  const feedback = document.createElement('div');
  feedback.className = 'v4-message-feedback';
  feedback.setAttribute('role','status');
  feedback.setAttribute('aria-live','polite');
  panel.append(header, excerpt, actions, feedback);
  menu.append(panel);
  document.body.append(menu);

  function clearSelection(){
    selectedBubble?.classList.remove('v4-message-selected');
    selectedBubble=null;
    selectedInitData='';
    selectedThreadKey='';
    excerpt.textContent='';
    feedback.textContent='';
  }
  // Native dialog close events can arrive after a new selection was opened.
  // Do not clear the newly selected bubble if that newer dialog is open.
  menu.addEventListener('close',()=>{if(!menu.open)clearSelection();});
  function dismiss(){ if(menu.open)menu.close(); else clearSelection(); }
  close.addEventListener('click',dismiss);
  menu.addEventListener('click',event=>{if(event.target===menu)dismiss();});
  window.addEventListener('veto:screen-changed',()=>{
    cancelGestures();dismiss();
  });
  window.addEventListener('pagehide',()=>{
    cancelGestures();dismiss();
  });
  function clearIfOwnerChanged(){
    const stale=menu.open && (!visibleOwner() || !selectedBubble?.isConnected ||
      tg?.initData!==selectedInitData || threadKey()!==selectedThreadKey);
    if(stale)dismiss();
    if(!visibleOwner())cancelGestures();
  }
  window.addEventListener('focus',clearIfOwnerChanged);
  document.addEventListener('visibilitychange',clearIfOwnerChanged);

  function visibleOwner(){
    const id=String(tg?.initDataUnsafe?.user?.id||'');
    return Boolean(tg?.initData && /^\d{1,20}$/.test(id) &&
      host.dataset.mirrorOwnerId===id &&
      host.dataset.mirrorThreadId && host.dataset.mirrorThreadGeneration &&
      document.querySelector('[data-screen="telegram"].active') &&
      $('telegramThreadView')?.hidden===false);
  }
  function messageText(node){
    // Text comes only from a real, currently rendered message. It is not
    // indexed, uploaded, saved or transferred to an AI provider.
    return String(node?.querySelector('.veto-mirror-bubble-inner > p')?.textContent||'').trim();
  }
  function openFor(bubble){
    if(!visibleOwner() || !bubble?.isConnected || !host.contains(bubble))return false;
    // Opening a native <dialog> can retarget the finger's eventual pointerup:
    // clear pointer tracking immediately, not just after the host receives it.
    cancelGestures();
    dismiss();
    selectedBubble=bubble;
    selectedInitData=tg.initData;
    selectedThreadKey=threadKey();
    const text=messageText(bubble);
    excerpt.textContent=text?text.slice(0,160):'Медиа или сохранённое сообщение';
    buttons.reply.disabled=!bubble.querySelector('[data-mirror-reply]');
    buttons.ai.disabled=!text||bubble.classList.contains('outgoing')||
      bubble.classList.contains('is-deleted')||
      !Number.isSafeInteger(Number(bubble.dataset.mirrorMessageId))||
      typeof window.VetoTelegramPrepareSelectedAiReply!=='function';
    buttons.copy.disabled=!text;
    buttons.search.disabled=!text;
    bubble.classList.add('v4-message-selected');
    if(typeof menu.showModal==='function')menu.showModal();
    else {dismiss();return false;}
    (buttons.reply.disabled?buttons.copy.disabled?buttons.archive:buttons.copy:buttons.reply).focus();
    try{tg?.HapticFeedback?.impactOccurred?.('light');}catch{}
    return true;
  }
  async function applyAction(action){
    if(!selectedBubble?.isConnected || !host.contains(selectedBubble) ||
        !visibleOwner() || tg.initData!==selectedInitData ||
        threadKey()!==selectedThreadKey){
      dismiss();return;
    }
    const bubble=selectedBubble;
    const text=messageText(bubble);
    if(action==='reply'){
      const existing=bubble.querySelector('[data-mirror-reply]');
      dismiss();
      // Delegate to the existing owner-scoped reply handler. No message is sent.
      existing?.click();
      return;
    }
    if(action==='ai'){
      const id=Number(bubble.dataset.mirrorMessageId);
      dismiss();
      if(Number.isSafeInteger(id)&&id>0)
        window.VetoTelegramPrepareSelectedAiReply?.(id);
      return;
    }
    if(action==='copy'){
      if(!text)return;
      try{
        if(!navigator.clipboard?.writeText)throw Error('CLIPBOARD_UNAVAILABLE');
        await navigator.clipboard.writeText(text);
        if(selectedBubble===bubble && selectedInitData===tg?.initData)
          feedback.textContent='Текст скопирован';
      }catch{
        if(selectedBubble===bubble)feedback.textContent='Не удалось скопировать. Выдели текст вручную.';
      }
      return;
    }
    if(action==='search'){
      if(!text)return;
      dismiss();
      const toggle=$('telegramThreadSearchToggle'),bar=$('telegramThreadFind');
      if(bar?.hidden)toggle?.click();
      const input=$('telegramThreadFindInput');
      if(input){
        input.value=text.slice(0,60);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.focus();
      }
      return;
    }
    if(action==='archive'){
      dismiss();
      window.VetoTelegramNavigate?.('privacy'); // existing real navigation
    }
  }
  actions.addEventListener('click',event=>{
    const button=event.target.closest('[data-v4-action]');
    if(button&&!button.disabled)void applyAction(button.dataset.v4Action);
  });

  const findBubble=event=>{
    const bubble=event.target.closest?.('[data-mirror-message-id]');
    if(!bubble||!host.contains(bubble))return null;
    if(event.target.closest?.('button,a,input,textarea,audio,video,select,[contenteditable="true"]'))return null;
    return bubble;
  };
  function cancelPress(){
    if(activePress?.timer)clearTimeout(activePress.timer);
    activePress=null;
  }
  function cancelSwipe(){
    if(activeSwipe?.bubble){
      activeSwipe.bubble.classList.remove('v4-swiping-reply');
      activeSwipe.bubble.style.removeProperty('--v4-swipe-reply-x');
    }
    activeSwipe=null;
  }
  function cancelGestures(){
    cancelPress();cancelSwipe();activePointers.clear();
  }
  host.addEventListener('pointerdown',event=>{
    cancelPress();cancelSwipe();
    if(event.pointerType==='mouse' && event.button!==0)return;
    activePointers.add(event.pointerId);
    // A two-finger scroll/pinch must never become a swipe-to-reply.
    if(activePointers.size>1){cancelSwipe();return;}
    const bubble=findBubble(event);
    if(!bubble||!visibleOwner())return;
    const signed=String(tg?.initData||''), boundThread=threadKey();
    activePress={bubble,pointerId:event.pointerId,x:event.clientX,y:event.clientY,
      timer:setTimeout(()=>{
        activePress=null;cancelSwipe();
        if(activePointers.size===1 && signed===String(tg?.initData||'') &&
          boundThread===threadKey() && visibleOwner() && bubble.isConnected)
          openFor(bubble);
      },480)};
    if(event.pointerType==='touch' || event.pointerType==='pen'){
      activeSwipe={bubble,pointerId:event.pointerId,x:event.clientX,y:event.clientY,
        signed,threadKey:boundThread};
    }
  });
  host.addEventListener('pointermove',event=>{
    if(activeSwipe?.pointerId===event.pointerId){
      const dx=event.clientX-activeSwipe.x,dy=event.clientY-activeSwipe.y;
      if(Math.abs(dy)>18 || dx < -14 ||
         activeSwipe.signed!==String(tg?.initData||'') ||
         activeSwipe.threadKey!==threadKey() || !visibleOwner()){
        cancelSwipe();
      }else if(dx>14 && activePointers.size===1){
        // Direct touch feedback from the actual bubble, with no saved data,
        // network call or trigger before a completed deliberate gesture.
        activeSwipe.bubble.classList.add('v4-swiping-reply');
        activeSwipe.bubble.style.setProperty('--v4-swipe-reply-x',
          Math.min(42,Math.round(dx*.45))+'px');
      }else{
        activeSwipe.bubble.classList.remove('v4-swiping-reply');
        activeSwipe.bubble.style.removeProperty('--v4-swipe-reply-x');
      }
    }
    if(!activePress||activePress.pointerId!==event.pointerId)return;
    if(Math.hypot(event.clientX-activePress.x,event.clientY-activePress.y)>12)cancelPress();
  },{passive:true});
  host.addEventListener('pointerup',event=>{
    const gesture=activeSwipe;
    const singlePointer=activePointers.size===1 && activePointers.has(event.pointerId);
    activePointers.delete(event.pointerId);
    const dx=gesture?event.clientX-gesture.x:0;
    const dy=gesture?event.clientY-gesture.y:0;
    if(singlePointer && gesture && gesture.pointerId===event.pointerId &&
        dx>72 && Math.abs(dy)<40 && Math.abs(dx)>2*Math.abs(dy) &&
        gesture.signed && gesture.signed===String(tg?.initData||'') &&
        gesture.threadKey===threadKey() &&
        visibleOwner() && gesture.bubble.isConnected && host.contains(gesture.bubble)){
      // A right swipe means "reply", never "send". The existing composer
      // decides whether this message and owner may actually be replied to.
      gesture.bubble.querySelector('[data-mirror-reply]')?.click();
      try{tg?.HapticFeedback?.selectionChanged?.();}catch{}
    }
    cancelSwipe();cancelPress();
  },{passive:true});
  for(const event of ['pointercancel','pointerleave']){
    host.addEventListener(event,eventData=>{
      activePointers.delete(eventData.pointerId);
      cancelPress();cancelSwipe();
    },{passive:true});
  }
  host.addEventListener('scroll',()=>{cancelPress();cancelSwipe();},{passive:true});
  host.addEventListener('contextmenu',event=>{
    const bubble=findBubble(event);
    if(!bubble||!visibleOwner())return;
    event.preventDefault();
    cancelPress();
    openFor(bubble);
  });
  host.addEventListener('keydown',event=>{
    if(event.key!=='ContextMenu' && !(event.shiftKey&&event.key==='F10'))return;
    const bubble=findBubble(event);
    if(!bubble)return;
    event.preventDefault();
    openFor(bubble);
  });
  // Messages are replaced by the chat controller on pagination / sync.
  // Reattach keyboard affordances without touching the original source data.
  function prepareMessages(){
    for(const bubble of host.querySelectorAll('[data-mirror-message-id]:not([data-v4-message-ready])')){
      bubble.dataset.v4MessageReady='1';
      bubble.tabIndex=0;
      bubble.setAttribute('aria-keyshortcuts','Shift+F10 ContextMenu');
      bubble.title='Долгое нажатие — действия; свайп вправо — ответ';
    }
    if(menu.open && selectedBubble &&
      (!selectedBubble.isConnected || !visibleOwner() ||
        tg?.initData!==selectedInitData || threadKey()!==selectedThreadKey))dismiss();
  }
  // Changing between threads can update only host dataset attributes, and
  // pressing Back only hides the thread. A childList-only observer misses both.
  const monitor=new MutationObserver(()=>{
    prepareMessages();
    clearIfOwnerChanged();
  });
  monitor.observe(host,{
    childList:true,subtree:true,attributes:true,
    attributeFilter:['data-mirror-owner-id','data-mirror-thread-id',
      'data-mirror-thread-generation']
  });
  const threadView=$('telegramThreadView');
  if(threadView)monitor.observe(threadView,{
    attributes:true,attributeFilter:['hidden']
  });
  prepareMessages();
})();
