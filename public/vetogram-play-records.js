/* VETOGRAM 7.4: device-local game records, no Telegram identity access.
 * Reuses existing favorite/search/native modal instead of duplicating game UI.
 */
(() => {
  'use strict';
  const root=document.querySelector('.screen[data-screen="play"]');
  if(!root)return;
  const definitions=Object.freeze([
    {id:'reaction',node:'v74ScoreReaction',key:'vetogram:play:reaction-best:v1',positive:true},
    {id:'pairs',node:'v74ScorePairs',key:'vetogram:play:memory-best:v1',positive:true},
    {id:'tic',node:'v74ScoreTic',key:'vetogram:play:tic-wins:v1'},
    {id:'2048',node:'v74Score2048',key:'vetogram:play:2048-best:v1'},
    {id:'mines',node:'v74ScoreMines',key:'vetogram:play:mines-wins:v1'},
    {id:'snake',node:'v74ScoreSnake',key:'vetogram:play:snake-best:v1'}
  ]);
  const valid=new Set(definitions.map(item=>item.id));
  const store=()=>{try{return window.localStorage;}catch{return null;}};
  function display(item){
    let value=0;
    try{value=Number(store()?.getItem(item.key));}catch{value=0;}
    if(!Number.isFinite(value)||value<0)value=0;
    value=Math.floor(value);
    return item.positive&&value===0?'—':String(value);
  }
  function refresh(){
    for(const item of definitions){
      const el=root.querySelector('#'+item.node);
      if(el)el.textContent=display(item);
    }
  }
  function openGame(id){
    if(!valid.has(id))return;
    // V9 owns its own full-width focus and Back button. Avoid invoking the
    // old modal when this entrypoint comes from Surprise/records/deep links.
    if(typeof window.VetogramV9GameOpen==='function' &&
      window.VetogramV9GameOpen(id)===true)return;
    // Filters can hide the selected card. Clear them through the catalog's
    // existing event listener before using the original native game runner.
    const search=root.querySelector('#vpGameSearch');
    if(search)search.value='';
    root.querySelector('[data-vp-filter="all"]')?.click();
    const card=Array.from(root.querySelectorAll('.vp-mini[data-vp-game]'))
      .find(node=>node.dataset?.vpGame===id);
    if(card&&!card.hidden)card.querySelector('.vp-open-game')?.click();
  }
  root.querySelectorAll('[data-v74-launch]').forEach(button=>{
    if(!valid.has(button.dataset.v74Launch))return;
    button.addEventListener('click',()=>openGame(button.dataset.v74Launch));
  });
  // Surprise only chooses from the explicitly installed, playable local games.
  // It never routes to upcoming titles or remote games.
  root.querySelector('#v75SurpriseMe')?.addEventListener('click',()=>{
    const choices=definitions.map(item=>item.id);
    if(!choices.length)return;
    const index=Math.floor(Math.random()*choices.length);
    openGame(choices[Math.min(index,choices.length-1)]);
  });
  window.addEventListener?.('vetogram:game-close',refresh);
  window.addEventListener?.('veto:screen-changed',event=>{
    if(event?.detail?.screen==='play')refresh();
  });
  window.addEventListener?.('storage',refresh);
  window.addEventListener?.('focus',refresh);
  refresh();
})();
