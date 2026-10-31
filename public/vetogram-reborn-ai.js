/* REBORN: conversation-first AI shortcuts. Local draft only, never AI/network. */
(() => {
  'use strict';
  const root=document.getElementById('vtaiRoot');
  const starters=document.getElementById('vetoRebornAiStarters');
  const conversation=document.getElementById('vtaiThread');
  const input=document.getElementById('vtaiText');
  if(!root||!starters||!conversation||!input)return;
  function sync(){
    // Suggestions disappear when the genuine AI thread has content.
    // Never store, duplicate or inspect private message text.
    starters.hidden=conversation.children.length>0;
  }
  starters.addEventListener('click',event=>{
    const item=event.target.closest('button[data-reborn-ai-prompt]');
    if(!item||!starters.contains(item))return;
    if(input.value.trim()){
      input.focus({preventScroll:false});return; // never overwrite authored text
    }
    const sample=String(item.dataset.rebornAiPrompt||'').trim().slice(0,300);
    if(!sample)return;
    root.querySelector('[data-vtai-mode="chat"]')?.click();
    input.value=sample;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.scrollIntoView({block:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});
    input.focus({preventScroll:true});
    // No click on vtaiCreate and no consent-checkbox mutation.
  });
  // Follow the *real* selected AI mode across the existing controller.
  // A mode badge is not a provider status and does not trigger any AI calls.
  const modes=root.querySelector('.vtai-modes');
  const modeHint=root.querySelector('.veto-reborn-ai-header small');
  const labels=Object.freeze({
    chat:'AI-чат',translate:'Перевод',reply:'Ответы AI',action:'Действия AI',
    brief:'Задачи',story:'Истории',campaign:'Продажи',negotiator:'Переговоры'
  });
  function syncModeHint(){
    if(!modes||!modeHint)return;
    const pressed=modes.querySelector('[data-vtai-mode][aria-pressed="true"]');
    const selected=pressed?.dataset.vtaiMode;
    modeHint.textContent=selected&&Object.hasOwn(labels,selected)
      ? labels[selected]:'Режим не выбран';
  }
  if(modes&&modeHint){
    new MutationObserver(syncModeHint).observe(modes,{
      subtree:true,attributes:true,attributeFilter:['aria-pressed']
    });
    syncModeHint();
  }
  new MutationObserver(sync).observe(conversation,{childList:true});
  sync();
})();