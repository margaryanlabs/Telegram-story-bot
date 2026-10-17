(() => {
  'use strict';
  const tg=window.Telegram?.WebApp;
  const $=id=>document.getElementById(id);
  const state={
    chats:[],page:0,hasMore:true,loading:false,
    filter:'all',search:'',generation:0,lastSyncedAt:0,syncMs:0,autoPages:0,stale:false,
    cacheOwnerId:'',cachedPreview:false,cacheDenied:false,cacheVerifyBusy:false,
    searchGeneration:0,
    thread:null,messages:[],threadLoading:false,
    threadHasMore:false,threadOffset:0,archiveHasMore:false,archiveOffset:0,liveHasMore:false,threadGeneration:0,
    connectionProof:null,ownerInitData:String(tg?.initData||''),mediaUrls:[],avatarUrls:new Map(),mediaPreviewUrls:new Map(),avatarQueue:[],avatarRequested:new Set(),avatarActive:0,avatarLoaded:0,avatarScheduled:false,
    previewActive:0,previewSeen:new Set(),
  };
  const labels={
    private:'личный чат',group:'группа',channel:'канал',bot:'бот',
    saved:'избранное',copy:'сохранённая копия VETO',other:'чат',
  };
  const mediaLabels={
    photo:'▣ Фотография',video:'▹ Видео',audio:'♫ Аудио',
    document:'◫ Документ',voice:'◉ Голосовое',video_note:'◉ Видеосообщение',
    location:'⌖ Локация',contact:'◈ Контакт',link:'↗ Ссылка',
    attachment:'◫ Вложение',
  };
  const safe=v=>String(v??'')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const two=n=>String(n).padStart(2,'0');
  function time(value){
    if(!value)return '';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    const now=new Date();
    if(date.toDateString()===now.toDateString())return two(date.getHours())+':'+two(date.getMinutes());
    if(now.getTime()-date.getTime()<6*86400000)
      return date.toLocaleDateString('ru',{weekday:'short'});
    return date.toLocaleDateString('ru',{day:'numeric',month:'short'});
  }
  const initials=value=>{
    const x=String(value||'TG').replace(/^@/,'').split(/\s+/).filter(Boolean);
    return (x.slice(0,2).map(p=>p[0]).join('')||'TG').toUpperCase();
  };
  function toast(text){
    const target=$('toast');
    if(!target)return;
    target.textContent=String(text||'');
    target.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>target.classList.remove('show'),3000);
  }
  function haptic(){
    try{tg?.HapticFeedback?.impactOccurred('light');}catch{}
  }
  async function request(action,payload={}){
    const signed=String(tg?.initData||'');
    if(signed!==state.ownerInitData){
      resetOwner();
      throw new Error('Telegram-аккаунт изменился. Обнови переписки.');
    }
    if(!signed)throw new Error('Открой VETO в Telegram для доступа к твоим чатам.');
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),22000);
    try{
      const response=await fetch('/api/telegram-chats',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':signed},
        body:JSON.stringify({action,...payload}),signal:abort.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(signed!==String(tg?.initData||'')){
        resetOwner();
        throw new Error('Telegram-аккаунт изменился. Переписки прежнего аккаунта очищены.');
      }
      if(!response.ok||!data.ok){
        const error=new Error(data.error||'Не удалось получить переписки');
        error.status=response.status;
        throw error;
      }
      return data;
    }catch(err){
      if(err?.name==='AbortError')throw new Error('Telegram отвечает слишком долго. Попробуй ещё раз.');
      throw err;
    }finally{clearTimeout(timer);}
  }
  function showNotice(text,action=''){
    const el=$('telegramMirrorNotice');if(!el)return;
    el.hidden=false;
    el.innerHTML='<div><span>◈</span><p>'+safe(text)+'</p></div>'+
      (action?'<button type="button" data-mirror-connect="1">Подключить Telegram →</button>':'');
  }
  function hideNotice(){
    if($('telegramMirrorNotice'))$('telegramMirrorNotice').hidden=true;
  }
  function empty(title,detail,icon='◈'){
    return '<div class="veto-mirror-empty"><div class="veto-mirror-empty-mark">'+safe(icon)+
      '</div><strong>'+safe(title)+'</strong><small>'+safe(detail)+'</small></div>';
  }
  function preview(chat){
    const item=String(chat.preview||'');
    return item||(['channel','group'].includes(chat.type)
      ?'Открыть беседу':'Открыть сообщения');
  }
  function orderedChats(chats){
    return [...chats].sort((a,b)=>{
      if(Boolean(a.pinned)!==Boolean(b.pinned))return a.pinned?-1:1;
      const left=Date.parse(a.date||'')||0,right=Date.parse(b.date||'')||0;
      if(left!==right)return right-left;
      return String(a.id).localeCompare(String(b.id));
    });
  }
  function filteredChats(){
    const q=state.search.trim().toLocaleLowerCase();
    const filtered=state.chats.filter(chat=>{
      if(state.filter==='unread' && Number(chat.unreadCount||0)<=0)return false;
      if(state.filter==='focus' && !chat.inbox?.needsAttention)return false;
      if(state.filter==='pinned' && !chat.pinned)return false;
      if(state.filter==='archived' && chat.archived!==true)return false;
      if(state.filter==='copies' && !chat.savedCopy)return false;
      if(!['all','unread','pinned','archived','copies','focus'].includes(state.filter)&&chat.type!==state.filter)return false;
      if(!q)return true;
      return [chat.title,chat.username,chat.preview].some(value=>
        String(value||'').toLocaleLowerCase().includes(q));
    });
    if(state.filter==='focus'){
      return filtered.sort((a,b)=>Number(b.inbox?.score||0)-Number(a.inbox?.score||0)
        ||new Date(b.date||0)-new Date(a.date||0));
    }
    return orderedChats(filtered);
  }
  function renderPrivacyDiagnostics(){
    const el=$('telegramMirrorPrivacyDiagnostics');
    if(!el)return;
    const privacy=state.connectionProof?.privacy;
    if(!privacy){
      el.innerHTML='<div class="veto-mirror-diagnostics-head"><span>◈</span>'+
        '<strong>Privacy · проверяю состояние</strong><small>Если проверка не проходит — обнови экран.</small></div>';
      el.className='veto-mirror-privacy-diagnostics';
      return;
    }
    const known=privacy.nextAction!=='unavailable';
    const configured=privacy.ready===true;
    const next={
      unavailable:'Состояние Privacy не удалось проверить. Не считай архив активным.',
      enable_privacy:'Включи Anti-Delete и защищённый Inbox в Privacy.',
      connect_business:'Подключи Telegram Business к VETO, чтобы бот получал разрешённые события.',
      grant_messages:'Разреши VETO доступ к сообщениям в Telegram Business для нужных чатов.',
      test_archive:'Настройки включены. Для подтверждения доставки отправь новое сообщение в выбранном чате. Право отмечать сообщения прочитанными не требуется.',
    };
    const status=configured?'НАСТРОЕНО · ДЛЯ РАЗРЕШЁННЫХ ЧАТОВ':known?'ТРЕБУЕТ НАСТРОЙКИ':'СОСТОЯНИЕ НЕИЗВЕСТНО';
    const checkpoint=(label,okay)=>'<span class="'+(okay?'active':'inactive')+'">'+
      (okay?'✓ ':'○ ')+safe(label)+'</span>';
    el.className='veto-mirror-privacy-diagnostics'+(configured?' ready':'');
    el.innerHTML='<div class="veto-mirror-diagnostics-head"><span>◈</span>'+
      '<strong>Защита переписки</strong><small>'+safe(status)+'</small></div>'+
      '<div class="veto-mirror-checks">'+checkpoint('Anti-Delete',privacy.antiDelete)+
      checkpoint('Частный Inbox',privacy.privateArchive)+
      checkpoint('Business-доступ',privacy.businessConnected)+'</div>'+
      '<div class="veto-mirror-evidence"><strong>'+safe(privacy.confirmedDeleted||0)+
      '</strong><span>подтверждённых удалений</span><strong>'+safe(privacy.savedChats||0)+
      '</strong><span>сохранённых диалогов</span></div>'+
      '<p>'+safe(next[privacy.nextAction]||next.unavailable)+
      (Number(privacy.retentionDays)>0?' · Срок хранения: '+safe(privacy.retentionDays)+' дн.':'')+
      '</p><button type="button" data-mirror-privacy-setup="1">'+
      (configured?'Проверить настройки':'Настроить Privacy')+' ↗</button>';
  }
  function chatSkeleton(){
    // Visual placeholders only; never fabricate a message, sender or badge.
    return '<div class="veto-mirror-skeleton" aria-hidden="true">'+
      Array.from({length:5},(_,index)=>'<div class="veto-mirror-skeleton-row" style="--index:'+index+'">'+
        '<span class="veto-mirror-skeleton-avatar"></span>'+
        '<span class="veto-mirror-skeleton-copy"><i></i><i></i></span>'+
        '<span class="veto-mirror-skeleton-date"></span></div>').join('')+'</div>';
  }
  function renderChatMetrics(){
    const unread=state.chats.reduce((count,chat)=>count+Math.max(0,Number(chat.unreadCount||0)),0);
    const saved=state.chats.filter(chat=>chat.savedCopy===true).length;
    if($('telegramMirrorUnreadMetric'))$('telegramMirrorUnreadMetric').textContent=
      unread>999?'999+':String(unread);
    if($('telegramMirrorSavedMetric'))$('telegramMirrorSavedMetric').textContent=String(saved);
    if($('telegramMirrorSyncMetric'))$('telegramMirrorSyncMetric').textContent=
      state.cachedPreview?'КЭШ · НЕ LIVE':state.loading?'SYNC…':state.lastSyncedAt
        ?(state.syncMs?state.syncMs+' ms':'Обновлено'):'Нет данных';
    const access=$('telegramMirrorAccessCenter');
    if(access)access.classList.toggle('connected',state.connectionProof?.verified===true);
    const loading=$('telegramMirrorProgress');
    if(loading)loading.hidden=!state.loading;
    const refresh=$('telegramMirrorRefresh');
    if(refresh){refresh.disabled=state.loading;refresh.classList.toggle('spinning',state.loading);}
  }
  function renderChats(){
    const list=$('telegramMirrorList');
    if(!list)return;
    const items=filteredChats();
    renderPrivacyDiagnostics();
    renderChatMetrics();
    $('telegramMirrorCount').textContent=String(state.chats.length);
    const proof=$('telegramMirrorAccountProof');
    if(proof){
      const p=state.connectionProof;
      proof.classList.toggle('ready',p?.verified===true&&!state.stale);
      proof.classList.toggle('archive-only',Boolean(p)&&!p.verified);
      proof.textContent=state.cachedPreview
        ?'◌ Проверенный аккаунт · зашифрованная локальная копия, не LIVE'
        :state.stale&&p?.verified
        ?'◌ Ранее проверенный аккаунт · отображаются данные этого сеанса, обновление недоступно'
        :p?.verified
        ?'✓ Подтверждён Telegram '+(p.username?'@'+p.username:p.accountName||'владельца')+' · чаты только этого аккаунта'
        :p ? '◈ Только собственный архив VETO · живой аккаунт не подтверждён' : '◌ Проверяю личный Telegram · чужие чаты не показываются';
    }
    $('telegramMirrorUpdated').textContent=state.cachedPreview
      ?'КЭШ · '+state.chats.length+' чатов · проверяю Telegram'
      :state.loading
      ?'СИНХРОНИЗАЦИЯ · '+state.chats.length+' чатов'
      :state.lastSyncedAt
        ?state.chats.length+' загружено · '+(state.stale?'ОФЛАЙН-КОПИЯ':state.connectionProof?.verified?'LIVE':'АРХИВ')
        :'Ожидаю подключения';
    if(!items.length){
      list.innerHTML=state.loading
        ?chatSkeleton()
        :state.search||state.filter!=='all'
          ?empty('Ничего не найдено','Попробуй другой запрос или выбери «Все»','⌕')
          :empty('Чаты пока не загружены','Нажми обновить, чтобы увидеть свои переписки');
    }else{
      list.innerHTML=items.map(chat=>{
        const unread=Math.max(0,Number(chat.unreadCount||0));
        const badge=unread?'<span class="veto-mirror-unread">'+
          safe(unread>99?'99+':unread)+'</span>':'';
        const focusTag=chat.inbox?.needsAttention
          ?'<span class="veto-mirror-focus-tag">⌑ '+safe(chat.inbox.action?'Есть срок или действие':'Возможен вопрос')+'</span>':'';
        const retained=chat.savedCopy
          ?'<span class="veto-mirror-chat-retained">'+(Number(chat.deletedCount||0)>0
            ?'↶ '+safe(chat.deletedCount)+' удалено':'◈ СОХРАНЕНО')+'</span>' : '';
        const avatar=state.avatarUrls.get(String(chat.id));
        const image=avatar?'<img class="veto-mirror-avatar-img" src="'+safe(avatar)+'" alt="" />':safe(initials(chat.title));
        return '<button class="veto-mirror-chat'+(unread?' unread':'')+
          (chat.archiveOnly?' is-cleared':'')+
          '" type="button" data-mirror-chat="'+safe(chat.id)+
          '" aria-label="'+safe('Открыть '+chat.title)+'">'+
          '<span class="veto-mirror-chat-avatar avatar-'+safe(chat.type)+'" data-veto-avatar="'+safe(chat.id)+'">'+
          image+'</span>'+
          '<span class="veto-mirror-chat-main">'+
          '<span class="veto-mirror-chat-title"><strong>'+safe(chat.title)+'</strong>'+
          (chat.verified?'<i class="veto-mirror-verified">✓</i>':'')+
          (chat.pinned?'<i class="veto-mirror-pin">⌁</i>':'')+
          (chat.archived?'<i class="veto-mirror-pin">▣</i>':'')+'</span>'+
          '<small>'+safe(preview(chat))+'</small>'+focusTag+retained+
          '</span><span class="veto-mirror-chat-aside"><time>'+safe(time(chat.date))+
          '</time>'+badge+'</span></button>';
      }).join('');
    }
    const more=$('telegramMirrorMore');
    if(more){
      more.hidden=!state.hasMore||state.loading;
      more.disabled=state.loading;
    }
    if(items.length)queueVisibleAvatars();
    const clear=$('telegramMirrorSearchClear');
    if(clear)clear.hidden=!state.search;
  }
  async function restoreSafePreview(){
    // Telegram initData is verified by Vercel BEFORE IndexedDB decrypt.
    // No cached previews/message text, media or auth secrets are persisted.
    if(state.cacheVerifyBusy||!window.VetoChatsSnapshot||!tg?.initData)return;
    const signed=state.ownerInitData;
    state.cacheVerifyBusy=true;
    try{
      const identity=await request('verify');
      if(signed!==state.ownerInitData||state.cacheDenied)return;
      if(!identity.cacheAllowed||!/^[1-9][0-9]{0,18}$/.test(String(identity.ownerId||''))){
        return; // Never render local data to a disconnected/foreign owner.
      }
      state.cacheOwnerId=String(identity.ownerId);
      const snapshot=await window.VetoChatsSnapshot.load(identity.ownerId);
      if(signed!==state.ownerInitData||state.cacheDenied||!snapshot?.rows?.length||
        state.lastSyncedAt||state.chats.length)return;
      state.chats=snapshot.rows;
      state.cachedPreview=true;state.stale=true;
      state.hasMore=true; // Server pagination remains authoritative.
      renderChats();
    }catch{/* Private chats still load normally when offline cache fails. */}
    finally{if(signed===state.ownerInitData)state.cacheVerifyBusy=false;}
  }
  function saveSafePreview(){
    if(!window.VetoChatsSnapshot||!state.cacheOwnerId||
      state.cachedPreview||!state.connectionProof?.verified)return;
    void window.VetoChatsSnapshot.save(state.cacheOwnerId,state.chats);
  }
  async function loadChats({reset=false}={}){
    if(resetOwner())return;
    if(state.loading)return;
    const generation=++state.generation;
    const previousPage=state.page;
    const previousRows=new Map(state.chats.map(chat=>[String(chat.id),chat]));
    const known=reset&&previousPage===1&&!state.cachedPreview
      ?state.chats.filter(row=>/^[A-Za-z0-9_-]{43}$/.test(String(row.rowHash||'')))
        .slice(0,60).map(({id,rowHash})=>({id,rowHash}))
      :[];
    const sameOwner=String(tg?.initData||'')===state.ownerInitData;
    const keepWhileRefreshing=reset&&state.chats.length>0&&sameOwner;
    if(reset){
      state.page=0;state.hasMore=true;state.autoPages=0;
      if(!keepWhileRefreshing){state.chats=[];state.connectionProof=null;}
      hideNotice();
    }
    if(!state.hasMore)return;
    state.loading=true;
    const started=Date.now();
    renderChats();
    try{
      let data=await request('list',{page:state.page,...(known.length?{known}:{})});
      if(generation!==state.generation)return;
      // Only changed first-page cards traverse the network on a healthy
      // signed owner refresh. A partial response must never hide unknown
      // dialogs: retry a complete read when local metadata is unavailable.
      let incoming=Array.isArray(data.chats)?data.chats:[];
      if(data.delta?.orderedIds){
        const changes=new Map(incoming.map(row=>[String(row.id),row]));
        const rebuilt=data.delta.orderedIds.map(id=>
          changes.get(String(id))||previousRows.get(String(id)));
        if(rebuilt.some(row=>!row)){
          data=await request('list',{page:state.page});
          if(generation!==state.generation)return;
          incoming=Array.isArray(data.chats)?data.chats:[];
        }else incoming=rebuilt;
      }
      // Replace stale rows only AFTER the new first page was verified by the
      // same Telegram owner; do not leave removed dialogs in the fresh list.
      if(reset)state.chats=[];
      const indexes=new Map(state.chats.map((c,index)=>[String(c.id),index]));
      incoming.forEach(chat=>{
        if(!chat||!chat.id)return;
        const key=String(chat.id);
        if(indexes.has(key)){
          const index=indexes.get(key),previous=state.chats[index];
          if(chat.type!=='copy'||previous.type==='copy'){
            state.chats[index]={...previous,...chat,
              savedCopy:Boolean(previous.savedCopy||chat.savedCopy),
              deletedCount:Math.max(Number(previous.deletedCount||0),Number(chat.deletedCount||0)),
              savedCount:Math.max(Number(previous.savedCount||0),Number(chat.savedCount||0)),
            };
          }
        }else{
          indexes.set(key,state.chats.length);state.chats.push(chat);
        }
      });
      state.connectionProof=data.connection||null;
      state.cachedPreview=false;
      if(data.connection?.verified&&data.connection?.ownerId)
        state.cacheOwnerId=String(data.connection.ownerId);
      state.lastSyncedAt=Date.now();state.stale=false;
      state.syncMs=Math.max(0,Date.now()-started);
      // Archive-only rows are additional cards, not remote Telegram pagination.
      state.hasMore=Boolean(data.hasMore)&&state.page<11;
      state.page+=1;
      saveSafePreview();
      hideNotice();
      if($('telegramMirrorAccessButton')){
        $('telegramMirrorAccessButton').textContent = data.connection?.verified ? 'LIVE ✓' : 'Подключить ↗';
      }
      if(data.warning)showNotice(data.warning,/Подключи|подключён/.test(data.warning));
      if(!state.hasMore&&state.chats.length>=500)
        showNotice('Показаны последние 500 облачных диалогов. Для более старых используй оригинальный Telegram.');
    }catch(error){
      if(generation!==state.generation)return;
      state.stale=true;
      const accessFailure=[401,403,409].includes(Number(error.status||0))||
        /владелец|другой аккаунт|аккаунт изменился|сессия недействительна/i.test(error.message);
      if(accessFailure||!state.chats.length){
        if(accessFailure){
          state.cacheDenied=true;
          if(state.cacheOwnerId&&window.VetoChatsSnapshot)
            void window.VetoChatsSnapshot.clear(state.cacheOwnerId);
        }
        // No cross-user or unverified data may remain on access failure.
        state.chats=[];state.hasMore=false;state.connectionProof=null;
        state.cachedPreview=false;
        state.thread=null;state.messages=[];
        $('telegramThreadView').hidden=true;
        $('telegramChatsView').hidden=false;
        revokeMediaUrls();
        if($('telegramMirrorAccessButton'))
          $('telegramMirrorAccessButton').textContent='Подключить ↗';
      }
      // For a temporary 5xx/network outage only, keep the owner's current
      // in-memory list visibly marked as stale. No persistent browser storage.
      showNotice(!accessFailure&&state.chats.length
        ?'Telegram временно не отвечает. Показываю список из этого сеанса, не LIVE. Нажми ↻ для проверки. '+error.message
        :error.message,
        accessFailure&&/Подключи|подключён|Открой VETO|аккаунт|авторизуй/i.test(error.message));
    }finally{
      if(generation===state.generation){state.loading=false;renderChats();}
    }
  }
  async function photoRequest(action,chatId,messageId=null){
    if(!tg?.initData)throw new Error('Telegram Mini App требуется');
    const owner=String(tg?.initData||'');
    if(owner!==state.ownerInitData)throw new Error('Telegram-аккаунт изменился');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    try{
      const response=await fetch('/api/telegram-chat-media',{
        method:'POST',headers:{
          'content-type':'application/json','x-telegram-init-data':tg.initData,
        },body:JSON.stringify({action,chatId,messageId}),signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram не отдаёт изображение');
      const blob=await response.blob();
      if(owner!==state.ownerInitData||owner!==String(tg?.initData||''))
        throw new Error('Telegram-аккаунт изменился');
      if(!blob.size||blob.size>4*1024*1024||!blob.type.startsWith('image/'))
        throw new Error('Изображение недоступно');
      return URL.createObjectURL(blob);
    }finally{clearTimeout(timer);}
  }
  // Low-priority avatar budget: one request in flight and six per app session.
  // never attempt to download hundreds of profile photos when browsing dialogs.
  function queueVisibleAvatars(){
    if(String(tg?.initData||'')!==state.ownerInitData)return;
    if(!tg?.initData||state.avatarLoaded>=6||state.loading)return;
    const visible=[...document.querySelectorAll('[data-veto-avatar]')]
      .filter(el=>!state.avatarUrls.has(el.dataset.vetoAvatar))
      .slice(0,6-state.avatarLoaded);
    for(const el of visible){
      const id=String(el.dataset.vetoAvatar||'');
      if(!id||state.avatarRequested.has(id))continue;
      state.avatarRequested.add(id);
      state.avatarQueue.push(id);
    }
    // Defer MTProto media requests until the list paints. Telegram's initial
    // dialogs request must never compete with twelve thumbnail connections.
    if(state.avatarScheduled)return;
    state.avatarScheduled=true;
    const begin=()=>{
      state.avatarScheduled=false;
      if(state.ownerInitData===String(tg?.initData||''))runAvatarQueue();
    };
    if(typeof window.requestIdleCallback==='function')
      window.requestIdleCallback(begin,{timeout:1200});
    else setTimeout(begin,280);
  }
  function runAvatarQueue(){
    while(state.avatarActive<1&&state.avatarQueue.length&&state.avatarLoaded<6){
      const id=state.avatarQueue.shift();
      const owner=state.ownerInitData;
      state.avatarActive++;state.avatarLoaded++;
      photoRequest('avatar',id).then(href=>{
        if(owner!==String(tg?.initData||'')||owner!==state.ownerInitData){
          URL.revokeObjectURL(href);return;
        }
        state.avatarUrls.set(id,href);
        for(const el of document.querySelectorAll('[data-veto-avatar]')){
          if(el.dataset.vetoAvatar!==id)continue;
          const img=document.createElement('img');
          img.className='veto-mirror-avatar-img';img.alt='';img.src=href;
          el.replaceChildren(img);
        }
      }).catch(()=>{}).finally(()=>{
        if(owner!==state.ownerInitData)return;
        state.avatarActive=Math.max(0,state.avatarActive-1);runAvatarQueue();
      });
    }
  }
  function rememberPreview(messageId,href){
    state.mediaPreviewUrls.set(String(messageId),href);
    state.mediaUrls.push(href);
  }
  function inlineImage(message){
    if(message?.media!=='photo')return '';
    const cached=state.mediaPreviewUrls.get(String(message.id));
    if(cached)return '<img class="veto-mirror-inline-photo" src="'+safe(cached)+'" alt="Фото из переписки" loading="lazy" />';
    return '<div class="veto-mirror-inline-placeholder" data-mirror-preview="'+
      safe(message.id)+'"><span>▣</span><small>Фотография из переписки</small></div>';
  }
  // Lazy bounded preview: only three images per thread load; no media is
  // persisted outside the browser tab and all blob URLs are revoked on exit.
  function loadInlinePreviews(){
    if(!state.thread||!tg?.initData||
      String(tg.initData)!==state.ownerInitData)return;
    const targets=[...document.querySelectorAll('[data-mirror-preview]')].slice(-3);
    for(const el of targets){
      const id=Number(el.dataset.mirrorPreview);
      if(!Number.isSafeInteger(id)||state.previewSeen.has(id))continue;
      const msg=state.messages.find(m=>m.id===id);
      if(!msg)continue;
      state.previewSeen.add(id);
      // Never bulk-load attachments from unavailable deleted Telegram messages.
      if(msg.deleted && !msg.mediaAvailable)continue;
      const ownerChatId=String(state.thread.id);
      const generation=state.threadGeneration;
      const request=msg.saved&&msg.mediaAvailable
        ?(async()=>{
            const res=await fetch('/api/privacy-media?'+
              new URLSearchParams({chatId:ownerChatId,messageId:String(id)}),{
                headers:{'x-telegram-init-data':tg.initData},
              });
            if(!res.ok)throw new Error('private_photo_unavailable');
            const blob=await res.blob();
            if(!blob.size||blob.size>4*1024*1024||!blob.type.startsWith('image/'))
              throw new Error('private_photo_unavailable');
            return URL.createObjectURL(blob);
          })()
        :photoRequest('photo',ownerChatId,id);
      request.then(href=>{
        if(generation!==state.threadGeneration||String(state.thread?.id)!==ownerChatId){
          URL.revokeObjectURL(href);return;
        }
        rememberPreview(id,href);
        const container=[...document.querySelectorAll('[data-mirror-preview]')]
          .find(x=>Number(x.dataset.mirrorPreview)===id);
        if(container){
          const img=document.createElement('img');img.className='veto-mirror-inline-photo';
          img.alt='Фото из переписки';img.loading='lazy';img.src=href;
          container.replaceWith(img);
        }
      }).catch(()=>{});
    }
  }

  function closeThreadSearch(){
    state.searchGeneration++;
    const box=$('telegramThreadSearchPanel');
    if(box)box.hidden=true;
    if($('telegramThreadSearchQuery'))$('telegramThreadSearchQuery').value='';
    if($('telegramThreadSearchResults'))$('telegramThreadSearchResults').replaceChildren();
    $('telegramThreadSearchToggle')?.setAttribute('aria-expanded','false');
  }
  async function submitThreadSearch(event){
    event?.preventDefault?.();
    if(resetOwner()||!state.thread)return;
    const chatId=String(state.thread.id);
    const query=String($('telegramThreadSearchQuery')?.value||'').trim();
    const output=$('telegramThreadSearchResults');
    if(!output)return;
    if(query.length<2||query.length>80){
      output.textContent='Для поиска введи от 2 до 80 символов.';return;
    }
    if(state.thread.archiveOnly){
      output.textContent='Это только сохранённая копия. Для поиска в архиве открой Privacy.';
      return;
    }
    const generation=++state.searchGeneration;
    output.textContent='Ищу сообщения в Telegram…';
    const submit=$('telegramThreadSearchForm')?.querySelector('[type="submit"]');
    if(submit)submit.disabled=true;
    try{
      const data=await request('search',{chatId,query});
      if(generation!==state.searchGeneration||String(state.thread?.id)!==chatId)return;
      const rows=Array.isArray(data.results)?data.results:[];
      output.innerHTML=rows.length
        ?'<div class="veto-chat-search-total">Найдено: '+rows.length+
          (rows.length>=25?' · показаны первые 25':'')+'</div>'+
          rows.map(row=>
            '<button type="button" class="veto-chat-search-result" data-search-msg="'+safe(row.id)+'">'+
            '<span>'+safe(time(row.date))+(row.edited?' · изменено':'')+'</span>'+
            '<strong>'+safe(row.text||'Вложение: '+(row.media||'файл'))+'</strong>'+
            '</button>').join('')
        :'<p>По этому запросу сообщений не найдено.</p>';
    }catch(error){
      if(generation===state.searchGeneration)
        output.textContent=error.message||'Поиск временно недоступен';
    }finally{
      if(generation===state.searchGeneration&&submit)submit.disabled=false;
    }
  }
  function threadNotice(text){
    const el=$('telegramThreadNotice');
    if(!el)return;
    el.hidden=!text;
    el.textContent=String(text||'');
  }
  function resetOwner(){
    const current=String(tg?.initData||'');
    if(current===state.ownerInitData)return false;
    const oldCacheId=state.cacheOwnerId;
    state.ownerInitData=current;
    if(oldCacheId&&window.VetoChatsSnapshot)
      void window.VetoChatsSnapshot.clear(oldCacheId);
    // Invalidate every previously started list/thread request before it can
    // render into B's view or overwrite B's newer response.
    state.generation++;state.threadGeneration++;
    state.chats=[];state.messages=[];state.thread=null;
    closeThreadSearch();
    state.connectionProof=null;state.page=0;state.hasMore=true;
    state.lastSyncedAt=0;state.syncMs=0;state.autoPages=0;state.stale=false;
    state.cacheOwnerId='';state.cachedPreview=false;state.cacheDenied=false;state.cacheVerifyBusy=false;
    state.threadLoading=false;state.loading=false;
    state.search='';state.filter='all';
    if($('telegramMirrorSearch'))$('telegramMirrorSearch').value='';
    state.avatarQueue=[];state.avatarRequested.clear();state.avatarActive=0;state.avatarScheduled=false;
    state.avatarUrls.forEach(url=>{try{URL.revokeObjectURL(url);}catch{}});
    state.avatarUrls.clear();state.avatarLoaded=0;
    revokeMediaUrls();
    if($('telegramThreadMessages'))$('telegramThreadMessages').replaceChildren();
    if($('telegramMirrorList'))$('telegramMirrorList').replaceChildren();
    if($('telegramThreadView'))$('telegramThreadView').hidden=true;
    if($('telegramChatsView'))$('telegramChatsView').hidden=false;
    $('telegramMirror')?.classList.remove('thread-mode');
    hideNotice();
    showNotice('Telegram-аккаунт изменился. Старые переписки скрыты — обнови список.');
    renderChats();
    return true;
  }
  function revokeMediaUrls(){
    state.mediaUrls.forEach(value=>{try{URL.revokeObjectURL(value);}catch{}});
    state.mediaUrls=[];
    state.mediaPreviewUrls.clear();state.previewSeen.clear();
  }
  async function openArchivedFile(button){
    if(resetOwner()||!state.thread||!button||button.disabled)return;
    if(!tg?.initData){toast('Открой VETO внутри Telegram');return;}
    const id=Number(button.dataset.mirrorFile||0);
    if(!Number.isSafeInteger(id)||id<=0)return;
    button.disabled=true;
    const original=button.textContent;
    button.textContent='Загружаю защищённую копию…';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const params=new URLSearchParams({
        chatId:String(state.thread.id),messageId:String(id),
      });
      const response=await fetch('/api/privacy-media?'+params,{
        headers:{'x-telegram-init-data':tg.initData},signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram уже не отдаёт вложение и резервная копия недоступна.');
      const blob=await response.blob();
      if(!blob.size||blob.size>20*1024*1024)throw new Error('Файл слишком большой для просмотра.');
      if(String(tg?.initData||'')!==state.ownerInitData){
        resetOwner();return;
      }
      const href=URL.createObjectURL(blob);
      state.mediaUrls.push(href);
      const wrapper=document.createElement('div');
      wrapper.className='veto-mirror-media-reveal';
      const mime=String(blob.type||'').toLowerCase();
      if(['image/jpeg','image/png','image/webp','image/gif'].includes(mime)){
        const img=document.createElement('img');
        img.src=href;img.alt='Сохранённое вложение из чата';img.loading='lazy';
        wrapper.appendChild(img);
      }else if(['video/mp4','video/webm'].includes(mime)){
        const video=document.createElement('video');
        video.src=href;video.controls=true;video.preload='metadata';wrapper.appendChild(video);
      }
      const link=document.createElement('a');
      link.href=href;link.download='telegram-veto-'+id;
      link.textContent='Сохранить копию файла ↓';
      wrapper.appendChild(link);
      button.after(wrapper);button.hidden=true;
    }catch(error){
      toast(error?.name==='AbortError'?'Media Vault отвечает слишком долго':error.message);
      button.textContent=original;button.disabled=false;
    }finally{clearTimeout(timer);}
  }

  function visibleMessageAnchor(){
    const box=$('telegramThreadMessages');
    if(!box)return null;
    const bounds=box.getBoundingClientRect();
    const nodes=[...box.querySelectorAll('[data-mirror-message-id]')];
    const first=nodes.find(n=>n.getBoundingClientRect().bottom>bounds.top+10);
    return first?{id:first.dataset.mirrorMessageId,top:first.getBoundingClientRect().top-bounds.top}:null;
  }
  function renderMessages({keepScroll=false,anchor=null}={}){
    const box=$('telegramThreadMessages');
    if(!box)return;
    const previousHeight=box.scrollHeight, previousScroll=box.scrollTop;
    if(!state.messages.length){
      box.innerHTML=state.threadLoading
        ?empty('Загружаю сообщения','Получаю историю напрямую из Telegram…')
        :empty('Пустой чат','В Telegram нет доступных сообщений');
    }else{
      let day='';
      box.innerHTML=state.messages.map(message=>{
        const date=message.date?new Date(message.date):null;
        const dayKey=date&&!Number.isNaN(date.getTime())?date.toDateString():'';
        const divider=dayKey!==day&&dayKey
          ?'<div class="veto-mirror-day"><span>'+
            safe(date.toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'}))+
            '</span></div>':'';
        day=dayKey||day;
        const text=String(message.text||'');
        const media=message.media
          ?'<div class="veto-mirror-media">'+inlineImage(message)+safe(mediaLabels[message.media]||'◫ Вложение')+
            '<small>'+safe(message.saved&&message.mediaAvailable
              ?'Независимая копия · Media Vault'
              :message.saved?'Сохранена отметка о вложении':'Файл доступен в Telegram')+'</small></div>':'';
        const savedBanner=message.deleted
          ?'<div class="veto-mirror-preserved-flag deleted">↶ УДАЛЕНО В TELEGRAM · СОХРАНЕНО В VETO</div>'
          :message.preservedOnly
            ?'<div class="veto-mirror-preserved-flag">◈ СОХРАНЁННАЯ КОПИЯ VETO</div>'
            :message.saved
              ?'<div class="veto-mirror-preserved-flag subtle">◈ КОПИЯ В VETO</div>':'';
        const viewFile=message.saved&&message.media&&message.mediaAvailable
          ?'<button type="button" class="veto-mirror-open-vault" data-mirror-file="'+safe(message.id)+
             '">Открыть сохранённый файл ↗</button>':'';
        return divider+'<article data-mirror-message-id="'+safe(message.id)+'" class="veto-mirror-bubble'+(message.out?' outgoing':'')+
          (message.deleted?' is-deleted':'')+
          '"><div class="veto-mirror-bubble-inner">'+savedBanner+
          (message.sender&&!message.out?'<strong class="veto-mirror-bubble-sender">'+
            safe(message.sender)+'</strong>':'')+
          media+viewFile+(text?'<p>'+safe(text)+'</p>':'')+
          '<footer>'+(message.edited?'<span>изменено</span>':'')+
          '<time>'+safe(time(message.date))+'</time></footer></div></article>';
      }).join('');
    }
    if(anchor){
      const el=[...box.querySelectorAll('[data-mirror-message-id]')]
        .find(x=>x.dataset.mirrorMessageId===String(anchor.id));
      if(el)box.scrollTop+=el.getBoundingClientRect().top-box.getBoundingClientRect().top-anchor.top;
      else box.scrollTop=previousScroll+(box.scrollHeight-previousHeight);
    }else if(keepScroll){
      box.scrollTop=previousScroll+(box.scrollHeight-previousHeight);
    }else{
      box.scrollTop=box.scrollHeight;
    }
    const more=$('telegramThreadOlder');
    if(more){more.hidden=!state.threadHasMore;more.disabled=state.threadLoading;}
    loadInlinePreviews();
  }
  function setThread(chat){
    $('telegramChatsView').hidden=true;
    $('telegramThreadView').hidden=false;
    $('telegramThreadTitle').textContent=chat.title;
    $('telegramThreadAvatar').textContent=initials(chat.title);
    const avatar=state.avatarUrls.get(String(chat.id));
    if(avatar){const img=document.createElement('img');img.className='veto-mirror-avatar-img';img.src=avatar;img.alt='';$('telegramThreadAvatar').replaceChildren(img);}
    $('telegramThreadMeta').textContent=(labels[chat.type]||'чат')+
      (chat.archiveOnly?' · сохранено до удаления/очистки'
        :chat.savedCopy?' · вместе с сохранённой историей':' · сообщения из Telegram');
    $('telegramThreadAvatar').className='veto-mirror-thread-avatar avatar-'+chat.type;
    const link=$('telegramThreadOpenNative');
    if(link){
      const native=String(chat.nativeUrl||'');
      const valid=/^https:\/\/t\.me\/[A-Za-z0-9_]+$/.test(native)
        || /^tg:\/\/user\?id=\d+$/.test(native);
      link.hidden=!valid;
      if(valid)link.href=native;
      else link.removeAttribute('href');
    }
    $('telegramThreadMessages').innerHTML=empty('Открываю переписку','История загружается из Telegram');
    threadNotice('');
    const shell=$('telegramMirror');
    shell?.classList.add('thread-mode');
    window.scrollTo({top:0,behavior:'instant'});
  }
  async function openThread(chat){
    if(resetOwner()||!chat)return;
    closeThreadSearch();
    revokeMediaUrls();
    haptic();
    state.thread=chat;state.messages=[];state.threadHasMore=false;
    state.threadOffset=0;state.archiveOffset=0;
    state.archiveHasMore=false;state.liveHasMore=!chat.archiveOnly;
    state.threadGeneration++;
    setThread(chat);
    await loadMessages({reset:true});
  }
  async function loadMessages({reset=false}={}){
    if(resetOwner())return;
    if(!state.thread||state.threadLoading)return;
    const chatId=String(state.thread.id);
    const rememberedAnchor=state.messages.length?visibleMessageAnchor():null;
    const generation=++state.threadGeneration;
    state.threadLoading=true;
    if(reset&&!rememberedAnchor)state.messages=[];
    $('telegramThreadOlder').hidden=true;
    if(reset)renderMessages();
    try{
      const data=await request('thread',{
        chatId,offsetId:reset?0:state.threadOffset,
        archiveOffset:reset?0:state.archiveOffset,
        archiveOnly:Boolean(state.thread.archiveOnly),
        liveExhausted:!reset&&!state.liveHasMore,
      });
      if(generation!==state.threadGeneration||String(state.thread?.id)!==chatId)return;
      const byId=new Map(state.messages.map(m=>[String(m.id),m]));
      (data.messages||[]).forEach(msg=>{
        if(!msg||!msg.id)return;
        const key=String(msg.id),old=byId.get(key);
        byId.set(key,old
          ?{...old,...msg,deleted:Boolean(old.deleted||msg.deleted),
            saved:Boolean(old.saved||msg.saved),
            preservedOnly:Boolean(old.preservedOnly||msg.preservedOnly),
            mediaAvailable:Boolean(old.mediaAvailable||msg.mediaAvailable)}
          :msg);
      });
      state.messages=[...byId.values()].sort((a,b)=>
        new Date(a.date||0).getTime()-new Date(b.date||0).getTime()||
        Number(a.id)-Number(b.id));
      state.liveHasMore=Boolean(data.liveHasMore&&data.nextOffsetId);
      state.archiveHasMore=Boolean(data.archiveHasMore);
      state.threadHasMore=state.liveHasMore||state.archiveHasMore;
      state.threadOffset=Number(data.nextOffsetId||state.threadOffset||0);
      state.archiveOffset=Number(data.archiveNextOffset||0);
      if(!data.warning)threadNotice('');
      else threadNotice(data.warning);
      if(data.chat && state.thread && data.chat.type!=='copy'){
        state.thread={...state.thread,...data.chat,
          savedCopy:Boolean(state.thread.savedCopy||data.chat.savedCopy)};
        $('telegramThreadMeta').textContent=(labels[data.chat.type]||'чат')+
          (state.thread.savedCopy?' · сохранённая история VETO':' · Telegram');
      }
      state.threadLoading=false;
      renderMessages({keepScroll:!reset,anchor:rememberedAnchor});
    }catch(error){
      if(generation!==state.threadGeneration||String(state.thread?.id)!==chatId)return;
      state.threadLoading=false;
      threadNotice(error.message);
      if(reset)renderMessages();
      else $('telegramThreadOlder').hidden=!state.threadHasMore;
    }
  }
  function back(){
    if(!$('telegramThreadView')||$('telegramThreadView').hidden)return;
    state.threadGeneration++;
    state.thread=null;state.threadLoading=false;
    $('telegramThreadView').hidden=true;
    $('telegramChatsView').hidden=false;
    $('telegramMirror')?.classList.remove('thread-mode');
    revokeMediaUrls();
    window.scrollTo({top:0,behavior:'instant'});
  }
  $('telegramMirrorPrivacyDiagnostics')?.addEventListener('click',event=>{
    if(event.target.closest('[data-mirror-privacy-setup]'))
      window.VetoTelegramNavigate?.('privacy');
  });
  $('telegramMirrorDeletedGuide')?.addEventListener('click',()=>{
    const saved=state.connectionProof?.archivedThreads||0;
    const deleted=state.connectionProof?.confirmedDeleted||0;
    const notice=$('telegramMirrorNotice');
    if(!notice)return;
    notice.hidden=false;
    notice.innerHTML='<div><span>↶</span><p>'+
      'Подтверждённых удалений в твоём собственном сохранённом архиве: <b>'+safe(deleted)+
      '</b>. Сохранённых диалогов: <b>'+safe(saved)+
      '</b>. LIVE подключение показывает только текущую историю Telegram. Удалённые сообщения доступны только если VETO сохранил их до удаления и получил событие об удалении. '+
      'Для будущих удалений включи Anti-Delete и разреши сообщения в Telegram Business для выбранных чатов. Резервные копии без Business сохраняют содержимое, но не подтверждают факт удаления.'+
      '</p></div><button type="button" data-mirror-privacy-open="1">Настроить Privacy ↗</button>';
  });
  $('telegramMirrorNotice')?.addEventListener('click',event=>{
    if(event.target.closest('[data-mirror-privacy-open]'))window.VetoTelegramNavigate?.('privacy');
  });
  $('telegramMirrorAccessButton')?.addEventListener('click',()=>{
    if(typeof window.VetoTelegramOpenAccountConnection==='function'){
      window.VetoTelegramOpenAccountConnection();
    }else{
      toast('Открой VETO внутри Telegram');
    }
  });
  $('telegramMirrorRefresh')?.addEventListener('click',()=>loadChats({reset:true}));
  // Fetch additional pages only when the user actually scrolls to the
  // bottom, with a small automatic cap to avoid downloading 500 dialogs.
  if('IntersectionObserver' in window && $('telegramMirrorMore')){
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      if(document.querySelector('.screen.active')?.dataset?.screen!=='telegram')return;
      if($('telegramChatsView')?.hidden||state.loading||!state.hasMore||state.page===0)return;
      if(state.autoPages>=2)return;
      state.autoPages++;
      void loadChats();
    },{rootMargin:'180px 0px'});
    observer.observe($('telegramMirrorMore'));
  }
  $('telegramMirrorMore')?.addEventListener('click',()=>loadChats());
  $('telegramMirrorSearch')?.addEventListener('input',event=>{
    state.search=event.target.value;renderChats();
  });
  $('telegramMirrorSearchClear')?.addEventListener('click',()=>{
    state.search='';$('telegramMirrorSearch').value='';renderChats();
    $('telegramMirrorSearch').focus();
  });
  $('telegramMirrorFilters')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-mirror-filter]');
    if(!button)return;
    state.filter=String(button.dataset.mirrorFilter||'all');
    $('telegramMirrorFilters').querySelectorAll('[data-mirror-filter]').forEach(item=>{
      const selected=item===button;
      item.classList.toggle('active',selected);
      item.setAttribute('aria-pressed',String(selected));
    });
    renderChats();
  });
  $('telegramMirrorList')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-mirror-chat]');
    if(!button)return;
    const chat=state.chats.find(c=>String(c.id)===String(button.dataset.mirrorChat));
    openThread(chat);
  });
  $('telegramMirrorNotice')?.addEventListener('click',event=>{
    if(!event.target.closest('[data-mirror-connect]'))return;
    if(typeof window.VetoTelegramOpenAccountConnection==='function'){
      window.VetoTelegramOpenAccountConnection();
    }else{
      window.VetoTelegramNavigate?.('home');
      $('connectTelegramButton')?.click();
    }
  });
  $('telegramThreadMessages')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-mirror-file]');
    if(button)openArchivedFile(button);
  });
  $('telegramThreadBack')?.addEventListener('click',back);
  $('telegramThreadSearchToggle')?.addEventListener('click',()=>{
    if(!state.thread)return;
    const panel=$('telegramThreadSearchPanel');
    if(!panel)return;
    const opening=panel.hidden;
    if(!opening){closeThreadSearch();return;}
    panel.hidden=false;
    $('telegramThreadSearchToggle')?.setAttribute('aria-expanded','true');
    $('telegramThreadSearchQuery')?.focus();
  });
  $('telegramThreadSearchClose')?.addEventListener('click',closeThreadSearch);
  $('telegramThreadSearchForm')?.addEventListener('submit',submitThreadSearch);
  $('telegramThreadSearchResults')?.addEventListener('click',event=>{
    const hit=event.target.closest('[data-search-msg]');
    if(!hit)return;
    const id=String(hit.dataset.searchMsg||'');
    const message=[...$('telegramThreadMessages').querySelectorAll('[data-mirror-message-id]')]
      .find(el=>el.dataset.mirrorMessageId===id);
    if(message){
      closeThreadSearch();
      message.scrollIntoView({behavior:'smooth',block:'center'});
      message.classList.add('veto-chat-found');
      setTimeout(()=>message.classList.remove('veto-chat-found'),1600);
    }else{
      hit.setAttribute('title','Сообщение найдено в Telegram; оно не входит в уже загруженную страницу.');
    }
  });
  $('telegramThreadRefresh')?.addEventListener('click',()=>loadMessages({reset:true}));
  $('telegramThreadOlder')?.addEventListener('click',()=>loadMessages());
  $('telegramThreadBottomJump')?.addEventListener('click',()=>{
    const body=$('telegramThreadMessages');
    if(body)body.scrollTo({top:body.scrollHeight,behavior:'smooth'});
  });
  window.addEventListener('veto:screen-changed',event=>{
    resetOwner();
    const current=event.detail?.screen;
    if(current==='telegram'&&state.chats.length===0&&!state.loading){
      void restoreSafePreview();
      void loadChats({reset:true});
    }
  });
  window.addEventListener('focus',resetOwner);
  window.addEventListener('pageshow',resetOwner);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)resetOwner();
  });
  // Opening a deep-linked screen may precede the first screen-change event.
  if(document.querySelector('.screen.active')?.dataset?.screen==='telegram'){
    void restoreSafePreview();
    void loadChats({reset:true});
  }
})();
