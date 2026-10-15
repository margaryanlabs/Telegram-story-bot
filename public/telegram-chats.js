(() => {
  'use strict';
  const tg=window.Telegram?.WebApp;
  const $=id=>document.getElementById(id);
  const state={
    chats:[],page:0,hasMore:true,loading:false,
    filter:'all',search:'',generation:0,
    thread:null,messages:[],threadLoading:false,
    threadHasMore:false,threadOffset:0,archiveHasMore:false,archiveOffset:0,liveHasMore:false,threadGeneration:0,
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
    if(!tg?.initData)throw new Error('Открой VETO в Telegram для доступа к твоим чатам.');
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),22000);
    try{
      const response=await fetch('/api/telegram-chats',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':tg.initData},
        body:JSON.stringify({action,...payload}),signal:abort.signal,
      });
      const data=await response.json().catch(()=>({}));
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
  function filteredChats(){
    const q=state.search.trim().toLocaleLowerCase();
    return state.chats.filter(chat=>{
      if(state.filter==='unread' && Number(chat.unreadCount||0)<=0)return false;
      if(state.filter==='archived' && chat.archived!==true)return false;
      if(state.filter==='copies' && !chat.savedCopy)return false;
      if(!['all','unread','archived','copies'].includes(state.filter)&&chat.type!==state.filter)return false;
      if(!q)return true;
      return [chat.title,chat.username,chat.preview].some(value=>
        String(value||'').toLocaleLowerCase().includes(q));
    });
  }
  function renderChats(){
    const list=$('telegramMirrorList');
    if(!list)return;
    const items=filteredChats();
    $('telegramMirrorCount').textContent=String(state.chats.length);
    $('telegramMirrorUpdated').textContent=state.chats.length
      ?String(state.chats.length)+' загружено · LIVE':'LIVE · По запросу';
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
        const retained=chat.savedCopy
          ?'<span class="veto-mirror-chat-retained">'+(Number(chat.deletedCount||0)>0
            ?'↶ '+safe(chat.deletedCount)+' удалено':'◈ СОХРАНЕНО')+'</span>' : '';
        return '<button class="veto-mirror-chat'+(unread?' unread':'')+
          '" type="button" data-mirror-chat="'+safe(chat.id)+
          '" aria-label="'+safe('Открыть '+chat.title)+'">'+
          '<span class="veto-mirror-chat-avatar avatar-'+safe(chat.type)+'">'+
          safe(initials(chat.title))+'</span>'+
          '<span class="veto-mirror-chat-main">'+
          '<span class="veto-mirror-chat-title"><strong>'+safe(chat.title)+'</strong>'+
          (chat.verified?'<i class="veto-mirror-verified">✓</i>':'')+
          (chat.pinned?'<i class="veto-mirror-pin">⌁</i>':'')+
          (chat.archived?'<i class="veto-mirror-pin">▣</i>':'')+'</span>'+
          '<small>'+safe(preview(chat))+'</small>'+retained+
          '</span><span class="veto-mirror-chat-aside"><time>'+safe(time(chat.date))+
          '</time>'+badge+'</span></button>';
      }).join('');
    }
    const more=$('telegramMirrorMore');
    if(more){
      more.hidden=!state.hasMore||state.loading;
      more.disabled=state.loading;
    }
    const clear=$('telegramMirrorSearchClear');
    if(clear)clear.hidden=!state.search;
  }
  async function loadChats({reset=false}={}){
    if(state.loading)return;
    const generation=++state.generation;
    if(reset){
      state.page=0;state.chats=[];state.hasMore=true;
      hideNotice();
    }
    if(!state.hasMore)return;
    state.loading=true;
    renderChats();
    try{
      const data=await request('list',{page:state.page});
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
      state.hasMore=Boolean(data.hasMore)&&state.chats.length<Number(data.limit||500);
      state.page+=1;
      hideNotice();
      if(data.warning)showNotice(data.warning,/Подключи|подключён/.test(data.warning));
      if(!state.hasMore&&state.chats.length>=500)
        showNotice('Показаны последние 500 облачных диалогов. Для более старых используй оригинальный Telegram.');
    }catch(error){
      showNotice(error.message,/Подключи|подключён|Открой VETO/.test(error.message));
    }finally{
      if(generation===state.generation){state.loading=false;renderChats();}
    }
  }
  function threadNotice(text){
    const el=$('telegramThreadNotice');
    if(!el)return;
    el.hidden=!text;
    el.textContent=String(text||'');
  }
  function renderMessages({keepScroll=false}={}){
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
          ?'<div class="veto-mirror-media">'+safe(mediaLabels[message.media]||'◫ Вложение')+
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
        return divider+'<article class="veto-mirror-bubble'+(message.out?' outgoing':'')+
          (message.deleted?' is-deleted':'')+
          '"><div class="veto-mirror-bubble-inner">'+savedBanner+
          (message.sender&&!message.out?'<strong class="veto-mirror-bubble-sender">'+
            safe(message.sender)+'</strong>':'')+
          media+viewFile+(text?'<p>'+safe(text)+'</p>':'')+
          '<footer>'+(message.edited?'<span>изменено</span>':'')+
          '<time>'+safe(time(message.date))+'</time></footer></div></article>';
      }).join('');
    }
    if(keepScroll){
      box.scrollTop=previousScroll+(box.scrollHeight-previousHeight);
    }else{
      box.scrollTop=box.scrollHeight;
    }
    const more=$('telegramThreadOlder');
    if(more){more.hidden=!state.threadHasMore;more.disabled=state.threadLoading;}
  }
  function setThread(chat){
    $('telegramChatsView').hidden=true;
    $('telegramThreadView').hidden=false;
    $('telegramThreadTitle').textContent=chat.title;
    $('telegramThreadAvatar').textContent=initials(chat.title);
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
    haptic();
    state.thread=chat;state.messages=[];state.threadHasMore=false;
    state.threadOffset=0;state.archiveOffset=0;
    state.archiveHasMore=false;state.liveHasMore=!chat.archiveOnly;
    state.threadGeneration++;
    setThread(chat);
    await loadMessages({reset:true});
  }
  async function loadMessages({reset=false}={}){
    if(!state.thread||state.threadLoading)return;
    const chatId=String(state.thread.id);
    const generation=++state.threadGeneration;
    state.threadLoading=true;
    if(reset)state.messages=[];
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
      state.threadLoading=false;
      renderMessages({keepScroll:!reset});
    }catch(error){
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
    window.scrollTo({top:0,behavior:'instant'});
  }
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
    window.VetoTelegramNavigate?.('home');
    $('connectTelegramButton')?.click();
  });
  $('telegramThreadBack')?.addEventListener('click',back);
  $('telegramThreadRefresh')?.addEventListener('click',()=>loadMessages({reset:true}));
  $('telegramThreadOlder')?.addEventListener('click',()=>loadMessages());
  window.addEventListener('veto:screen-changed',event=>{
    const current=event.detail?.screen;
    if(current==='telegram'&&state.chats.length===0&&!state.loading)loadChats({reset:true});
  });
  // Opening a deep-linked screen may precede the first screen-change event.
  if(document.querySelector('.screen.active')?.dataset?.screen==='telegram')
    loadChats({reset:true});
})();
