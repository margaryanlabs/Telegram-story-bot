(() => {
  'use strict';
  const tg=window.Telegram?.WebApp;
  const $=id=>document.getElementById(id);
  const state={
    chats:[],page:0,hasMore:true,loading:false,
    filter:'all',search:'',generation:0,ownerFingerprint:null,
    thread:null,messages:[],threadLoading:false,
    threadHasMore:false,threadOffset:0,archiveHasMore:false,archiveOffset:0,liveHasMore:false,threadGeneration:0,
    connectionProof:null,mediaUrls:[],avatarUrls:new Map(),mediaPreviewUrls:new Map(),avatarQueue:[],avatarRequested:new Set(),avatarActive:0,avatarLoaded:0,
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
    const initData=String(tg?.initData||'');
    if(!initData)throw new Error('Открой VETO в Telegram для доступа к твоим чатам.');
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),22000);
    try{
      const response=await fetch('/api/telegram-chats',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':initData},
        body:JSON.stringify({action,...payload}),signal:abort.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(initData!==String(tg?.initData||''))throw new Error('TELEGRAM_ACCOUNT_CHANGED');
      if(!response.ok||!data.ok)
        throw new Error(data.error||'Не удалось получить переписки');
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
      test_archive:'Доступы выглядят готовыми. Проверь на новом сообщении в разрешённом чате.',
    };
    const status=configured?'НАСТРОЕНО · ДЛЯ РАЗРЕШЁННЫХ ЧАТОВ':known?'ТРЕБУЕТ НАСТРОЙКИ':'СОСТОЯНИЕ НЕИЗВЕСТНО';
    const checkpoint=(label,okay)=>'<span class="'+(okay?'active':'inactive')+'">'+
      (okay?'✓ ':'○ ')+safe(label)+'</span>';
    el.className='veto-mirror-privacy-diagnostics'+(configured?' ready':'');
    el.innerHTML='<div class="veto-mirror-diagnostics-head"><span>◈</span>'+
      '<strong>Защита переписки</strong><small>'+safe(status)+'</small></div>'+
      '<div class="veto-mirror-checks">'+checkpoint('Anti-Delete',privacy.antiDelete)+
      checkpoint('Частный Inbox',privacy.privateArchive)+
      checkpoint('Business-доступ',privacy.businessConnected)+
      checkpoint('Чтение сообщений',privacy.readMessagesAllowed)+'</div>'+
      '<div class="veto-mirror-evidence"><strong>'+safe(privacy.confirmedDeleted||0)+
      '</strong><span>подтверждённых удалений</span><strong>'+safe(privacy.savedChats||0)+
      '</strong><span>сохранённых диалогов</span></div>'+
      '<p>'+safe(next[privacy.nextAction]||next.unavailable)+
      (Number(privacy.retentionDays)>0?' · Срок хранения: '+safe(privacy.retentionDays)+' дн.':'')+
      '</p><button type="button" data-mirror-privacy-setup="1">'+
      (configured?'Проверить настройки':'Настроить Privacy')+' ↗</button>';
  }
  function renderChats(){
    const list=$('telegramMirrorList');
    if(!list)return;
    const items=filteredChats();
    renderPrivacyDiagnostics();
    $('telegramMirrorCount').textContent=String(state.chats.length);
    const proof=$('telegramMirrorAccountProof');
    if(proof){
      const p=state.connectionProof;
      proof.classList.toggle('ready',p?.verified===true);
      proof.classList.toggle('archive-only',Boolean(p)&&!p.verified);
      proof.textContent=p?.verified
        ?'✓ Подтверждён Telegram '+(p.username?'@'+p.username:p.accountName||'владельца')+' · чаты только этого аккаунта'
        :p ? '◈ Только собственный архив VETO · живой аккаунт не подтверждён' : '◌ Проверяю личный Telegram · чужие чаты не показываются';
    }
    $('telegramMirrorUpdated').textContent=state.chats.length
      ?String(state.chats.length)+' загружено · '+(state.connectionProof?.verified?'LIVE':'АРХИВ')
      :'Telegram · По запросу';
    if(!items.length){
      list.innerHTML=state.loading
        ?empty('Подключаюсь к Telegram','Загружаю настоящие чаты…','↻')
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
  async function loadChats({reset=false}={}){
    const ownerFingerprint=String(tg?.initData||'');
    // The WebView can stay mounted while Telegram changes its signed identity.
    // Force a fresh account boundary; never reuse A's chats, archive or blob URLs for B.
    if(ownerFingerprint!==state.ownerFingerprint)reset=true;
    if(state.loading&&!reset)return;
    const generation=++state.generation;
    state.ownerFingerprint=ownerFingerprint;
    if(reset){
      state.threadGeneration++;
      state.thread=null;state.messages=[];state.threadLoading=false;
      state.threadHasMore=false;state.threadOffset=0;state.archiveOffset=0;
      state.liveHasMore=false;state.archiveHasMore=false;
      $('telegramThreadView').hidden=true;
      $('telegramChatsView').hidden=false;
      $('telegramMirror')?.classList.remove('thread-mode');
      revokeMediaUrls();
      for(const href of state.avatarUrls.values()){
        try{URL.revokeObjectURL(href);}catch{}
      }
      state.avatarUrls.clear();state.avatarQueue=[];state.avatarRequested.clear();
      state.avatarActive=0;state.avatarLoaded=0;
      state.page=0;state.chats=[];state.hasMore=true;state.connectionProof=null;
      hideNotice();
    }
    if(!state.hasMore)return;
    state.loading=true;
    renderChats();
    try{
      const data=await request('list',{page:state.page});
      if(ownerFingerprint!==String(tg?.initData||'')){
        void loadChats({reset:true});return;
      }
      if(generation!==state.generation)return;
      const indexes=new Map(state.chats.map((c,index)=>[String(c.id),index]));
      (data.chats||[]).forEach(chat=>{
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
      // Archive-only rows are additional cards, not remote Telegram pagination.
      state.hasMore=Boolean(data.hasMore)&&state.page<10;
      state.page+=1;
      hideNotice();
      if($('telegramMirrorAccessButton')){
        $('telegramMirrorAccessButton').textContent = data.connection?.verified ? 'LIVE ✓' : 'Подключить ↗';
      }
      if(data.warning)showNotice(data.warning,/Подключи|подключён/.test(data.warning));
      if(!state.hasMore&&state.chats.length>=500)
        showNotice('Показаны последние 500 облачных диалогов. Для более старых используй оригинальный Telegram.');
    }catch(error){
      if(ownerFingerprint!==String(tg?.initData||'')){
        void loadChats({reset:true});return;
      }
      if(generation!==state.generation)return;
      // Fail closed on any signed-account mismatch or authentication error.
      // Never keep a previously loaded conversation visible after a failed refresh.
      state.chats=[];state.hasMore=false;state.connectionProof=null;
      state.thread=null;state.messages=[];
      $('telegramThreadView').hidden=true;
      $('telegramChatsView').hidden=false;
      revokeMediaUrls();
      if($('telegramMirrorAccessButton')){
        $('telegramMirrorAccessButton').textContent = 'Подключить ↗';
      }
      showNotice(error.message,/Подключи|подключён|Открой VETO|аккаунт|авторизуй/i.test(error.message));
    }finally{
      if(generation===state.generation&&ownerFingerprint===String(tg?.initData||'')){
        state.loading=false;renderChats();
      }
    }
  }
  async function photoRequest(action,chatId,messageId=null){
    const initData=String(tg?.initData||'');
    if(!initData)throw new Error('Telegram Mini App требуется');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    try{
      const response=await fetch('/api/telegram-chat-media',{
        method:'POST',headers:{
          'content-type':'application/json','x-telegram-init-data':initData,
        },body:JSON.stringify({action,chatId,messageId}),signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram не отдаёт изображение');
      const blob=await response.blob();
      if(!blob.size||blob.size>4*1024*1024||!blob.type.startsWith('image/'))
        throw new Error('Изображение недоступно');
      if(initData!==String(tg?.initData||''))throw new Error('TELEGRAM_ACCOUNT_CHANGED');
      return URL.createObjectURL(blob);
    }finally{clearTimeout(timer);}
  }
  // At most two MTProto avatar requests in flight, and 12 per app session:
  // never attempt to download hundreds of profile photos when browsing dialogs.
  function queueVisibleAvatars(){
    if(!tg?.initData||state.avatarLoaded>=12)return;
    const visible=[...document.querySelectorAll('[data-veto-avatar]')]
      .filter(el=>!state.avatarUrls.has(el.dataset.vetoAvatar))
      .slice(0,12-state.avatarLoaded);
    for(const el of visible){
      const id=String(el.dataset.vetoAvatar||'');
      if(!id||state.avatarRequested.has(id))continue;
      state.avatarRequested.add(id);
      state.avatarQueue.push(id);
    }
    runAvatarQueue();
  }
  function runAvatarQueue(){
    while(state.avatarActive<2&&state.avatarQueue.length&&state.avatarLoaded<12){
      const id=state.avatarQueue.shift();
      const generation=state.generation,ownerFingerprint=state.ownerFingerprint;
      state.avatarActive++;state.avatarLoaded++;
      photoRequest('avatar',id).then(href=>{
        if(generation!==state.generation||ownerFingerprint!==String(tg?.initData||'')){
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
        if(generation!==state.generation||ownerFingerprint!==String(tg?.initData||''))return;
        state.avatarActive--;runAvatarQueue();
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
    if(!state.thread||!tg?.initData)return;
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
      const ownerFingerprint=state.ownerFingerprint;
      const request=msg.saved&&msg.mediaAvailable
        ?(async()=>{
            const res=await fetch('/api/privacy-media?'+
              new URLSearchParams({chatId:ownerChatId,messageId:String(id)}),{
                headers:{'x-telegram-init-data':ownerFingerprint},
              });
            if(!res.ok)throw new Error('private_photo_unavailable');
            const blob=await res.blob();
            if(!blob.size||blob.size>4*1024*1024||!blob.type.startsWith('image/'))
              throw new Error('private_photo_unavailable');
            return URL.createObjectURL(blob);
          })()
        :photoRequest('photo',ownerChatId,id);
      request.then(href=>{
        if(generation!==state.threadGeneration||String(state.thread?.id)!==ownerChatId||
          ownerFingerprint!==String(tg?.initData||'')){
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

  function threadNotice(text){
    const el=$('telegramThreadNotice');
    if(!el)return;
    el.hidden=!text;
    el.textContent=String(text||'');
  }
  function revokeMediaUrls(){
    state.mediaUrls.forEach(value=>{try{URL.revokeObjectURL(value);}catch{}});
    state.mediaUrls=[];
    state.mediaPreviewUrls.clear();state.previewSeen.clear();
  }
  async function openArchivedFile(button){
    if(!state.thread||!button||button.disabled)return;
    const ownerFingerprint=String(tg?.initData||'');
    if(ownerFingerprint!==state.ownerFingerprint){void loadChats({reset:true});return;}
    if(!ownerFingerprint){toast('Открой VETO внутри Telegram');return;}
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
        headers:{'x-telegram-init-data':ownerFingerprint},signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram уже не отдаёт вложение и резервная копия недоступна.');
      const blob=await response.blob();
      if(ownerFingerprint!==String(tg?.initData||'')||ownerFingerprint!==state.ownerFingerprint)
        throw new Error('TELEGRAM_ACCOUNT_CHANGED');
      if(!blob.size||blob.size>20*1024*1024)throw new Error('Файл слишком большой для просмотра.');
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
    if(!chat)return;
    if(state.ownerFingerprint!==String(tg?.initData||'')){
      void loadChats({reset:true});return;
    }
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
    if(state.ownerFingerprint!==String(tg?.initData||'')){
      void loadChats({reset:true});return;
    }
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
      if(state.ownerFingerprint!==String(tg?.initData||'')){
        void loadChats({reset:true});return;
      }
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
      if(state.ownerFingerprint!==String(tg?.initData||'')){
        void loadChats({reset:true});return;
      }
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
  $('telegramThreadRefresh')?.addEventListener('click',()=>loadMessages({reset:true}));
  $('telegramThreadOlder')?.addEventListener('click',()=>loadMessages());
  window.addEventListener('veto:screen-changed',event=>{
    const current=event.detail?.screen;
    if(current==='telegram')loadChats({reset:true});
  });
  // Opening a deep-linked screen may precede the first screen-change event.
  if(document.querySelector('.screen.active')?.dataset?.screen==='telegram')
    loadChats({reset:true});
})();
