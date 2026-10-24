import {vetogramWorkflow,vetogramWorkflowResult} from './vetogram-workflow-core.js';

/* One-tap workflow launchers for existing, owner-scoped modules.
 * Every action requires a real user click. Never prefill private chats,
 * generate paid AI content, send messages, publish Stories, or change grants.
 */
(()=>{
  'use strict';
  const actions=Array.from(document.querySelectorAll('[data-vg30-flow]'));
  if(!actions.length)return;
  const status=document.getElementById('vg30FlowStatus');
  let current=null;
  const mark=(message,error=false)=>{
    if(!status)return;
    status.textContent=message;
    status.dataset.error=String(error);
  };
  function navigate(screen){
    if(typeof window.VetoTelegramNavigate==='function')
      return window.VetoTelegramNavigate(screen)!==false;
    const target=document.querySelector('[data-open-screen="'+screen+'"]')||
      document.querySelector('[data-nav="'+screen+'"]');
    if(!target||typeof target.click!=='function')return false;
    target.click();
    return Boolean(document.querySelector('.screen.active[data-screen="'+screen+'"]'));
  }
  for(const button of actions){
    button.addEventListener('click',()=>{
      const flow=vetogramWorkflow(button.dataset.vg30Flow);
      if(!flow)return mark('Этот сценарий пока недоступен.',true);
      // Navigate first; only after successful screen navigation change AI mode.
      const moved=navigate(flow.screen);
      let modeReady=true;
      if(moved&&flow.mode){
        const modeButton=document.querySelector('[data-vtai-mode="'+flow.mode+'"]');
        modeReady=Boolean(modeButton&&!modeButton.disabled);
        if(modeReady)modeButton.click(); // existing AI controller clears stale drafts
      }
      const outcome=vetogramWorkflowResult(flow,moved,modeReady);
      if(!outcome.ok)
        return mark('Не удалось открыть инструмент. Попробуй через меню.',true);
      current=button.dataset.vg30Flow;
      actions.forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.vg30Flow===current)));
      mark(flow.label+' открыт. Дальше всё под твоим контролем.');
    });
  }
})();
