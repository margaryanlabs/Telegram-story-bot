/* Vetogram Play native focus mode: move only built-in local game nodes into a dialog.
   No iframes, external scripts, API tokens, chat inspection or network calls. */
(() => {
  'use strict';
  const root=document.querySelector('.screen[data-screen="play"]');
  if(!root)return;
  const dialog=root.querySelector('#vpGameDialog');
  const mount=root.querySelector('#vpGameMount');
  const closeButton=root.querySelector('#vpGameClose');
  if(!dialog||!mount||!closeButton)return;
  const cards=Array.from(root.querySelectorAll('.vp-mini[data-vp-game]'));
  let active=null;
  let returningFocus=null;
  function recover() {
    if(!active)return;
    const {card,parent,next}=active;
    if(parent?.insertBefore)parent.insertBefore(card,next?.parentNode===parent?next:null);
    card.classList.remove('vp-game-in-dialog');
    active=null;
    if(root.classList?.contains('active'))returningFocus?.focus?.();
    returningFocus=null;
    document.body?.classList?.remove('vp-game-running');
  }
  function close() {
    if(!active)return;
    if(dialog.open && typeof dialog.close==='function') dialog.close();
    else {dialog.hidden=true;dialog.removeAttribute?.('open');recover();}
  }
  function open(card,button) {
    if(active)close();
    const parent=card.parentNode;
    if(!parent || typeof parent.insertBefore!=='function')return;
    returningFocus=button;
    active={card,parent,next:card.nextSibling};
    card.classList.add('vp-game-in-dialog');
    mount.appendChild(card);
    try {
      dialog.hidden=false;
      if(typeof dialog.showModal==='function')dialog.showModal();
      else dialog.setAttribute('open','');
      document.body?.classList?.add('vp-game-running');
      closeButton.focus?.();
    }catch{
      // Dialog unsupported or blocked: restore the game without corrupting the hub.
      dialog.hidden=true;
      recover();
    }
  }
  for(const card of cards){
    const button=document.createElement('button');
    button.type='button';
    button.className='vp-open-game';
    button.textContent='Играть →';
    button.setAttribute('aria-label','Играть в '+(card.querySelector('h3')?.textContent||'мини-игру'));
    button.addEventListener('click',()=>open(card,button));
    card.appendChild(button);
  }
  closeButton.addEventListener('click',close);
  dialog.addEventListener('close',recover);
  dialog.addEventListener('cancel',()=>{ /* Browser handles Escape and emits close. */ });
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)close();
  });
  window.addEventListener('veto:screen-changed',event=>{
    if(event?.detail?.screen!=='play')close();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && active && !dialog.showModal){close();}
  });
})();
