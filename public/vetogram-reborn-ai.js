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
  new MutationObserver(sync).observe(conversation,{childList:true});
  sync();
})();