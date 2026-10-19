(() => {
  'use strict';
  const tg = window.Telegram?.WebApp;
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const state = {
    owner:String(tg?.initData || ''), contacts:[],viewMode:null,
    loadedAt:0,busy:false,lastError:null,epoch:0,activePeer:-1,activeStory:-1,
    url:null,autoTimer:null,mediaBusy:false,partial:false,
    favorites:new Set(),seen:new Set(),query:'',onlyFavorites:false,priorFocus:null,
  };
  const bar = document.createElement('section');
  bar.className = 'veto-story-strip';
  bar.setAttribute('aria-label','Истории контактов Telegram');
  const root = $('telegramChatsView');
  const heading = root?.querySelector('.veto-mirror-heading');
  if (!root || !heading) return;
  heading.insertAdjacentElement('afterend',bar);

  const viewer = document.createElement('div');
  viewer.className = 'veto-story-viewer';
  viewer.id = 'vetoContactStoryViewer';
  viewer.hidden = true;
  viewer.setAttribute('role','dialog');
  viewer.setAttribute('aria-modal','true');
  viewer.setAttribute('aria-label','Просмотр истории Telegram');
  document.body.appendChild(viewer);

  function initials(value) {
    return String(value || 'TG').trim().split(/\s+/).filter(Boolean)
      .slice(0,2).map(piece => piece[0]).join('').toUpperCase();
  }
  function formatTime(epoch) {
    if (!epoch) return '';
    return new Date(epoch * 1000).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
  }
  function hideMedia() {
    if (state.autoTimer) clearTimeout(state.autoTimer);
    state.autoTimer = null;
    viewer.querySelectorAll('video').forEach(video => { try { video.pause(); } catch {} });
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = null;
  }
  function closeViewer() {
    state.epoch++;
    hideMedia();
    state.mediaBusy = false;
    state.activePeer = -1;state.activeStory = -1;
    viewer.hidden = true;
    viewer.replaceChildren();
    document.body.classList.remove('veto-stories-open');
    const previous = state.priorFocus;
    state.priorFocus = null;
    if (previous?.isConnected) previous.focus({preventScroll:true});
  }
  function resetOwner() {
    const current = String(tg?.initData || '');
    if (current === state.owner) return false;
    closeViewer();
    state.owner = current;state.contacts = [];state.viewMode = null;
    state.loadedAt = 0;state.partial = false;state.lastError = null;
    // Personal contact preferences are volatile: never save Telegram identities on device.
    state.favorites.clear();state.seen.clear();state.query='';state.onlyFavorites=false;
    bar.classList.remove('expanded');
    renderBar();
    return true;
  }
  async function call(action,payload={},wantMedia=false) {
    resetOwner();
    const owner = String(tg?.initData || '');
    if (!owner) throw new Error('Открой VETO через Telegram и подключи личный аккаунт.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),35000);
    try {
      const response = await fetch('/api/telegram-stories',{
        method:'POST',headers:{
          'Content-Type':'application/json','X-Telegram-Init-Data':owner,
        },
        body:JSON.stringify({action,...payload}),signal:controller.signal,
      });
      if (owner !== String(tg?.initData || '')) {
        resetOwner();throw new Error('Telegram-аккаунт изменился. Просмотр закрыт.');
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'История недоступна. Просмотр заблокирован.');
      }
      if (!wantMedia) return response.json();
      const kind = response.headers.get('content-type') || '';
      if (!/^image\/jpeg|^video\/(mp4|webm)/i.test(kind))
        throw new Error('Telegram вернул неподдерживаемое медиа.');
      // Reject unexpected/old backends instead of silently falling back to
      // normal story viewing. The server must use the no-view-receipt path.
      if (response.headers.get('x-veto-story-mode') !== 'ghost-no-receipt')
        throw new Error('VETO не подтвердил Ghost View. Просмотр заблокирован.');
      const blob = await response.blob();
      if (blob.size > 4*1024*1024 || !blob.size)
        throw new Error('Этот файл слишком большой для просмотра.');
      return {blob,kind};
    } catch(error) {
      if (error?.name === 'AbortError') throw new Error('Telegram не ответил. Просмотр не был открыт.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function statusText() {
    if (state.lastError) return 'Не удалось обновить · нажми ↻';
    return state.viewMode==='ghost-no-receipt'
      ? 'Ghost View · без отметок о просмотре'
      : 'Проверяю Ghost View…';
  }
  function syncKnownContactAvatars() {
    const list = $('telegramMirrorList');
    if (!list) return;
    const known = new Map();
    for (const item of list.querySelectorAll('[data-veto-avatar]')) {
      const picture = item.querySelector('img');
      if (picture?.src) known.set(String(item.dataset.vetoAvatar),picture.src);
    }
    for (const button of bar.querySelectorAll('[data-veto-story-person]')) {
      const index = Number(button.dataset.vetoStoryPerson);
      const face = button.querySelector('.veto-story-face');
      const src = known.get(state.contacts[index]?.userId);
      if (!face || !src || face.querySelector('img')?.src === src) continue;
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.className = 'veto-story-contact-photo';
      face.replaceChildren(image);
    }
  }
  function storyOrder() {
    const query = state.query.trim().toLocaleLowerCase('ru');
    return state.contacts.map((person,index)=>({person,index}))
      .filter(({person})=>{
        if (state.onlyFavorites && !state.favorites.has(String(person.userId))) return false;
        const label=(String(person.name||'')+' '+String(person.username||'')).toLocaleLowerCase('ru');
        return !query || label.includes(query);
      })
      .sort((a,b)=>
        Number(state.favorites.has(String(b.person.userId))) -
        Number(state.favorites.has(String(a.person.userId))) || a.index-b.index)
      .map(({index})=>index);
  }
  function toggleFavorite(userId) {
    const id = String(userId);
    const person = state.contacts.find(item=>String(item.userId)===id);
    if (!person) return;
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    renderBar();
    const pin = viewer.querySelector('[data-veto-story-favorite]');
    if (pin && String(pin.dataset.vetoStoryFavorite)===id) {
      const favorite=state.favorites.has(id);
      pin.textContent=favorite?'★':'☆';
      pin.setAttribute('aria-pressed',String(favorite));
      pin.setAttribute('aria-label',(favorite?'Убрать из избранного: ':'В избранное: ')+person.name);
    }
  }
  function renderBar() {
    if (!state.owner) {
      bar.innerHTML='<span class="veto-story-status">Подключи Telegram, чтобы увидеть истории</span>';
      return;
    }
    const expanded=bar.classList.contains('expanded');
    const indices=storyOrder();
    const shown=expanded?indices:indices.slice(0,32);
    const cards=shown.map(index=>{
      const person=state.contacts[index],id=String(person.userId);
      const favorite=state.favorites.has(id);
      const viewed=person.stories?.length && person.stories.every(story=>
        state.seen.has(id+':'+story.id));
      return '<span class="veto-story-contact-shell'+(favorite?' is-favorite':'')+'">'+
        '<button type="button" class="veto-story-person'+(viewed?' is-viewed':'')+
        '" data-veto-story-person="'+index+'" aria-label="Истории: '+safe(person.name)+'">'+
        '<span class="veto-story-ring"><span class="veto-story-face">'+safe(initials(person.name))+
        '</span></span><small>'+safe(person.name.split(' ')[0])+'</small></button>'+
        (expanded?'<button type="button" class="veto-story-pin" data-veto-story-favorite="'+safe(id)+
        '" aria-pressed="'+String(favorite)+'" aria-label="'+
        (favorite?'Убрать из избранного: ':'В избранное: ')+safe(person.name)+
        '" title="Избранное в этом сеансе">'+(favorite?'★':'☆')+'</button>':'')+
        '</span>';
    }).join('');
    const status=state.viewMode==='ghost-no-receipt'?'◈ ':'◌ ';
    bar.innerHTML=
      '<div class="veto-story-strip-heading"><strong>Истории</strong>'+
      '<span class="veto-story-status">'+status+safe(statusText())+'</span>'+
      '<button type="button" class="veto-story-tools-toggle" data-veto-story-expand="1" '+
      'aria-expanded="'+String(expanded)+'" aria-label="'+
      (expanded?'Закрыть поиск историй':'Открыть поиск и избранные истории')+'">'+
      (expanded?'Готово':'Найти')+'</button>'+
      '<button type="button" class="veto-story-refresh" data-veto-story-refresh="1" '+
      'aria-label="Обновить истории">↻</button></div>'+
      (expanded?'<div class="veto-story-tools">'+
        '<input type="search" data-veto-story-search="1" value="'+safe(state.query)+
        '" placeholder="Имя или @username" autocomplete="off" aria-label="Найти истории контакта">'+
        '<button type="button" data-veto-story-only-favorites="1" aria-pressed="'+
        String(state.onlyFavorites)+'" class="'+(state.onlyFavorites?'active':'')+'">★ Избранные</button>'+
        '</div>':'')+
      '<div class="veto-story-people"><button type="button" class="veto-story-person" '+
      'data-veto-story-publish="1" aria-label="Опубликовать свою историю">'+
      '<span class="veto-story-ring is-mine"><span class="veto-story-face">＋</span></span>'+
      '<small>Моя</small></button>'+cards+'</div>'+
      (expanded?'<p class="veto-story-session-hint">★ Избранное и просмотрено — только в этом сеансе VETO.</p>':'')+
      (state.busy?'<p class="veto-story-note">Загружаю доступные истории контактов…</p>':
      state.lastError?'<p class="veto-story-note" role="status">'+safe(state.lastError)+'</p>':
      expanded && !shown.length && state.contacts.length
        ?'<p class="veto-story-note">По этому запросу историй нет. Измени фильтр.</p>':
      state.contacts.length===0 && state.loadedAt
        ?'<p class="veto-story-note">Сейчас нет доступных активных историй контактов.</p>':
      state.partial?'<p class="veto-story-note">Показана доступная часть ленты Telegram.</p>':'');
    syncKnownContactAvatars();
  }
  async function loadStories(force=false) {
    resetOwner();
    if (!state.owner || state.busy || (!force && Date.now()-state.loadedAt<60000)) return;
    const epoch = ++state.epoch,owner = state.owner;
    state.busy = true;renderBar();
    try {
      const data = await call('list');
      if (epoch!==state.epoch || owner!==state.owner)return;
      if (data.viewMode !== 'ghost-no-receipt')
        throw new Error('Сервер не подтвердил безопасный Ghost View.');
      state.contacts = Array.isArray(data.contacts) ? data.contacts : [];
      state.viewMode = data.viewMode;
      state.loadedAt = Date.now();
      state.partial = Boolean(data.partial);state.lastError = null;
    } catch(error) {
      if (epoch!==state.epoch)return;
      state.contacts = [];state.loadedAt = 0;
      state.lastError = String(error.message || 'Telegram не ответил.').slice(0,170);
    } finally {
      if (epoch===state.epoch) {state.busy=false;renderBar();}
    }
  }
  function renderViewerShell() {
    const contact = state.contacts[state.activePeer];
    const stories = contact?.stories || [];
    const story = stories[state.activeStory];
    if (!contact || !story) return;
    viewer.hidden = false;
    document.body.classList.add('veto-stories-open');
    viewer.innerHTML =
      '<div class="veto-story-stage">'+
      '<div class="veto-story-progress">'+stories.map((_,i)=>
        '<span class="'+(i<state.activeStory?'completed':i===state.activeStory?'current':'')+'"></span>').join('')+
      '</div>'+
      '<div class="veto-story-stage-head"><span class="veto-story-stage-avatar">'+
      safe(initials(contact.name))+'</span><div><strong>'+safe(contact.name)+'</strong>'+
      '<small>'+safe(formatTime(story.createdAt))+' · Telegram</small></div>'+
      '<span class="veto-story-protection">◈ Ghost View</span>'+ 
      '<button type="button" class="veto-story-stage-pin" data-veto-story-favorite="'+safe(contact.userId)+'" '+
      'aria-pressed="'+String(state.favorites.has(String(contact.userId)))+'" aria-label="'+
      (state.favorites.has(String(contact.userId))?'Убрать из избранного: ':'В избранное: ')+safe(contact.name)+'">'+
      (state.favorites.has(String(contact.userId))?'★':'☆')+'</button>'+
      '<button type="button" class="veto-story-close" data-veto-story-close="1" aria-label="Закрыть">×</button></div>'+
      '<div class="veto-story-media" id="vetoStoryMedia"><div class="veto-story-spinner"></div>'+
      '<span>Загружаю историю без отметки о просмотре…</span></div>'+
      '<button class="veto-story-skip previous" data-veto-story-back="1" aria-label="Предыдущая история"></button>'+
      '<button class="veto-story-skip next" data-veto-story-next="1" aria-label="Следующая история"></button>'+
      '<p class="veto-story-caption">'+safe(story.caption||'')+'</p>'+
      '</div>';
  }
  function viewerError(message) {
    const area = $('vetoStoryMedia');
    if (!area) return;
    area.innerHTML = '<div class="veto-story-blocked"><span>◈</span><strong>Просмотр заблокирован</strong>'+
      '<p>'+safe(message)+'</p>'+
      '<button type="button" data-veto-story-close="1">Закрыть</button></div>';
    const caption = viewer.querySelector('.veto-story-caption');
    if (caption) caption.textContent='';
  }
  async function openStory(peerIndex,storyIndex=0) {
    if (resetOwner() || state.mediaBusy) return;
    const person = state.contacts[peerIndex],story=person?.stories?.[storyIndex];
    if (!story) return;
    if (viewer.hidden) state.priorFocus=document.activeElement;
    hideMedia();
    state.activePeer = peerIndex;
    state.activeStory = storyIndex;
    const epoch = ++state.epoch, owner=state.owner;
    renderViewerShell();
    if (state.priorFocus) viewer.querySelector('.veto-story-close')?.focus({preventScroll:true});
    state.mediaBusy = true;
    try {
      const data = await call('media',{userId:person.userId,storyId:story.id},true);
      if (epoch!==state.epoch || owner!==state.owner || viewer.hidden) return;
      state.url = URL.createObjectURL(data.blob);
      const area = $('vetoStoryMedia');
      if (!area) return;
      area.replaceChildren();
      const media = document.createElement(data.kind.startsWith('video/')?'video':'img');
      media.src=state.url;media.className='veto-story-display';
      if (media.tagName === 'VIDEO') {
        media.controls=true;media.playsInline=true;media.autoplay=true;
        media.addEventListener('ended',()=>navigate(1),{once:true});
        media.play().catch(()=>{});
      } else {
        media.alt='История '+person.name;
        state.autoTimer = setTimeout(()=>navigate(1),7000);
      }
      area.appendChild(media);
      // This is VETO-local feedback, not a Telegram read receipt.
      state.seen.add(String(person.userId)+':'+story.id);
      renderBar();
    } catch(error) {
      if (epoch===state.epoch && owner===state.owner) viewerError(error.message);
    } finally {
      if (epoch===state.epoch) state.mediaBusy=false;
    }
  }
  function navigate(step) {
    if (viewer.hidden || state.mediaBusy) return;
    const current = state.contacts[state.activePeer];
    const nextStory = state.activeStory + step;
    if (nextStory >= 0 && nextStory < (current?.stories?.length||0)) {
      openStory(state.activePeer,nextStory);return;
    }
    const order=storyOrder();
    const position=order.indexOf(state.activePeer);
    const nextPeer=order[position+step];
    if (position>=0 && nextPeer!==undefined) {
      const stories=state.contacts[nextPeer].stories;
      openStory(nextPeer,step>0?0:stories.length-1);
    } else closeViewer();
  }
  bar.addEventListener('click',event=>{
    const button = event.target.closest('button');
    if (!button)return;
    if (button.hasAttribute('data-veto-story-publish')) {
      window.VetoTelegramNavigate?.('publish');return;
    }
    if (button.hasAttribute('data-veto-story-refresh')) {void loadStories(true);return;}
    if (button.hasAttribute('data-veto-story-favorite')) {toggleFavorite(button.dataset.vetoStoryFavorite);return;}
    if (button.hasAttribute('data-veto-story-only-favorites')) {
      state.onlyFavorites=!state.onlyFavorites;renderBar();return;
    }
    if (button.hasAttribute('data-veto-story-expand')) {
      const opened=bar.classList.toggle('expanded');
      if (!opened) {state.query='';state.onlyFavorites=false;}
      renderBar();
      if (opened) bar.querySelector('[data-veto-story-search]')?.focus({preventScroll:true});
      return;
    }
    if (button.hasAttribute('data-veto-story-person')) {
      const index=Number(button.dataset.vetoStoryPerson);
      if (Number.isInteger(index)) void openStory(index);
    }
  });
  bar.addEventListener('input',event=>{
    if (!event.target.matches('[data-veto-story-search]')) return;
    const caret=event.target.selectionStart;
    state.query=event.target.value.slice(0,100);
    renderBar();
    const input=bar.querySelector('[data-veto-story-search]');
    input?.focus({preventScroll:true});
    if (caret!==null) input?.setSelectionRange(caret,caret);
  });
  viewer.addEventListener('click',event=>{
    const favorite=event.target.closest('[data-veto-story-favorite]');
    if (favorite) {toggleFavorite(favorite.dataset.vetoStoryFavorite);return;}
    if (event.target.closest('[data-veto-story-close]')) {closeViewer();return;}
    if (event.target.closest('[data-veto-story-back]')) {navigate(-1);return;}
    if (event.target.closest('[data-veto-story-next]')) navigate(1);
  });
  let swipeStart=null;
  viewer.addEventListener('touchstart',event=>{
    swipeStart=null;
    if (viewer.hidden || event.touches.length!==1 || event.target?.closest?.('video,button')) return;
    swipeStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  viewer.addEventListener('touchend',event=>{
    if (!swipeStart || viewer.hidden || state.mediaBusy || event.changedTouches.length!==1) return;
    const dx=event.changedTouches[0].clientX-swipeStart.x;
    const dy=event.changedTouches[0].clientY-swipeStart.y;
    swipeStart=null;
    if (Math.abs(dx)>65 && Math.abs(dy)<75) navigate(dx<0?1:-1);
    else if (dy>105 && Math.abs(dx)<65) closeViewer();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if (viewer.hidden)return;
    if (event.key==='Escape') closeViewer();
    if (event.key==='ArrowRight') navigate(1);
    if (event.key==='ArrowLeft') navigate(-1);
  });
  window.addEventListener('veto:screen-changed',event=>{
    resetOwner();
    if (event.detail?.screen==='telegram')void loadStories();
    else closeViewer();
  });
  window.addEventListener('pageshow',resetOwner);
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) {
      // Never leave private media playing in the background.
      closeViewer();
    } else resetOwner();
  });
  if (typeof MutationObserver !== 'undefined' && $('telegramMirrorList')) {
    const watcher = new MutationObserver(()=>syncKnownContactAvatars());
    watcher.observe($('telegramMirrorList'),{subtree:true,childList:true});
  }
  renderBar();
  if (document.querySelector('.screen.active')?.dataset.screen === 'telegram')
    void loadStories();
})();
