/* VETOGRAM 2026 · global command palette
   Navigation only: does not read chat contents, start AI requests or
   silently request Telegram permissions. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const dialog=$('vg26CommandDialog');
  const trigger=$('vg26CommandOpen');
  const input=$('vg26CommandSearch');
  const empty=$('vg26CommandEmpty');
  if(!dialog||!trigger||!input)return;

  const items=Array.from(dialog.querySelectorAll('[data-vg26-destination]'));
  let returnFocus=null;
  function applyFilter(){
    const term=input.value.toLocaleLowerCase('ru').trim();
    let shown=0;
    for(const button of items){
      const haystack=((button.textContent||'')+' '+(button.dataset.vg26Keywords||''))
        .toLocaleLowerCase('ru');
      button.hidden=!haystack.includes(term);
      if(!button.hidden)shown++;
    }
    if(empty)empty.hidden=shown!==0;
  }
  function close(){
    if(dialog.open)dialog.close();
    if(returnFocus&&typeof returnFocus.focus==='function')returnFocus.focus();
  }
  function open(){
    if(dialog.open)return;
    returnFocus=document.activeElement;
    input.value='';
    applyFilter();
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    input.focus();
  }
  function navigate(screen){
    if(!/^(telegram|home|publish|privacy|studio|creator|story-engine|ai|voice|viewers|chats|analytics|relay|archive)$/.test(screen))
      return false;
    if(typeof window.VetoTelegramNavigate==='function')
      return window.VetoTelegramNavigate(screen)!==false;
    const link=document.querySelector('[data-open-screen="'+screen+'"]');
    if(!link)return false;
    link.click();
    return true;
  }
  trigger.addEventListener('click',open);
  $('vg26CommandClose')?.addEventListener('click',close);
  input.addEventListener('input',applyFilter);
  input.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    const first=items.find(el=>!el.hidden&&!el.disabled);
    if(!first)return;
    event.preventDefault();
    first.click();
  });
  for(const button of items){
    button.addEventListener('click',()=>{
      const destination=button.dataset.vg26Destination;
      if(destination==='connect'){
        if(typeof window.VetoTelegramOpenAccountConnection==='function'){
          close();
          // An explicit user click is required. No implicit login/connection.
          void window.VetoTelegramOpenAccountConnection();
        }
        return;
      }
      if(navigate(destination))close();
    });
  }
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented)return;
    const tag=event.target?.tagName?.toLowerCase();
    const typing=tag==='input'||tag==='textarea'||event.target?.isContentEditable;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      dialog.open?close():open();
    }else if(event.key==='Escape'&&dialog.open){
      event.preventDefault();close();
    }else if(!typing&&event.key==='/'&&!dialog.open&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      event.preventDefault();open();
    }
  });
  window.VetogramCommand2026={open,close};
})();
