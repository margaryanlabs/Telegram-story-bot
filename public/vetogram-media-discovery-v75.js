/* VETOGRAM 7.5 / Discovery.
 * One search entrypoint routes the query into the selected existing media
 * module, without indexing chats, pretending to fetch results or storing text.
 */
(() => {
  'use strict';
  const root=document.querySelector('.screen[data-screen="media"]');
  const form=root?.querySelector('#v75ExploreForm');
  if(!root||!form)return;
  const input=root.querySelector('#v75ExploreQuery');
  const help=root.querySelector('#v75ExploreHelp');
  const allow=new Set(['music','cinema','books']);
  let lastTarget='music';
  const clean=value=>String(value??'')
    .replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
  function open(kind){
    if(!allow.has(kind))return;
    const q=clean(input?.value);
    if(q.length===1){
      if(help)help.textContent='Введи хотя бы две буквы или оставь поле пустым, чтобы открыть каталог.';
      input?.focus?.();return;
    }
    const api=window.VetogramUniverse;
    if(typeof api?.open!=='function'){
      if(help)help.textContent='Медиакаталог пока загружается. Повтори попытку.';
      return;
    }
    // This existing bridge performs search only within the selected provider.
    // It handles unavailable streams and licensed catalog items itself.
    api.open(kind,'search',null,q.length>=2?q:'');
    if(help)help.textContent=q?'Открываем '+({music:'музыкальный',cinema:'кино',books:'книжный'})[kind]+' каталог с поиском.':'Открываем каталог. Выбери доступный материал.';
  }
  form.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-v75-target]');
    if(button&&allow.has(button.dataset.v75Target))lastTarget=button.dataset.v75Target;
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const chosen=event.submitter?.dataset?.v75Target;
    open(allow.has(chosen)?chosen:lastTarget);
  });
})();
