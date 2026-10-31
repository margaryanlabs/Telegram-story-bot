/* Vetogram Play v1 catalog: audited local entries only. Not a remote execution registry. */
(() => {
  'use strict';
  const root = document.querySelector('.screen[data-screen="play"]');
  if (!root) return;
  const catalog = Object.freeze([
    Object.freeze({id:'blotenq', name:'BLOTENQ?', genre:'cards', kind:'external', tags:['блот','блотенк','բլոտ','armenian','карты','друзья','турнир']}),
    Object.freeze({id:'who', name:'WHO? / Group DNA', genre:'social', kind:'external', tags:['кто','друзья','анонимное','голосование','party']}),
    Object.freeze({id:'reaction', name:'Реакция', genre:'arcade', kind:'local', tags:['скорость','таймер','реакция','reflex']}),
    Object.freeze({id:'pairs', name:'Четыре пары', genre:'cards', kind:'local', tags:['память','карты','пары','memory']}),
    Object.freeze({id:'tic', name:'Крестики-нолики', genre:'strategy', kind:'local', tags:['х','о','крестики','бот','tic-tac-toe']}),
    Object.freeze({id:'2048', name:'2048', genre:'puzzle', kind:'local', tags:['числа','логика','головоломка','2048']}),
  ]);
  window.VetogramPlayCatalog = catalog;
  const elements = Array.from(root.querySelectorAll('[data-vp-game]'));
  const byId = new Map(catalog.map(item => [item.id,item]));
  const count = root.querySelector('#vpCatalogCount');
  const search = root.querySelector('#vpGameSearch');
  const empty = root.querySelector('#vpNoResults');
  const filters = Array.from(root.querySelectorAll('[data-vp-filter]'));
  let activeFilter='all';
  const FAV_KEY = 'vetogram:play:favorites:v1';
  const readFavorites = () => {
    try {
      const value = JSON.parse(window.localStorage?.getItem(FAV_KEY) || '[]');
      return new Set(Array.isArray(value) ? value.filter(id => byId.has(id)).slice(0, catalog.length) : []);
    } catch { return new Set(); }
  };
  const normalize = str => String(str||'').toLocaleLowerCase().replaceAll('ё','е').trim();
  function matches(item,query) {
    if(!query)return true;
    return normalize([item.name,...item.tags].join(' ')).includes(query);
  }
  function category(item,selected) {
    if(selected==='all') return true;
    if(selected==='offline') return item.kind==='local';
    if(selected==='online') return item.kind==='external';
    if(selected==='cards') return item.genre==='cards';
    if(selected==='favorites') return readFavorites().has(item.id);
    return false;
  }
  function update() {
    const q=normalize(search?.value);
    let visible=0;
    elements.forEach(card => {
      const game=byId.get(card.dataset.vpGame);
      const show=Boolean(game && category(game,activeFilter) && matches(game,q));
      card.hidden=!show;
      if(show)visible++;
    });
    if(empty)empty.hidden=visible!==0;
    if(count)count.textContent=q||activeFilter!=='all'?
      visible+' из '+catalog.length+' игр':
      catalog.filter(x=>x.kind==='local').length+' мини-игры · '+catalog.filter(x=>x.kind==='external').length+' клуба';
  }
  filters.forEach(button=>button.addEventListener('click',()=>{
    const filter=button.dataset.vpFilter;
    if(!['all','offline','online','cards','favorites'].includes(filter))return;
    activeFilter=filter;
    filters.forEach(item=>{
      const selected=item===button;
      item.classList.toggle('is-selected',selected);
      item.setAttribute('aria-pressed',String(selected));
    });
    update();
  }));
  window.addEventListener?.('vetogram:play-favorites-changed', update);
  search?.addEventListener('input',update);
  update();
})();
