/* Vetogram Play discovery: local favorites and user-initiated catalog sharing only.
   No chat access, untrusted game scripts, external code execution or background sharing. */
(() => {
  'use strict';
  const root = document.querySelector('.screen[data-screen="play"]');
  const catalog = window.VetogramPlayCatalog;
  if (!root || !Array.isArray(catalog)) return;
  const byId = new Map(catalog.map(game => [game.id,game]));
  const storageKey = 'vetogram:play:favorites:v1';
  const gameElements = Array.from(root.querySelectorAll('[data-vp-game]'));
  const sharePanel = root.querySelector('#vpSharePanel');
  const shareInput = root.querySelector('#vpShareUrl');
  const copyShare = root.querySelector('#vpCopyShare');
  const shareNotice = root.querySelector('#vpShareNotice');
  const closeShare = root.querySelector('#vpCloseShare');
  const status = root.querySelector('#vpStoreStatus');

  let favorites = new Set();
  try {
    const saved=JSON.parse(window.localStorage?.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) favorites=new Set(saved.filter(id=>byId.has(id)));
  } catch {}
  window.VetogramPlayFavorites = favorites;
  const message = value => { if (status) status.textContent=value; };
  const notify = () => {
    try {
      window.dispatchEvent?.(new CustomEvent('vetogram:play-favorites-changed'));
    } catch {}
  };
  function saveFavorites() {
    try { window.localStorage?.setItem(storageKey, JSON.stringify([...favorites])); } catch {
      message('Избранное работает до закрытия страницы: хранение недоступно.');
    }
    notify();
  }
  function linkFor(gameId) {
    if (!byId.has(gameId)) return null;
    const current=window.location;
    if (!current || !/^https?:$/.test(current.protocol) || !current.origin) return null;
    const url=new URL('/',current.origin);
    url.searchParams.set('screen','play');
    url.searchParams.set('game',gameId);
    return url.toString();
  }
  function showShare(url,name) {
    if(!sharePanel||!shareInput)return;
    shareInput.value=url;
    sharePanel.hidden=false;
    sharePanel.setAttribute('aria-label','Ссылка на игру '+name);
    if(shareNotice)shareNotice.textContent='Скопируй ссылку и отправь другу самостоятельно. Это не приглашение в онлайн-комнату.';
    shareInput.focus?.();
    shareInput.select?.();
  }
  async function copyText(value) {
    if(!value)return false;
    try{
      if (!window.navigator?.clipboard?.writeText) return false;
      await window.navigator.clipboard.writeText(value);
      return true;
    }catch{return false;}
  }
  async function shareGame(game) {
    const url=linkFor(game.id);
    if(!url){message('Ссылка появится, когда Vetogram будет доступен по HTTPS.');return;}
    if(window.navigator?.share) {
      try {
        await window.navigator.share({
          title:'Vetogram Play — '+game.name,
          text:'Посмотри игру '+game.name+' в Vetogram Play',
          url
        });
        message('Поделиться: выбранное приложение получило ссылку.');
        return;
      }catch(error) {
        if(error?.name==='AbortError')return;
      }
    }
    const copied=await copyText(url);
    if(copied){message('Ссылка на '+game.name+' скопирована.');return;}
    showShare(url,game.name);
  }
  function toolbar(game,card){
    const target=card.querySelector('.vp-feature-copy, .vp-who-copy') || card;
    const line=document.createElement('div');
    line.className='vp-store-actions';
    const fav=document.createElement('button');
    fav.type='button';
    fav.className='vp-store-fav';
    const renderFav=()=>{
      const selected=favorites.has(game.id);
      fav.textContent=selected?'★ В избранном':'☆ В избранное';
      fav.setAttribute('aria-pressed',String(selected));
      fav.setAttribute('aria-label',(selected?'Убрать из избранного: ':'Добавить в избранное: ')+game.name);
    };
    renderFav();
    fav.addEventListener('click',()=>{
      if(favorites.has(game.id))favorites.delete(game.id);
      else favorites.add(game.id);
      saveFavorites();
      renderFav();
      message((favorites.has(game.id)?'Сохранено: ':'Убрано: ')+game.name);
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); }catch{}
    });
    const share=document.createElement('button');
    share.type='button';
    share.className='vp-store-share';
    share.textContent='↗ Поделиться';
    share.setAttribute('aria-label','Поделиться ссылкой на игру '+game.name);
    share.addEventListener('click',()=>{void shareGame(game);});
    line.appendChild(fav);
    line.appendChild(share);
    target.appendChild(line);
  }
  gameElements.forEach(card=>{
    const game=byId.get(card.dataset.vpGame);
    if(game)toolbar(game,card);
  });
  copyShare?.addEventListener('click',async()=>{
    if(await copyText(shareInput?.value)) {
      if(shareNotice)shareNotice.textContent='Ссылка скопирована.';
    } else if(shareNotice) {
      shareNotice.textContent='Выдели ссылку в поле и скопируй вручную.';
      shareInput?.focus?.();shareInput?.select?.();
    }
  });
  closeShare?.addEventListener('click',()=>{if(sharePanel)sharePanel.hidden=true;});
  let incomingId=null;
  try { incomingId=new URLSearchParams(window.location?.search||'').get('game'); }catch{}
  if(incomingId && byId.has(incomingId)) {
    const selected=gameElements.find(x=>x.dataset.vpGame===incomingId);
    selected?.classList?.add('vp-incoming-target');
    message('По ссылке выбрана игра «'+byId.get(incomingId).name+'». Нажми на неё, чтобы играть.');
    window.addEventListener?.('veto:screen-changed',event=>{
      if(event?.detail?.screen==='play')selected?.scrollIntoView?.({behavior:'smooth',block:'center'});
    },{once:true});
  }
})();
