import {CREATIVE_PRESETS,buildCreativeDraft} from './vetogram-creative-presets-core.js';

/* Progressive enhancement: short creative briefs for a REAL user's existing
 * VETO AI editor. Presets NEVER submit, request consent, read chats, or send.
 */
(()=>{
  const $=id=>document.getElementById(id);
  const root=$('vg26CreativeDeck'),list=$('vg26CreativeOptions'),
    feedback=$('vg26CreativeFeedback'),title=$('vg26CreativeTitle'),input=$('vtaiText');
  if(!root||!list||!input||!feedback)return;
  const modes=Array.from(document.querySelectorAll('[data-vtai-mode]'));
  let lastMode=null,original='',generated='';
  function currentMode(){
    const selected=modes.find(el=>el.getAttribute('aria-pressed')==='true'||el.classList.contains('active'));
    return selected?.dataset.vtaiMode||'chat';
  }
  function onPreset(mode,id){
    if(currentMode()!==mode||!CREATIVE_PRESETS[mode])return;
    // A second preset replaces only the instruction WE inserted. Edits made
    // after that are preserved as user text, not discarded behind the scenes.
    const existing=input.value===generated?original:input.value;
    const result=buildCreativeDraft(mode,id,existing,input.maxLength>0?input.maxLength:3000);
    if(!result.ok){
      feedback.textContent=result.reason==='too-long'
        ?'Текущий текст слишком длинный для добавления стиля. Сократи его вручную.'
        :'Этот стиль недоступен.';
      return;
    }
    original=existing;
    generated=result.value;
    input.value=generated;
    // Native 'input' does NOT fire when value is set programmatically.
    // Notify any existing optional live word counters without creating requests.
    input.dispatchEvent(new Event('input',{bubbles:true}));
    feedback.textContent='Стиль добавлен в поле ниже. Проверь текст и нажми «Создать» только когда будешь готов.';
    input.focus({preventScroll:true});
  }
  function render(){
    const mode=currentMode();
    if(mode===lastMode)return;
    lastMode=mode;
    original='';generated='';
    const presets=CREATIVE_PRESETS[mode];
    root.hidden=!presets;
    list.replaceChildren();
    feedback.textContent='';
    if(!presets)return;
    title.textContent={
      reply:'Как ответить?',story:'Как выглядит твоя Story?',campaign:'Как подать предложение?'
    }[mode]||'Выбери подачу';
    for(const preset of presets){
      const button=document.createElement('button');
      button.type='button';button.className='vg26-creative-card';
      button.dataset.vg26Preset=preset.id;
      button.dataset.vg26PresetMode=mode;
      button.setAttribute('aria-label',preset.title+': '+preset.description);
      const icon=document.createElement('span');icon.className='vg26-creative-symbol';
      icon.textContent=preset.symbol;icon.setAttribute('aria-hidden','true');
      const texts=document.createElement('span');texts.className='vg26-creative-copy';
      const heading=document.createElement('strong');heading.textContent=preset.title;
      const desc=document.createElement('small');desc.textContent=preset.description;
      texts.append(heading,desc);
      const arrow=document.createElement('span');arrow.className='vg26-creative-arrow';
      arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
      button.append(icon,texts,arrow);
      button.addEventListener('click',()=>onPreset(mode,preset.id));
      list.append(button);
    }
  }
  if(typeof MutationObserver==='function'){
    const observer=new MutationObserver(render);
    for(const b of modes)observer.observe(b,{attributes:true,attributeFilter:['aria-pressed','class']});
  }
  render();
})();
