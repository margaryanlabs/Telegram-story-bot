(() => {
  'use strict';
  const tg=window.Telegram?.WebApp;
  const $=id=>document.getElementById(id);
  const state={
    chats:[],page:0,hasMore:true,loading:false,
    filter:'all',search:'',generation:0,lastListFetchedAt:0,
    thread:null,messages:[],threadLoading:false,
    threadHasMore:false,threadOffset:0,archiveHasMore:false,archiveOffset:0,liveHasMore:false,threadGeneration:0,
    connectionProof:null,ownerInitData:String(tg?.initData||''),mediaUrls:[],avatarUrls:new Map(),mediaPreviewUrls:new Map(),avatarQueue:[],avatarRequested:new Set(),avatarActive:0,avatarLoaded:0,
    previewActive:0,previewEpoch:0,previewSeen:new Set(),previewInflight:new Set(),expandedAttachments:new Map(),expandedBytes:0,
    drafts:new Map(),sendInFlight:false,lastSendFailure:null,
    pendingAttachment:null,replyTo:null,stickers:[],stickerSets:[],stickerPack:null,
    stickerTab:'recent',stickerVisible:16,stickerEpoch:0,stickerQuery:'',
    stickerPreviewUrls:new Map(),recording:null,lastRichFailure:null,
    voicePreset:'original',voiceDraft:null,voicePermissionGeneration:0,autoPages:0,
    threadCache:new Map(),syncTimer:null,syncBusy:false,syncFailures:0,lastSyncedAt:null,syncRunId:0,
    threadSearch:'',threadSearchIndex:0,deliveryStage:null,
    intelResults:[],intelTimeline:[],intelQuery:'',intelEpoch:0,intelBusy:false,
    intelNextPage:null,intelIncludeVault:false,intelCoverage:null,intelFocus:null,
  };
  let chatFilterTimer=null;
  const labels={
    private:'личный чат',group:'группа',channel:'канал',bot:'бот',
    saved:'избранное',copy:'сохранённая копия VETO',other:'чат',
  };
  const mediaLabels={
    photo:'▣ Фотография',video:'▹ Видео',audio:'♫ Аудио',
    document:'◫ Документ',voice:'◉ Голосовое',video_note:'◉ Видеосообщение',sticker:'☺ Стикер',
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
  function messageTime(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? '' : two(date.getHours())+':'+two(date.getMinutes());
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
    resetOwner();
    const signed=String(tg?.initData||'');
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
      if(signed!==String(tg?.initData||'')){resetOwner();throw new Error('Telegram-аккаунт изменился. Старые чаты скрыты.');}
      if(!response.ok||!data.ok){
        const error=new Error(data.error||'Не удалось получить переписки');
        error.httpStatus=response.status;
        throw error;
      }
      return data;
    }catch(err){
      if(err?.name==='AbortError')throw new Error('Telegram отвечает слишком долго. Попробуй ещё раз.');
      throw err;
    }finally{clearTimeout(timer);}
  }

  // Text sending is separate from the Business bot and its archive permissions.
  // The backend rechecks the Mini App owner, the MTProto owner and the dialog.
  async function sendChatRequest(chatId,message,nonce,replyTo=null){
    if(resetOwner())throw new Error('Telegram-аккаунт изменился');
    const signed=String(tg?.initData||'');
    if(!signed)throw new Error('Открой VETO из Telegram для отправки');
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),26000);
    try {
      const response=await fetch('/api/telegram-send',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':signed},
        body:JSON.stringify({action:'send_message',chatId,message,nonce,replyTo}),
        signal:abort.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(signed!==String(tg?.initData||'')){resetOwner();throw new Error('Telegram-аккаунт изменился. Не повторяй отправку без проверки.');}
      if(!response.ok || !data.ok){
        const error=new Error(data.error||'Telegram не подтвердил отправку.');
        error.uncertain=data.uncertain===true;
        throw error;
      }
      return data;
    }catch(error){
      if(error?.name==='AbortError'){
        const timed=new Error('Нет ответа от Telegram. Проверь, дошло ли сообщение, прежде чем повторять.');
        timed.uncertain=true;
        throw timed;
      }
      if(error instanceof TypeError) error.uncertain=true;
      throw error;
    }finally {clearTimeout(timer);}
  }

  function canSendInThread(chat){
    // Archive-only cards and channels are deliberately read-only. The
    // authenticated owner's existing peer is revalidated on the server.
    return Boolean(String(tg?.initData||'')===state.ownerInitData && chat && chat.serverCanSend !== false && !chat.archiveOnly && state.connectionProof?.verified
      && ['private','group','bot','saved'].includes(chat.type));
  }
  function renderSendComposer(){
    const form=$('telegramThreadComposer'),field=$('telegramThreadCompose'),button=$('telegramThreadSend');
    if(!form || !field || !button)return;
    const writable=canSendInThread(state.thread);
    const available=writable && !state.sendInFlight;
    for(const id of ['telegramThreadAttachButton','telegramThreadAudioButton','telegramThreadStickersButton']){
      if($(id))$(id).disabled=!available;
    }
    const voiceButton=$('telegramThreadRecordVoice');
    if(voiceButton){voiceButton.disabled=!writable || Boolean(state.pendingAttachment) || (state.sendInFlight&&!state.recording);
      voiceButton.classList.toggle('recording',Boolean(state.recording));
      voiceButton.textContent=state.recording?'■':'◉';
      voiceButton.title=state.recording?'Завершить запись и прослушать':'Записать голосовое';}

    form.classList.toggle('is-readonly',!writable);
    field.disabled=!writable; // The next draft is editable while the previous send is pending.
    const chatId=String(state.thread?.id||'');
    if(field.dataset.activeChat!==chatId){
      field.dataset.activeChat=chatId;
      field.value=state.drafts.get(chatId)||'';
    }
    field.placeholder=writable?'Сообщение':state.thread?.archiveOnly
      ?'Архивная копия · отправка недоступна'
      :'Подключи Telegram для отправки';
    field.style.height='auto';
    field.style.height=Math.min(135,Math.max(24,field.scrollHeight))+'px';
    field.maxLength=state.pendingAttachment?'1024':'4096';
    button.disabled=!available || (!field.value.trim()&&!state.pendingAttachment);
    button.textContent=state.sendInFlight?'◌':'➤';
    button.title=writable?'Отправить из собственного Telegram':'Отправка здесь недоступна';
    renderVoiceDraft();
  }

  async function sendOutgoing(){
    const chat=state.thread,field=$('telegramThreadCompose');
    if(!field || !canSendInThread(chat) || state.sendInFlight)return;
    const message=field.value.trim();
    if(state.pendingAttachment){await sendRichOutgoing('send_media');return;}
    if(!message || message.length>4096)return;
    const chatId=String(chat.id),ownerKey=state.ownerInitData;
    const savedRetry=state.lastSendFailure;
    const retry=savedRetry?.chatId===chatId && savedRetry.message===message;
    const nonce=retry?savedRetry.nonce:window.crypto?.randomUUID?.();
    if(!nonce){toast('Нужен защищённый HTTPS для отправки сообщений');return;}
    state.sendInFlight=true;
    state.lastSendFailure=null;
    setDeliveryStatus('sending',chatId,'text');
    // Immediate input handoff; server delivery is still confirmed asynchronously.
    field.value='';
    state.drafts.delete(chatId);
    const provisionalId='sending-'+nonce;
    state.messages.push({
      id:provisionalId,date:new Date().toISOString(),text:message,out:true,
      pending:true,edited:false,deleted:false,saved:false,
    });
    state.messages.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    renderMessages();
    renderSendComposer();
    try{
      const delivered=await sendChatRequest(chatId,message,nonce,state.replyTo?.id||null);
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();return;}
      if(String(state.thread?.id)===chatId){
        setDeliveryStatus('accepted',chatId,'text');
        state.messages=state.messages.filter(item=>String(item.id)!==provisionalId);
        if(Number.isSafeInteger(delivered.messageId)&&delivered.messageId>0){
          state.messages.push({
            id:delivered.messageId,date:new Date().toISOString(),
            text:message,out:true,sent:true,saved:false,
          });
          state.messages.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
        }
        // Never erase text the user has begun writing while awaiting Telegram.
        state.replyTo=null;renderReplyPreview();
        if(!field.value.trim())state.drafts.delete(chatId);
        touchRecentChat(chatId,message,new Date().toISOString());
        renderMessages();
        threadNotice('');
        // Replace any provisional timestamp with Telegram's own message and
        // restore exact ordering. No automatic retries or double sends.
        setTimeout(()=>{
          if(String(state.thread?.id)===chatId && !state.threadLoading && !state.sendInFlight)
            loadMessages({reset:true});
        },750);
      } else state.drafts.delete(chatId);
      try{tg?.HapticFeedback?.notificationOccurred('success');}catch{}
    }catch(error){
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();return;}
      // A send can succeed even if the HTTP confirmation is lost.
      // Retain the SAME random_id on deliberate retry, preventing duplicates.
      if(error.uncertain===true){
        state.lastSendFailure={chatId,message,nonce};
      }
      if(String(state.thread?.id)===chatId){
        setDeliveryStatus(error.uncertain?'uncertain':'failed',chatId,'text');
        state.messages=state.messages.filter(item=>String(item.id)!==provisionalId);
        if(!field.value.trim()){
          state.drafts.set(chatId,message);
          field.value=message;
        }else state.drafts.set(chatId,field.value);
        renderMessages();
        threadNotice(error.message+(error.uncertain?' · Повтор с тем же идентификатором.':''));
      }
      toast(error.message);
    }finally{
      if(ownerKey===state.ownerInitData){state.sendInFlight=false;renderSendComposer();}
    }
  }


  async function richRequest(action,payload={}){
    resetOwner();
    const signed=String(tg?.initData||'');
    if(!signed)throw new Error('Открой VetoTG внутри Telegram');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    try {
      const response=await fetch('/api/telegram-send',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':signed},
        body:JSON.stringify({action,...payload}),signal:controller.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(signed!==String(tg?.initData||'')){resetOwner();throw new Error('Telegram-аккаунт изменился. Проверь переписку.');}
      if(!response.ok || !data.ok){
        const error=new Error(data.error||'Telegram не подтвердил отправку.');
        error.uncertain=data.uncertain===true;
        throw error;
      }
      return data;
    }catch(error) {
      if(error?.name==='AbortError'||error instanceof TypeError){
        const uncertain=new Error('Нет подтверждения от Telegram. Проверь чат перед повторной отправкой.');
        uncertain.uncertain=true;
        throw uncertain;
      }
      throw error;
    }finally{clearTimeout(timer);}
  }
  function renderReplyPreview(){
    const box=$('telegramThreadReplyPreview'),text=$('telegramThreadReplyText');
    if(!box||!text)return;
    box.hidden=!state.replyTo;
    text.textContent=state.replyTo?.preview||'';
  }
  function renderAttachmentChip(){
    const chip=$('telegramThreadAttachmentChip'),label=$('telegramThreadAttachmentLabel');
    if(!chip||!label)return;
    chip.hidden=!state.pendingAttachment;
    const f=state.pendingAttachment;
    label.textContent=f?('◫ '+f.name+' · '+Math.ceil(f.size/1024)+' КБ'):'';
  }
  function readFileAsBase64(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
      reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  }
  function clearComposerExtras(){
    state.replyTo=null;
    state.pendingAttachment=null;
    if($('telegramThreadFileInput'))$('telegramThreadFileInput').value='';
    if($('telegramThreadAudioInput'))$('telegramThreadAudioInput').value='';
    renderReplyPreview();renderAttachmentChip();
    renderSendComposer();
  }
  // Delivery is uncertain after a network timeout: a deliberate retry for the
  // exact SAME file, caption, reply and chat reuses the nonce. Telegram can then
  // deduplicate instead of sending the media twice. Never retry automatically.
  function richSendIntent(action,chatId,pending,caption,replyTo,stickerId){
    return {
      action,chatId,file:pending?.file||pending||null,
      caption,replyTo,stickerId:action==='send_sticker'?String(stickerId?.id||stickerId):null,
      stickerSetId:action==='send_sticker'?(stickerId?.setId||null):null,
    };
  }
  function sameRichIntent(a,b){
    return Boolean(a&&b&&a.action===b.action&&a.chatId===b.chatId&&
      a.file===b.file&&a.caption===b.caption&&a.replyTo===b.replyTo&&
      a.stickerId===b.stickerId&&a.stickerSetId===b.stickerSetId);
  }
  async function sendRichOutgoing(action,attachmentOrIndex=null){
    const chat=state.thread,field=$('telegramThreadCompose');
    if(!canSendInThread(chat)||state.sendInFlight)return;
    const chatId=String(chat.id),ownerKey=state.ownerInitData;
    const replyTo=state.replyTo?.id||null;
    const voiceSend=action==='send_media' && attachmentOrIndex?.kind==='voice';
    const pending=action==='send_media'?(attachmentOrIndex||state.pendingAttachment):null;
    const caption=voiceSend?'':String(field?.value||'');
    const intent=richSendIntent(action,chatId,pending,caption,replyTo,attachmentOrIndex);
    const prior=state.lastRichFailure;
    const nonce=sameRichIntent(prior?.intent,intent) ? prior.nonce : window.crypto?.randomUUID?.();
    if(!nonce){toast('Нужен защищённый HTTPS');return;}
    state.lastRichFailure=null;
    state.sendInFlight=true;
    const deliveryKind=voiceSend?'voice':action==='send_sticker'?'sticker':'media';
    setDeliveryStatus('sending',chatId,deliveryKind);
    renderSendComposer();
    try {
      let request={chatId,nonce,replyTo};
      if(action==='send_media'){
        const file=pending?.file||pending;
        if(!file||file.size>2*1024*1024||file.size<1)
          throw new Error('Выбери файл не больше 2 МБ');
        const kind=pending?.kind||(['image/jpeg','image/png','image/webp'].includes(file.type)?'photo':'document');
        request={...request,kind,name:file.name,mime:file.type,base64:await readFileAsBase64(file),
          caption,duration:Number(pending?.duration||0)};
      }else if(action==='send_sticker')request={...request,
        stickerId:String(attachmentOrIndex?.id||attachmentOrIndex),
        ...(attachmentOrIndex?.setId?{setId:String(attachmentOrIndex.setId)}:{})};
      else return;
      // A file read can outlive both the original thread and the Telegram owner.
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();throw new Error('Аккаунт изменился. Отправка отменена.');}
      if(String(state.thread?.id)!==chatId)throw new Error('Чат изменился. Отправка отменена.');
      await richRequest(action,request);
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();return;}
      if(String(state.thread?.id)===chatId){
        const mediaTitle=action==='send_sticker'?'Стикер'
          :request.kind==='voice'?'Голосовое сообщение'
            :request.kind==='photo'?'Фотография':'Документ';
        touchRecentChat(chatId,request.caption||mediaTitle,new Date().toISOString());
        setDeliveryStatus('accepted',chatId,deliveryKind);
        if(field&&!voiceSend)field.value='';
        if(!voiceSend)state.drafts.delete(chatId);
        state.replyTo=null;state.pendingAttachment=null;
        if($('telegramThreadFileInput'))$('telegramThreadFileInput').value='';
        if($('telegramThreadAudioInput'))$('telegramThreadAudioInput').value='';
        if(voiceSend)dropVoiceDraft();
        closeStickerDrawer();
        renderReplyPreview();renderAttachmentChip();
        threadNotice('');
        // Confirm with authoritative history. No second send on any outcome.
        setTimeout(()=>{if(String(state.thread?.id)===chatId&&!state.threadLoading&&!state.sendInFlight)
          loadMessages({reset:true});},750);
      }
      try{tg?.HapticFeedback?.notificationOccurred('success')}catch{}
    }catch(error){
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();return;}
      if(error?.uncertain===true && String(state.thread?.id)===chatId)
        state.lastRichFailure={intent,nonce};
      if(String(state.thread?.id)===chatId){
        setDeliveryStatus(error?.uncertain?'uncertain':'failed',chatId,deliveryKind);
        const warning=error?.uncertain===true
          ?' · Проверь Telegram. При повторе того же файла используем тот же ID без создания дубля.'
          :'';
        threadNotice(error.message+warning);
        toast(error.message);
      }
      // Never automatically retry: server acknowledgement may be lost.
    }finally{
      if(ownerKey===state.ownerInitData){state.sendInFlight=false;renderSendComposer();}
    }
  }
  // Installed packs are fetched only after explicit user action, read from the
  // signed owner session and never written to persistent browser storage.
  function stickerRequestValid(chatId,ownerKey,epoch){
    return state.stickerEpoch===epoch&&ownerKey===state.ownerInitData&&
      ownerKey===String(tg?.initData||'')&&String(state.thread?.id)===chatId&&
      $('telegramThreadStickerDrawer')?.hidden===false;
  }
  function closeStickerDrawer(){
    state.stickerEpoch++;
    closeStickerDrawer();
  }
  function stickerShownItems(){
    const source=state.stickerTab==='recent'?state.stickers:state.stickerPack?.stickers||[];
    const q=state.stickerQuery.trim().toLocaleLowerCase();
    return q?source.filter(x=>String(x.emoji||'').toLocaleLowerCase().includes(q)):source;
  }
  function renderStickerDrawer(){
    const list=$('telegramThreadStickerList'),pane=$('telegramThreadStickerDrawer');
    if(!list||!pane||pane.hidden)return;
    const packs=state.stickerTab==='packs',pack=packs?state.stickerPack:null;
    const title=$('vetoStickerDrawerTitle');
    if(title)title.textContent=pack?.set?.title||'Стикеры Telegram';
    if($('vetoStickersBackPack'))$('vetoStickersBackPack').hidden=!pack;
    for(const btn of pane.querySelectorAll('[data-sticker-tab]')){
      btn.setAttribute('aria-pressed',String(btn.dataset.stickerTab===state.stickerTab));
    }
    const query=state.stickerQuery.trim().toLocaleLowerCase();
    if(packs&&!pack){
      const matching=state.stickerSets.filter(x=>
        (x.title+' '+x.shortName).toLocaleLowerCase().includes(query));
      list.classList.add('packs-mode');
      list.innerHTML=matching.length?matching.map(x=>
        '<button type="button" class="veto-sticker-pack-card" data-open-sticker-pack="'+safe(x.id)+'">'+
        '<span aria-hidden="true">▦</span><strong>'+safe(x.title)+'</strong><small>'+safe(x.count)+' шт.</small></button>'
      ).join(''):'<p>Нет установленных наборов. Добавь набор в Telegram и открой снова.</p>';
      if($('vetoStickersMore'))$('vetoStickersMore').hidden=true;
      return;
    }
    list.classList.remove('packs-mode');
    const filtered=stickerShownItems();
    const shown=filtered.slice(0,state.stickerVisible);
    list.innerHTML=shown.length?shown.map(x=>
      '<button type="button" data-send-sticker="'+safe(x.id)+'"'+
        (pack?' data-sticker-set-id="'+safe(pack.set.id)+'"':'')+
      ' aria-label="Отправить стикер '+safe(x.emoji||'')+'">'+
        (state.stickerPreviewUrls.get(String(x.id))
          ?'<img src="'+safe(state.stickerPreviewUrls.get(String(x.id)))+'" alt="Стикер Telegram" loading="lazy" />'
          :safe(x.emoji||'🎭'))+'</button>'
    ).join(''):'<p>Стикеров не найдено. Проверь запрос или набор.</p>';
    if($('vetoStickersMore'))$('vetoStickersMore').hidden=filtered.length<=state.stickerVisible;
    if(state.thread){
      const chatId=String(state.thread.id),ownerKey=state.ownerInitData,epoch=state.stickerEpoch;
      // No auto-fetch of large animated packs. Only the next visible 8 tiles.
      void fetchStickerPreviews(chatId,ownerKey,epoch,
        (state.stickerVisible>16?shown.slice(state.stickerVisible-8,state.stickerVisible)
          :shown.slice(0,8)).filter(x=>!state.stickerPreviewUrls.has(String(x.id))),
        pack?.set?.id||null);
    }
  }
  // Static WEBP previews only; other originals can still be sent by Telegram.
  // One owner-verified Telegram connection fetches all eight previews.
  // A bounded batch is much faster than connecting to Telegram per thumbnail.
  async function fetchStickerPreviews(chatId,ownerKey,epoch,items,setId=null){
    const selected=items.filter(x=>x?.id&&!state.stickerPreviewUrls.has(String(x.id))).slice(0,8);
    if(!selected.length||!stickerRequestValid(chatId,ownerKey,epoch))return;
    const ids=new Set(selected.map(x=>String(x.id)));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),19000);
    try{
      const response=await fetch('/api/telegram-sticker-previews',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':ownerKey},
        body:JSON.stringify({stickerIds:[...ids],...(setId?{setId}:{})}),
        signal:controller.signal,
      });
      if(!response.ok)return;
      const data=await response.json();
      if(!stickerRequestValid(chatId,ownerKey,epoch))return;
      for(const item of Array.isArray(data.images)?data.images:[]){
        const id=String(item?.id||''),encoded=String(item?.base64||'');
        if(!ids.has(id)||state.stickerPreviewUrls.has(id)||
          !encoded||encoded.length>218456||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))continue;
        try{
          const decoded=atob(encoded);
          if(!decoded.length||decoded.length>160*1024||
             decoded.slice(0,4)!=='RIFF'||decoded.slice(8,12)!=='WEBP')continue;
          if(!stickerRequestValid(chatId,ownerKey,epoch))return;
          const raw=Uint8Array.from(decoded,letter=>letter.charCodeAt(0));
          const href=URL.createObjectURL(new Blob([raw],{type:'image/webp'}));
          state.mediaUrls.push(href);state.stickerPreviewUrls.set(id,href);
          const button=[...$('telegramThreadStickerList')?.querySelectorAll('[data-send-sticker]')||[]]
            .find(node=>node.dataset.sendSticker===id);
          if(button?.isConnected){
            const img=document.createElement('img');img.src=href;img.alt='Стикер Telegram';
            img.loading='lazy';button.replaceChildren(img);
          }
        }catch{/* Invalid image remains an emoji fallback. */}
      }
    }catch{/* Telegram previews are optional; never block sticker sending. */}
    finally{clearTimeout(timer)}
  }
  async function selectStickerTab(tab){
    if(!['recent','packs'].includes(tab)||!state.thread)return;
    const pane=$('telegramThreadStickerDrawer'),list=$('telegramThreadStickerList');
    if(!pane||pane.hidden||!list)return;
    const epoch=++state.stickerEpoch,chatId=String(state.thread.id),ownerKey=state.ownerInitData;
    state.stickerTab=tab;state.stickerPack=null;state.stickerVisible=16;state.stickerQuery='';
    if($('vetoStickersSearch'))$('vetoStickersSearch').value='';
    const hadData=tab==='recent'?state.stickers.length:state.stickerSets.length;
    if(hadData){renderStickerDrawer();return;}
    list.textContent=tab==='recent'?'Загружаю недавние стикеры…':'Загружаю твои наборы Telegram…';
    try{
      const result=await richRequest(tab==='recent'?'recent_stickers':'sticker_sets',{chatId});
      if(!stickerRequestValid(chatId,ownerKey,epoch))return;
      if(tab==='recent')state.stickers=Array.isArray(result.stickers)?result.stickers:[];
      else state.stickerSets=Array.isArray(result.sets)?result.sets:[];
      renderStickerDrawer();
    }catch(error){
      if(stickerRequestValid(chatId,ownerKey,epoch))
        list.textContent='Не получилось загрузить стикеры: '+String(error.message||'Ошибка');
    }
  }
  async function openStickerPack(setId){
    if(!state.thread||state.stickerTab!=='packs')return;
    const ownerKey=state.ownerInitData,chatId=String(state.thread.id);
    const epoch=++state.stickerEpoch,list=$('telegramThreadStickerList');
    if(list)list.textContent='Загружаю набор стикеров…';
    try{
      const data=await richRequest('sticker_set',{chatId,setId});
      if(!stickerRequestValid(chatId,ownerKey,epoch))return;
      state.stickerPack={set:data.set,stickers:Array.isArray(data.stickers)?data.stickers:[]};
      state.stickerVisible=16;state.stickerQuery='';
      if($('vetoStickersSearch'))$('vetoStickersSearch').value='';
      renderStickerDrawer();
    }catch(error){
      if(stickerRequestValid(chatId,ownerKey,epoch)&&list)
        list.textContent='Набор не открылся: '+String(error.message||'Ошибка');
    }
  }
  async function openStickerDrawer(){
    if(!canSendInThread(state.thread)||state.sendInFlight)return;
    const pane=$('telegramThreadStickerDrawer');
    if(!pane)return;
    if(!pane.hidden){closeStickerDrawer();return;}
    pane.hidden=false;
    await selectStickerTab(state.stickerTab);
  }
  function dropVoiceDraft(){
    const draft=state.voiceDraft;
    if(draft?.url){try{URL.revokeObjectURL(draft.url)}catch{}}
    state.voiceDraft=null;
    const player=$('telegramThreadVoicePlayer');
    if(player){player.pause();player.removeAttribute('src');player.load();}
    renderVoiceDraft();
  }
  function renderVoiceDraft(){
    const status=$('telegramThreadVoiceStatus'),preview=$('telegramThreadVoicePreview');
    if(!status||!preview)return;
    status.hidden=!state.recording;
    preview.hidden=!state.voiceDraft;
    const duration=state.recording?Math.floor((Date.now()-state.recording.started)/1000):0;
    if(state.recording && $('telegramThreadVoiceTimer')){
      $('telegramThreadVoiceTimer').textContent='● '+String(Math.floor(duration/60)).padStart(2,'0')+
        ':'+String(duration%60).padStart(2,'0')+' · Нажми ■, чтобы закончить';
    }
    const draft=state.voiceDraft;
    if(draft && $('telegramThreadVoiceLabel')){
      $('telegramThreadVoiceLabel').textContent='♫ '+String(Math.ceil(draft.duration))+
        ' с · '+(draft.preset==='low'?'Низкий голос · Pitch':
        draft.preset==='high'?'Высокий голос · Pitch':
        draft.preset==='robot'?'Робот · эффект':
        draft.preset==='deep'?'Басы · EQ':draft.preset==='warm'?'Теплее':
        draft.preset==='radio'?'Радио':'Оригинал')+' · прослушай перед отправкой';
    }
    for(const btn of document.querySelectorAll('[data-chat-voice-preset]')){
      const active=btn.dataset.chatVoicePreset===state.voicePreset;
      btn.setAttribute('aria-pressed',String(active));
      btn.disabled=Boolean(state.recording);
    }
    if($('telegramThreadVoiceSend'))$('telegramThreadVoiceSend').disabled=Boolean(state.sendInFlight||!canSendInThread(state.thread));
  }
  // Processing is local. EQ changes tone, never claims to synthesize another
  // person's voice or perform real pitch/formant transformation.
  async function processedVoiceStream(microphone,preset){
    if(preset==='original')return {recordStream:microphone,close:()=>{}};
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Аудиоэффекты недоступны здесь. Выбери «Оригинал».');
    const context=new AudioCtx();
    const nodes=[];
    let oscillator=null;
    const close=()=>{
      try{oscillator?.stop()}catch{}
      for(const node of nodes){try{node.disconnect()}catch{}}
      void context.close().catch(()=>{});
    };
    try{
      if(context.state==='suspended')await context.resume();
      const source=context.createMediaStreamSource(microphone);
      const compressor=context.createDynamicsCompressor();
      const output=context.createMediaStreamDestination();
      nodes.push(source,compressor,output);
      compressor.threshold.value=-21;compressor.ratio.value=2.4;
      if(preset==='low'||preset==='high'){
        if(!context.audioWorklet||!window.AudioWorkletNode)
          throw new Error('Pitch эффекты не поддерживаются в этом Telegram. Выбери Робот или Оригинал.');
        await context.audioWorklet.addModule('/veto-voice-pitch-worklet.js');
        const shifter=new AudioWorkletNode(context,'veto-pitch-shifter',{
          numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],
          processorOptions:{factor:preset==='low'?.79:1.24},
        });
        nodes.push(shifter);
        source.connect(shifter);shifter.connect(compressor);
      }else if(preset==='robot'){
        // Audible ring-modulated robot voice, not EQ or an identity impersonation.
        const band=context.createBiquadFilter();
        band.type='highpass';band.frequency.value=140;
        const carrier=context.createGain(),depth=context.createGain();
        carrier.gain.value=0;depth.gain.value=.82;
        oscillator=context.createOscillator();
        oscillator.type='sine';oscillator.frequency.value=57;
        oscillator.connect(depth);depth.connect(carrier.gain);
        source.connect(band);band.connect(carrier);carrier.connect(compressor);
        nodes.push(band,carrier,depth,oscillator);
        oscillator.start();
      }else{
        const filter=context.createBiquadFilter();
        nodes.push(filter);
        if(preset==='radio'){
          filter.type='bandpass';filter.frequency.value=1600;filter.Q.value=.58;
        }else if(preset==='deep'){
          filter.type='lowshelf';filter.frequency.value=270;filter.gain.value=7;
        }else{
          filter.type='lowshelf';filter.frequency.value=420;filter.gain.value=3;
        }
        source.connect(filter);filter.connect(compressor);
      }
      compressor.connect(output);
      return {recordStream:output.stream,close};
    }catch(error){
      close();
      throw error;
    }
  }
  async function toggleVoiceRecording(){
    if(state.recording){
      clearTimeout(state.recording.timer);clearInterval(state.recording.tick);
      try{state.recording.recorder.stop()}catch{}
      return;
    }
    if(!canSendInThread(state.thread)||state.sendInFlight)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
      toast('Запись голоса недоступна в этом браузере Telegram');return;
    }
    const origin=String(state.thread.id),signed=String(tg?.initData||'');
    const generation=++state.voicePermissionGeneration;
    let stream,effect;
    try {
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(generation!==state.voicePermissionGeneration||document.hidden||
         String(state.thread?.id)!==origin||String(tg?.initData||'')!==signed){
        stream.getTracks().forEach(t=>t.stop());return;
      }
      const preset=state.voicePreset;
      effect=await processedVoiceStream(stream,preset);
      // A delayed AudioWorklet load must not record after switching users/chats.
      if(generation!==state.voicePermissionGeneration||document.hidden||
        String(state.thread?.id)!==origin||String(tg?.initData||'')!==signed){
        stream.getTracks().forEach(track=>track.stop());
        effect.close();return;
      }
      const preferred=['audio/ogg;codecs=opus','audio/webm;codecs=opus','audio/webm'];
      const mime=preferred.find(type=>MediaRecorder.isTypeSupported(type));
      if(!mime)throw new Error('В этом браузере нет подходящего аудиокодека');
      const recorder=new MediaRecorder(effect.recordStream,{mimeType:mime,audioBitsPerSecond:32000});
      const chunks=[],started=Date.now();
      recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
      recorder.onstop=()=>{
        stream.getTracks().forEach(track=>track.stop());
        effect.close();
        const item=state.recording;
        if(item?.recorder===recorder)state.recording=null;
        clearTimeout(item?.timer);clearInterval(item?.tick);
        const blob=new Blob(chunks,{type:mime.split(';')[0]});
        if(item&&!item.cancelled&&generation===state.voicePermissionGeneration&&
          String(state.thread?.id)===origin&&String(tg?.initData||'')===signed&&blob.size){
          if(blob.size>2*1024*1024){
            toast('Голосовое больше 2 МБ. Запиши короче.');
          }else{
            const ext=mime.startsWith('audio/ogg')?'ogg':'webm';
            const file=new File([blob],'voice-'+Date.now()+'.'+ext,{type:mime.split(';')[0]});
            dropVoiceDraft();
            const url=URL.createObjectURL(blob);
            state.voiceDraft={file,url,origin,duration:(Date.now()-started)/1000,preset};
            const player=$('telegramThreadVoicePlayer');
            if(player)player.src=url;
          }
        }
        renderVoiceDraft();renderSendComposer();
      };
      recorder.onerror=()=>{toast('Не удалось записать голосовое');};
      recorder.start(500);
      const timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},45000);
      const tick=setInterval(renderVoiceDraft,350);
      state.recording={recorder,stream,effect,timer,tick,started,cancelled:false,origin};
      renderSendComposer();
    }catch(error){
      stream?.getTracks().forEach(track=>track.stop());
      effect?.close();
      toast(error.message||'Микрофон недоступен');
    }
  }
  function cancelVoiceCapture(){
    state.voicePermissionGeneration++;
    if(state.recording){
      state.recording.cancelled=true;
      clearTimeout(state.recording.timer);clearInterval(state.recording.tick);
      try{state.recording.recorder.stop()}catch{}
    }
    dropVoiceDraft();
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
  function touchRecentChat(chatId,text,date){
    // Only update the already verified owner's in-memory preview; the next
    // server snapshot remains authoritative. No fake unread/read status.
    if(state.ownerInitData!==String(tg?.initData||''))return;
    const chat=state.chats.find(c=>String(c.id)===String(chatId));
    if(!chat||chat.archiveOnly)return;
    chat.preview=String(text||'').slice(0,180);
    chat.date=date||new Date().toISOString();
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
      grant_messages:'Подключи Business-бота для нужных личных чатов. Отмечать сообщения прочитанными для архива не нужно.',
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
      checkpoint('Сохранённый архив',privacy.savedChats>0)+'</div>'+
      '<div class="veto-mirror-evidence"><strong>'+safe(privacy.confirmedDeleted||0)+
      '</strong><span>подтверждённых удалений</span><strong>'+safe(privacy.savedChats||0)+
      '</strong><span>сохранённых диалогов</span></div>'+
      '<p>'+safe(next[privacy.nextAction]||next.unavailable)+
      (Number(privacy.retentionDays)>0?' · Срок хранения: '+safe(privacy.retentionDays)+' дн.':'')+
      '</p><button type="button" data-mirror-privacy-setup="1">'+
      (configured?'Проверить настройки':'Настроить Privacy')+' ↗</button>';
  }
  // Search is explicit owner-authorized retrieval. Never store query or
  // message text outside this tab, and never represent keyword evidence as LLM.
  function clearIntelSearch({close=false}={}){
    state.intelEpoch++;
    state.intelBusy=false;state.intelResults=[];state.intelTimeline=[];state.intelQuery='';
    state.intelNextPage=null;state.intelIncludeVault=false;state.intelCoverage=null;state.intelFocus=null;
    if($('vetoIntelLoadMore'))$('vetoIntelLoadMore').hidden=true;
    if($('vetoIntelIncludeVault'))$('vetoIntelIncludeVault').checked=false;
    if($('vetoIntelTimeline'))$('vetoIntelTimeline').replaceChildren();
    if($('vetoIntelTimelineSection'))$('vetoIntelTimelineSection').hidden=true;
    if($('vetoIntelSearchInput'))$('vetoIntelSearchInput').value='';
    if($('vetoIntelSearchResults'))$('vetoIntelSearchResults').replaceChildren();
    if($('vetoIntelSearchStatus'))$('vetoIntelSearchStatus').textContent=
      'Облачный Telegram. Сохранённые копии VETO Vault доступны только при отдельном выборе.';
    if($('vetoIntelSearchSubmit'))$('vetoIntelSearchSubmit').disabled=false;
    if(close){
      if($('vetoIntelSearchPanel'))$('vetoIntelSearchPanel').hidden=true;
      $('vetoIntelSearchToggle')?.setAttribute('aria-expanded','false');
    }
  }
  function renderIntelResults(){
    const box=$('vetoIntelSearchResults');
    if(!box)return;
    box.innerHTML=state.intelResults.map((result,index)=>{
      const date=result.date?new Date(result.date):null;
      const validDate=date&&!Number.isNaN(date.getTime())
        ?date.toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'}):'Без даты';
      return '<article class="veto-intelligence-hit">'+
        '<div class="veto-intelligence-hit-head"><strong>'+safe(result.chatTitle||'Telegram чат')+'</strong>'+
        '<time>'+safe(validDate)+'</time></div>'+
        '<p>'+safe(result.snippet||'')+'</p>'+
        '<div class="veto-intelligence-hit-foot"><small>'+
        (result.source==='veto-vault'?'↶ Сохранённая копия VETO':result.saved?'✓ Telegram + копия VETO':'Telegram')+
        (result.deleted?' · удалено после сохранения':'')+
        ' · #'+safe(result.messageId)+' · '+(result.out?'Исходящее':'Входящее')+'</small>'+
        '<button type="button" data-veto-intel-open="'+index+'">Открыть чат ↗</button></div>'+
        '</article>';
    }).join('');
  }
  function renderIntelTimeline(){
    const section=$('vetoIntelTimelineSection'),list=$('vetoIntelTimeline');
    if(!section||!list)return;
    const entries=state.intelTimeline.filter(item=>
      state.intelResults.some(result=>
        String(result.chatId)===String(item.chatId)&&
        String(result.messageId)===String(item.messageId)));
    section.hidden=!entries.length;
    list.innerHTML=entries.map(item=>{
      const index=state.intelResults.findIndex(result=>
        String(result.chatId)===String(item.chatId)&&
        String(result.messageId)===String(item.messageId));
      const date=new Date(item.date);
      const stamp=Number.isNaN(date.getTime())?'Без даты':
        date.toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'});
      return '<article class="veto-intel-event">'+
        '<div class="veto-intel-event-date"><time>'+safe(stamp)+'</time><span>ВОЗМОЖНОЕ ОБЕЩАНИЕ</span></div>'+
        '<strong>'+safe(item.sender||item.chatTitle||'Собеседник неизвестен')+'</strong>'+
        '<blockquote>'+safe(item.snippet||'')+'</blockquote>'+
        '<div><small>'+safe(item.chatTitle||'Telegram чат')+
        ' · сообщение #'+safe(item.messageId)+
        (item.deleted?' · сохранено до удаления':'')+'</small>'+
        '<button type="button" data-veto-intel-open="'+index+'">Открыть чат ↗</button></div>'+
        '</article>';
    }).join('');
  }
  // A continuation merges results from explicit previous page(s) in RAM only.
  function appendIntelResults(incoming=[]){
    const byId=new Map(state.intelResults.map(item=>[String(item.chatId)+'/'+item.messageId,item]));
    for(const item of incoming){
      if(!item?.chatId||!Number.isSafeInteger(Number(item.messageId)))continue;
      const key=String(item.chatId)+'/'+item.messageId,previous=byId.get(key);
      if(!previous)byId.set(key,item);
      else if(item.source==='veto-vault'&&previous.source!=='veto-vault'){
        byId.set(key,{...previous,saved:true,deleted:Boolean(item.deleted),
          source:'telegram-cloud+veto-vault',
          vaultOffset:Number.isSafeInteger(item.vaultOffset)?item.vaultOffset:previous.vaultOffset,
          possibleCommitment:previous.possibleCommitment||item.possibleCommitment});
      }else if(Number(item.score||0)>Number(previous.score||0))byId.set(key,item);
    }
    state.intelResults=[...byId.values()].sort((a,b)=>
      Number(b.score||0)-Number(a.score||0)||
      (Date.parse(b.date||'')||0)-(Date.parse(a.date||'')||0)).slice(0,150);
  }
  async function searchIntel({loadMore=false}={}){
    const input=$('vetoIntelSearchInput'),status=$('vetoIntelSearchStatus'),button=$('vetoIntelSearchSubmit');
    if(!input||!status||!button||state.intelBusy)return;
    if(resetOwner())return;
    const query=String(input.value||'').trim().replace(/\s+/g,' ');
    if(query.length<3||query.length>180){
      status.textContent='Введи от 3 до 180 символов.';return;
    }
    if(!state.connectionProof?.verified){
      status.textContent='Подключи и подтверди свой Telegram для поиска.';return;
    }
    const includeVault=$('vetoIntelIncludeVault')?.checked===true;
    if(loadMore&&(!includeVault||!state.intelIncludeVault||
      query!==state.intelQuery||state.intelNextPage===null)){
      status.textContent='Параметры поиска изменились. Нажми «Найти», чтобы начать заново.';return;
    }
    const vaultPage=loadMore?state.intelNextPage:0;
    const ownerKey=state.ownerInitData,epoch=++state.intelEpoch;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    state.intelBusy=true;
    if(!loadMore){
      state.intelQuery=query;state.intelIncludeVault=includeVault;
      state.intelNextPage=null;state.intelCoverage=null;
      state.intelResults=[];state.intelTimeline=[];
    }
    if($('vetoIntelLoadMore'))$('vetoIntelLoadMore').hidden=true;
    if(!loadMore){
      if($('vetoIntelTimeline'))$('vetoIntelTimeline').replaceChildren();
      if($('vetoIntelTimelineSection'))$('vetoIntelTimelineSection').hidden=true;
      $('vetoIntelSearchResults')?.replaceChildren();
    }
    button.disabled=true;
    status.textContent=loadMore
      ?'Проверяю следующую порцию твоего сохранённого архива…'
      :'Ищу исходные сообщения в твоём Telegram…';
    try{
      const response=await fetch('/api/telegram-intelligence-search',{
        method:'POST',headers:{
          'content-type':'application/json','x-telegram-init-data':ownerKey,
        },body:JSON.stringify({query,includeVault,vaultPage}),signal:controller.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(resetOwner()||epoch!==state.intelEpoch||
        ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||''))return;
      if(!response.ok||!data.ok)throw new Error(data.error||'Telegram не ответил');
      appendIntelResults(Array.isArray(data.results)?data.results:[]);
      const items=Array.isArray(data.timeline)?data.timeline:[];
      const timelines=new Map([...state.intelTimeline,...items]
        .map(item=>[String(item.chatId)+'/'+item.messageId,item]));
      state.intelTimeline=[...timelines.values()].sort((a,b)=>
        (Date.parse(a.date||'')||0)-(Date.parse(b.date||'')||0)).slice(0,100);
      const coverage=data.coverage||{};
      state.intelCoverage=coverage;
      state.intelNextPage=includeVault&&Number.isSafeInteger(data.nextVaultPage)
        ?data.nextVaultPage:null;
      const count=state.intelResults.length;
      const vaultText=includeVault
        ?coverage.vault==='sampled'
          ?' Эта порция: '+Number(coverage.segmentStart||0)+'–'+
            Number(coverage.segmentEnd||0)+' из '+Number(coverage.totalSegments||0)+
            ' · проверено '+Number(coverage.scannedMessages||0)+' сохранённых сообщений.'
          :' Архив VETO временно недоступен.'
        :' Архив VETO не запрашивался.';
      const partial=coverage.partial?' Поиск по архиву ещё не завершён.':'';
      status.textContent=(count
        ?'Найдено '+count+' реальных сообщений. «Обещания» — гипотезы, проверяй контекст.'
        :'Пока нет совпадений в проверенной части. Это не доказывает отсутствие переписки.')+
        vaultText+partial;
      if($('vetoIntelLoadMore'))$('vetoIntelLoadMore').hidden=state.intelNextPage===null;
      renderIntelResults();renderIntelTimeline();
    }catch(error){
      if(epoch!==state.intelEpoch||ownerKey!==state.ownerInitData)return;
      status.textContent=error?.name==='AbortError'
        ?'Поиск отвечает слишком долго. Проверь подключение и повтори вручную.'
        :String(error.message||'Поиск недоступен');
    }finally{
      clearTimeout(timer);
      if(epoch===state.intelEpoch&&ownerKey===state.ownerInitData){
        state.intelBusy=false;button.disabled=false;
      }
    }
  }
  function renderChats(){
    const list=$('telegramMirrorList');
    if(!list)return;
    const items=filteredChats();
    const extendedFilter=!['all','private','unread'].includes(state.filter);
    if(extendedFilter&&$('telegramMirrorFilters')){
      $('telegramMirrorFilters').dataset.expanded='true';
      $('vetoMessengerFiltersToggle')?.setAttribute('aria-expanded','true');
    }
    // Connected users see their dialogues first. Diagnostic configuration is
    // still available from Tools, not occupying the message list.
    const ready=state.connectionProof?.verified===true;
    $('telegramMirror')?.classList.toggle('veto-messenger-ready',ready);
    if($('vetoMessengerConnectCta'))$('vetoMessengerConnectCta').hidden=ready;
    renderPrivacyDiagnostics();
    $('telegramMirrorCount').textContent=String(state.chats.length);
    const proof=$('telegramMirrorAccountProof');
    const drawer=$('telegramMirrorAccessDrawer');
    const drawerStatus=$('telegramMirrorAccessDrawerStatus');
    if (drawerStatus) drawerStatus.textContent=state.connectionProof?.verified
      ? 'Telegram подключён · ↶ архив отдельно'
      : 'Нужно подключить Telegram';
    // Keep setup discoverable when login isn't verified, out of the way for
    // an already linked user reading chats on a small mobile screen.
    if (drawer && !drawer.dataset.userToggled) drawer.open=false; // on-demand setup, not the messenger's first screen
    if(proof){
      const p=state.connectionProof;
      proof.classList.toggle('ready',p?.verified===true);
      proof.classList.toggle('archive-only',Boolean(p)&&!p.verified);
      proof.textContent=p?.verified
        ?'✓ Подтверждён Telegram '+(p.username?'@'+p.username:p.accountName||'владельца')+' · чаты только этого аккаунта'
        :p ? '◈ Только собственный архив VETO · живой аккаунт не подтверждён' : '◌ Проверяю личный Telegram · чужие чаты не показываются';
    }
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
    resetOwner();
    if(state.loading)return;
    const generation=++state.generation;
    // Keep the verified, in-memory conversation list visible during a same-
    // account refresh. Fresh data atomically replaces it only on success.
    // Never reuse it across changed owners or unauthenticated sessions.
    const keepVisible=Boolean(reset&&state.connectionProof?.verified&&state.chats.length&&
      state.ownerInitData===String(tg?.initData||''));
    if(reset){
      state.page=0;state.autoPages=0;state.hasMore=true;
      if(!keepVisible){state.chats=[];state.connectionProof=null;}
      hideNotice();
    }
    if(!state.hasMore)return;
    state.loading=true;
    if(keepVisible){
      const stamp=$('telegramMirrorUpdated');
      if(stamp)stamp.textContent='↻ Обновляю · чаты доступны';
      $('telegramMirrorRefresh')?.classList.add('is-refreshing');
      $('telegramMirrorRefresh')?.setAttribute('aria-busy','true');
    }else renderChats();
    try{
      const data=await request('list',{page:state.page});
      if(generation!==state.generation)return;
      // Atomic replacement prevents stale previews, unread badges and
      // vanished chats from leaking into the newly verified server snapshot.
      if(keepVisible)state.chats=[];
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
      if(data.connection?.verified)state.lastListFetchedAt=Date.now();
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
      if(generation!==state.generation)return;
      const authenticated=state.ownerInitData===String(tg?.initData||'');
      // Temporary Telegram/transport outages are not an authentication
      // failure. Keep already verified RAM-only chats visible, with an honest
      // stale-data notice and a manual retry. 401/403/409 fail closed.
      const status=Number(error?.httpStatus||0);
      const transient=status===429||status>=500||(!status&&
        /долго|сети|соединени|не удалось|не ответил/i.test(String(error?.message||'')));
      if(keepVisible&&authenticated&&transient){
        state.hasMore=true;state.page=0;
        showNotice('Пока нет свежего ответа Telegram. Показаны ранее загруженные чаты этого аккаунта; для обновления нажми ↻. '+error.message);
        return;
      }
      // Authentication and ownership failures must never leave old chats on screen.
      state.chats=[];state.hasMore=false;state.connectionProof=null;
      state.thread=null;state.messages=[];
      $('telegramThreadView').hidden=true;
      $('telegramChatsView').hidden=false;
      $('telegramMirror')?.classList.remove('thread-mode');
      window.VetoThemeDock?.('inbox');
      revokeMediaUrls();
      if($('telegramMirrorAccessButton')){
        $('telegramMirrorAccessButton').textContent = 'Подключить ↗';
      }
      showNotice(error.message,/Подключи|подключён|Открой VETO|аккаунт|авторизуй/i.test(error.message));
    }finally{
      if(generation===state.generation){
        state.loading=false;
        $('telegramMirrorRefresh')?.classList.remove('is-refreshing');
        $('telegramMirrorRefresh')?.removeAttribute('aria-busy');
        renderChats();
      }
    }
  }
  async function photoRequest(action,chatId,messageId=null){
    if(!tg?.initData)throw new Error('Telegram Mini App требуется');
    const signed=String(tg.initData),generation=state.generation;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    try{
      const response=await fetch('/api/telegram-chat-media',{
        method:'POST',headers:{
          'content-type':'application/json','x-telegram-init-data':signed,
        },body:JSON.stringify({action,chatId,messageId}),signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram не отдаёт изображение');
      const blob=await response.blob();
      if(generation!==state.generation||signed!==String(tg?.initData||'')){resetOwner();throw new Error('Сменился Telegram-аккаунт');}
      if(!blob.size||blob.size>4*1024*1024||!blob.type.startsWith('image/'))
        throw new Error('Изображение недоступно');
      return URL.createObjectURL(blob);
    }finally{clearTimeout(timer);}
  }
  // At most one MTProto avatar request in flight, and six per app session:
  // never attempt to download hundreds of profile photos when browsing dialogs.
  function queueVisibleAvatars(){
    if(!tg?.initData||state.avatarLoaded>=6)return;
    const visible=[...document.querySelectorAll('[data-veto-avatar]')]
      .filter(el=>!state.avatarUrls.has(el.dataset.vetoAvatar))
      .slice(0,6-state.avatarLoaded);
    for(const el of visible){
      const id=String(el.dataset.vetoAvatar||'');
      if(!id||state.avatarRequested.has(id))continue;
      state.avatarRequested.add(id);
      state.avatarQueue.push(id);
    }
    runAvatarQueue();
  }
  function runAvatarQueue(){
    while(state.avatarActive<1&&state.avatarQueue.length&&state.avatarLoaded<6){
      const id=state.avatarQueue.shift();
      state.avatarActive++;state.avatarLoaded++;
      photoRequest('avatar',id).then(href=>{
        state.avatarUrls.set(id,href);
        for(const el of document.querySelectorAll('[data-veto-avatar]')){
          if(el.dataset.vetoAvatar!==id)continue;
          const img=document.createElement('img');
          img.className='veto-mirror-avatar-img';img.alt='';img.src=href;
          el.replaceChildren(img);
        }
      }).catch(()=>{}).finally(()=>{
        state.avatarActive--;runAvatarQueue();
      });
    }
  }
  function rememberPreview(messageId,href){
    state.mediaPreviewUrls.set(String(messageId),href);
    state.mediaUrls.push(href);
  }
  function photoButtonMarkup(href,messageId,label){
    return '<button type="button" class="veto-mirror-inline-photo-btn" data-mirror-photo="'+safe(messageId)+
      '" aria-label="Развернуть фотографию" title="Увеличить фото">'+
      '<img class="veto-mirror-inline-photo" src="'+safe(href)+'" alt="'+safe(label)+'" loading="lazy" /></button>';
  }
  function closePhotoViewer(){
    const dialog=$('telegramThreadPhotoDialog');
    if(!dialog)return;
    if(typeof dialog.close==='function' && dialog.open)dialog.close();
    else dialog.removeAttribute('open');
    if($('telegramThreadPhotoFull'))$('telegramThreadPhotoFull').removeAttribute('src');
    if($('telegramThreadPhotoSave'))$('telegramThreadPhotoSave').removeAttribute('href');
  }
  function openPhotoViewer(messageId){
    if(resetOwner()||!state.thread)return;
    const href=state.mediaPreviewUrls.get(String(messageId));
    if(!href||!state.mediaUrls.includes(href)||!href.startsWith('blob:'))return;
    const dialog=$('telegramThreadPhotoDialog'),img=$('telegramThreadPhotoFull');
    const save=$('telegramThreadPhotoSave');
    if(!dialog||!img||!save)return;
    img.src=href;
    save.href=href;save.download='veto-chat-photo-'+String(messageId)+'.jpg';
    if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
    else dialog.setAttribute('open','');
  }
  function inlineImage(message){
    if(message?.media!=='photo')return '';
    const cached=state.mediaPreviewUrls.get(String(message.id));
    if(cached)return photoButtonMarkup(cached,message.id,'Фото из переписки');
    return '<button type="button" class="veto-mirror-inline-placeholder" data-mirror-preview="'+
      safe(message.id)+'" aria-label="Загрузить фото из переписки"><span>▣</span>'+
      '<small>Фотография · нажми для загрузки</small></button>';
  }
  // Lazy bounded preview: only three images per thread load; no media is
  // persisted outside the browser tab and all blob URLs are revoked on exit.
  function photoInViewport(el,scroller){
    const item=el.getBoundingClientRect(),box=scroller.getBoundingClientRect();
    return item.bottom>box.top-200&&item.top<box.bottom+200;
  }
  // Only fetch photos the owner scrolls into view. Bounded concurrency avoids
  // multiple expensive MTProto connections on a low-memory Telegram WebView.
  // The owner can tap an unavailable thumbnail to retry deliberately.
  function loadInlinePreviews({requestedId=null}={}){
    const scroller=$('telegramThreadMessages');
    if(!state.thread||!tg?.initData||!scroller)return;
    const all=[...scroller.querySelectorAll('[data-mirror-preview]')];
    const targets=requestedId!==null
      ?all.filter(el=>String(el.dataset.mirrorPreview)===String(requestedId))
      :all.filter(el=>photoInViewport(el,scroller));
    for(const el of targets){
      if(state.previewActive>=2)break;
      const id=Number(el.dataset.mirrorPreview);
      if(!Number.isSafeInteger(id)||id<1||state.previewSeen.has(id)||state.previewInflight.has(id))continue;
      const msg=state.messages.find(m=>Number(m.id)===id);
      if(!msg || (msg.deleted&&!msg.mediaAvailable))continue;
      state.previewSeen.add(id);
      state.previewInflight.add(id);
      state.previewActive++;
      const badge=el.querySelector('small');
      if(badge)badge.textContent='Загружаю фотографию…';
      const ownerChatId=String(state.thread.id),ownerKey=state.ownerInitData;
      const generation=state.threadGeneration,previewEpoch=state.previewEpoch;
      const request=msg.saved&&msg.mediaAvailable
        ?(async()=>{
            const res=await fetch('/api/privacy-media?'+
              new URLSearchParams({chatId:ownerChatId,messageId:String(id)}),{
                headers:{'x-telegram-init-data':ownerKey},
              });
            if(!res.ok)throw new Error('private_photo_unavailable');
            const blob=await res.blob();
            if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')||generation!==state.threadGeneration)
              throw new Error('Telegram account changed');
            if(!blob.size||blob.size>4*1024*1024||!blob.type.startsWith('image/'))
              throw new Error('private_photo_unavailable');
            return URL.createObjectURL(blob);
          })()
        :photoRequest('photo',ownerChatId,id);
      request.then(href=>{
        if(generation!==state.threadGeneration||String(state.thread?.id)!==ownerChatId||
           ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){
          URL.revokeObjectURL(href);return;
        }
        rememberPreview(id,href);
        const container=[...scroller.querySelectorAll('[data-mirror-preview]')]
          .find(x=>Number(x.dataset.mirrorPreview)===id);
        if(container){
          const btn=document.createElement('button');
          btn.type='button';btn.className='veto-mirror-inline-photo-btn';
          btn.dataset.mirrorPhoto=String(id);btn.setAttribute('aria-label','Развернуть фотографию');
          const img=document.createElement('img');img.className='veto-mirror-inline-photo';
          img.alt='Фото из переписки';img.loading='lazy';img.src=href;
          btn.appendChild(img);container.replaceWith(btn);
        }
      }).catch(()=>{
        // Do not loop after a network failure. A manual tap explicitly retries.
        if(generation===state.threadGeneration&&ownerKey===state.ownerInitData){
          const latest=[...scroller.querySelectorAll('[data-mirror-preview]')]
            .find(x=>Number(x.dataset.mirrorPreview)===id);
          const label=latest?.querySelector('small');
          if(label)label.textContent='Не удалось загрузить · нажми повторно';
        }
      }).finally(()=>{
        if(previewEpoch!==state.previewEpoch)return;
        state.previewInflight.delete(id);
        state.previewActive=Math.max(0,state.previewActive-1);
        if(ownerKey===state.ownerInitData&&generation===state.threadGeneration)
          loadInlinePreviews();
      });
    }
  }

  // Telegram's MTProto acceptance is not equivalent to a delivered/read receipt.
  // These per-thread statuses never claim that another user has seen a message.
  function renderDeliveryStatus(){
    const bar=$('telegramThreadDeliveryStatus'),text=$('telegramThreadDeliveryText'),icon=$('telegramThreadDeliveryIcon');
    if(!bar||!text||!icon)return;
    const info=state.deliveryStage;
    const valid=Boolean(info&&String(state.thread?.id)===info.chatId&&
      state.ownerInitData===String(tg?.initData||''));
    bar.hidden=!valid;
    if(!valid){bar.removeAttribute('data-state');return;}
    bar.dataset.state=info.stage;
    const messages={
      sending:'Отправляю в Telegram…',
      accepted:'Telegram принял отправку · это не означает, что сообщение прочитано.',
      uncertain:'Нет подтверждения. Проверь оригинальный Telegram перед повтором.',
      failed:'Отправка не выполнена · проверь чат или подключение.',
    };
    text.textContent=(info.kind==='voice'?'Голосовое · ':info.kind==='media'?'Файл · ':info.kind==='sticker'?'Стикер · ':'')+
      (messages[info.stage]||'Статус неизвестен');
    icon.textContent={sending:'◌',accepted:'✓',uncertain:'!',failed:'×'}[info.stage]||'◌';
  }
  function setDeliveryStatus(stage,chatId,kind='text'){
    if(String(state.thread?.id)!==chatId||state.ownerInitData!==String(tg?.initData||''))return;
    state.deliveryStage={stage,chatId,kind};
    renderDeliveryStatus();
  }
  function threadNotice(text){
    const el=$('telegramThreadNotice');
    if(!el)return;
    el.hidden=!text;
    el.textContent=String(text||'');
  }
  // Privacy: Telegram WebView can switch an account while old network
  // requests are in flight. Invalidate generations before any stale reply
  // is rendered or reused. Never persist message drafts across owners.
  function resetOwner(){
    const current=String(tg?.initData||'');
    if(current===state.ownerInitData)return false;
    closePhotoViewer();
    state.ownerInitData=current;
    state.deliveryStage=null;renderDeliveryStatus();
    state.generation++;state.threadGeneration++;state.voicePermissionGeneration++;
    cancelVoiceCapture();
    stopThreadSync();
    state.syncRunId++; // stale poll completions must not unlock another owner's sync
    state.threadCache.clear();
    state.syncFailures=0;state.syncBusy=false;
    state.chats=[];state.messages=[];state.thread=null;
    clearTimeout(chatFilterTimer);chatFilterTimer=null;
    closeVetoMessengerTools();
    clearIntelSearch({close:true});
    state.page=0;state.hasMore=true;state.autoPages=0;state.lastListFetchedAt=0;
    state.connectionProof=null;state.loading=false;state.threadLoading=false;
    state.sendInFlight=false;state.lastSendFailure=null;state.lastRichFailure=null;
    state.drafts.clear();state.pendingAttachment=null;state.replyTo=null;
    state.stickers=[];state.stickerSets=[];state.stickerPack=null;
    state.stickerTab='recent';state.stickerQuery='';state.stickerVisible=16;state.stickerEpoch++;
    closeStickerDrawer();
    if($('telegramThreadStickerList'))$('telegramThreadStickerList').replaceChildren();
    if($('vetoStickerDrawerTitle'))$('vetoStickerDrawerTitle').textContent='Стикеры Telegram';
    if($('vetoStickersSearch'))$('vetoStickersSearch').value='';
    state.filter='all';state.search='';state.threadSearch='';state.threadSearchIndex=0;
    if($('vetoMessengerIntelArea'))$('vetoMessengerIntelArea').hidden=true;
    if($('telegramMirrorFilters'))$('telegramMirrorFilters').dataset.expanded='false';
    if($('vetoMessengerFiltersToggle'))$('vetoMessengerFiltersToggle').setAttribute('aria-expanded','false');
    if($('telegramThreadFind'))$('telegramThreadFind').hidden=true;
    if($('telegramThreadFindInput'))$('telegramThreadFindInput').value='';
    if($('telegramThreadSearchToggle'))$('telegramThreadSearchToggle').setAttribute('aria-expanded','false');
    const input=$('telegramThreadCompose');
    if(input){input.value='';input.dataset.activeChat='';}
    for(const id of ['telegramThreadFileInput','telegramThreadAudioInput']){
      if($(id))$(id).value='';
    }
    if($('telegramMirrorSearch'))$('telegramMirrorSearch').value='';
    if($('telegramThreadMessages'))$('telegramThreadMessages').replaceChildren();
    if($('telegramMirrorList'))$('telegramMirrorList').replaceChildren();
    if($('telegramThreadView'))$('telegramThreadView').hidden=true;
    if($('telegramChatsView'))$('telegramChatsView').hidden=false;
    $('telegramMirror')?.classList.remove('thread-mode');
    // Restore the five-tab inbox after an identity switch; a stale fullscreen
    // thread class must never strand the next Telegram owner without navigation.
    window.VetoThemeDock?.('inbox');
    state.avatarQueue=[];state.avatarRequested.clear();state.avatarLoaded=0;
    state.avatarUrls.forEach(href=>{try{URL.revokeObjectURL(href)}catch{}});
    state.avatarUrls.clear();
    revokeMediaUrls();
    renderSendComposer();renderChats();
    showNotice('Telegram-аккаунт изменился. Чаты предыдущего аккаунта скрыты. Нажми ↻.');
    return true;
  }

  function revokeMediaUrls(){
    closePhotoViewer();
    for(const media of $('telegramThreadMessages')?.querySelectorAll('audio,video')||[])media.pause();
    state.mediaUrls.forEach(value=>{try{URL.revokeObjectURL(value);}catch{}});
    state.mediaUrls=[];
    state.stickerPreviewUrls.clear();
    state.mediaPreviewUrls.clear();state.previewSeen.clear();state.previewInflight.clear();
    state.previewEpoch++;state.previewActive=0;
    state.expandedAttachments.clear();state.expandedBytes=0;
  }
  function expandedFileButton(id,archive){
    const btn=document.createElement('button');
    btn.type='button';btn.className='veto-mirror-open-vault';
    if(archive)btn.dataset.mirrorFile=String(id);
    else btn.dataset.mirrorLiveFile=String(id);
    btn.textContent=archive?'Открыть сохранённый файл ↗':'Открыть файл из Telegram ↗';
    return btn;
  }
  // A downloaded file belongs to this open owner/thread only. The entire
  // bounded in-memory media gallery is released on Back or account switch.
  function cacheExpandedAttachment(button,id,blob,archive){
    const key=String(id);
    if(state.expandedAttachments.has(key))return;
    const href=URL.createObjectURL(blob);
    state.mediaUrls.push(href);
    const wrapper=document.createElement('div');
    wrapper.className='veto-mirror-media-reveal';
    const mime=String(blob.type||'application/octet-stream').toLowerCase();
    if(['image/jpeg','image/png','image/webp','image/gif'].includes(mime)){
      const thumb=document.createElement('button');thumb.type='button';
      thumb.className='veto-mirror-inline-photo-btn';thumb.dataset.mirrorPhoto=key;
      thumb.setAttribute('aria-label','Развернуть фото');
      const img=document.createElement('img');
      img.src=href;img.alt=archive?'Фото из сохранённой копии':'Фото из Telegram';
      img.loading='lazy';thumb.appendChild(img);wrapper.appendChild(thumb);
      state.mediaPreviewUrls.set(key,href);
    }else if(mime.startsWith('audio/')){
      const audio=document.createElement('audio');
      audio.controls=true;audio.preload='metadata';audio.src=href;
      audio.setAttribute('aria-label',archive?'Сохранённое аудио из VETO Vault':'Аудиосообщение из Telegram');
      wrapper.appendChild(audio);
    }else if(['video/mp4','video/webm'].includes(mime)){
      const video=document.createElement('video');
      video.src=href;video.controls=true;video.preload='metadata';
      wrapper.appendChild(video);
    }
    const link=document.createElement('a');
    link.href=href;link.download=(archive?'telegram-veto-':'storylab-attachment-')+key;
    link.textContent=archive?'Сохранить копию файла ↓':'Скачать вложение ↓';
    wrapper.appendChild(link);
    const slot=document.createElement('div');
    slot.className='veto-mirror-expanded-slot';slot.dataset.mirrorExpanded=key;
    slot.appendChild(wrapper);button.replaceWith(slot);
    state.expandedAttachments.set(key,{href,mime,size:blob.size,archive,node:wrapper});
    state.expandedBytes+=blob.size;
    // LRU eviction prevents dozens of multi-megabyte blobs from exhausting
    // memory on low-end Android WebViews. Reopen an evicted file on demand.
    while((state.expandedAttachments.size>6||state.expandedBytes>24*1024*1024)
      && state.expandedAttachments.size>1){
      const oldestKey=state.expandedAttachments.keys().next().value;
      const old=state.expandedAttachments.get(oldestKey);
      state.expandedAttachments.delete(oldestKey);
      state.expandedBytes=Math.max(0,state.expandedBytes-old.size);
      for(const media of old.node.querySelectorAll('audio,video'))media.pause();
      const current=state.mediaPreviewUrls.get(oldestKey);
      if(current===old.href)state.mediaPreviewUrls.delete(oldestKey);
      if($('telegramThreadPhotoFull')?.getAttribute('src')===old.href)closePhotoViewer();
      const oldSlot=[...$('telegramThreadMessages')?.querySelectorAll('[data-mirror-expanded]')||[]]
        .find(el=>el.dataset.mirrorExpanded===oldestKey);
      if(oldSlot)oldSlot.replaceWith(expandedFileButton(oldestKey,old.archive));
      state.mediaUrls=state.mediaUrls.filter(url=>url!==old.href);
      URL.revokeObjectURL(old.href);
    }
  }
  // Reuse exact audio/video DOM nodes during history refresh. Re-creating the
  // <audio> element would seek back to zero and cause repeated downloads.
  function restoreExpandedAttachments(){
    const scroller=$('telegramThreadMessages');
    if(!scroller)return;
    for(const slot of scroller.querySelectorAll('[data-mirror-expanded]')){
      const entry=state.expandedAttachments.get(slot.dataset.mirrorExpanded);
      if(entry&&entry.node)slot.replaceChildren(entry.node);
    }
  }
  async function openArchivedFile(button){
    if(!state.thread||!button||button.disabled)return;
    if(!tg?.initData){toast('Открой VETO внутри Telegram');return;}
    const id=Number(button.dataset.mirrorFile||0);
    if(!Number.isSafeInteger(id)||id<=0)return;
    const chatId=String(state.thread.id),ownerKey=state.ownerInitData,epoch=state.threadGeneration;
    button.disabled=true;
    const original=button.textContent;
    button.textContent='Загружаю защищённую копию…';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const params=new URLSearchParams({
        chatId,messageId:String(id),
      });
      const response=await fetch('/api/privacy-media?'+params,{
        headers:{'x-telegram-init-data':ownerKey},signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram уже не отдаёт вложение и резервная копия недоступна.');
      const blob=await response.blob();
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')||
         epoch!==state.threadGeneration||String(state.thread?.id)!==chatId||!button.isConnected)return;
      if(!blob.size||blob.size>20*1024*1024)throw new Error('Файл слишком большой для просмотра.');
      cacheExpandedAttachment(button,id,blob,true);
    }catch(error){
      if(ownerKey===state.ownerInitData&&ownerKey===String(tg?.initData||'')&&
         epoch===state.threadGeneration&&String(state.thread?.id)===chatId&&button.isConnected){
        toast(error?.name==='AbortError'?'Media Vault отвечает слишком долго':error.message);
        button.textContent=original;button.disabled=false;
      }
    }finally{clearTimeout(timer);}
  }

  async function openLiveAttachment(button){
    if(!state.thread||button.disabled||!tg?.initData)return;
    const id=Number(button.dataset.mirrorLiveFile);
    if(!Number.isSafeInteger(id)||id<=0)return;
    const chatId=String(state.thread.id),ownerKey=state.ownerInitData,epoch=state.threadGeneration;
    const prev=button.textContent;
    button.disabled=true;button.textContent='Загружаю из Telegram…';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),27000);
    try {
      const response=await fetch('/api/telegram-chat-media',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':ownerKey},
        body:JSON.stringify({action:'attachment',chatId,messageId:id}),signal:controller.signal,
      });
      if(!response.ok)throw new Error('Telegram не отдаёт файл или он превышает 4 МБ.');
      const blob=await response.blob();
      if(!blob.size||blob.size>4*1024*1024)throw new Error('Вложение слишком большое.');
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')||
         epoch!==state.threadGeneration||String(state.thread?.id)!==chatId||!button.isConnected)return;
      cacheExpandedAttachment(button,id,blob,false);
    }catch(error){
      if(ownerKey===state.ownerInitData&&ownerKey===String(tg?.initData||'')&&
         epoch===state.threadGeneration&&String(state.thread?.id)===chatId&&button.isConnected){
        button.disabled=false;button.textContent=prev;
        toast(error?.name==='AbortError'?'Telegram не ответил вовремя':error.message);
      }
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
  // Private, RAM-only find: never transmit queries, index only already loaded messages.
  function loadedSearchMatches(){
    const q=state.threadSearch.trim().toLocaleLowerCase();
    if(!q)return [];
    return state.messages.filter(m=>String(m.text||'').toLocaleLowerCase().includes(q))
      .map(m=>String(m.id));
  }
  function searchedText(value){
    const text=String(value||''),q=state.threadSearch.trim();
    if(!q)return safe(text);
    const lower=text.toLocaleLowerCase(),needle=q.toLocaleLowerCase();
    let pos=0,count=0,html='';
    // Bound markup amplification on very long messages and one-letter searches.
    while(count++<48){
      const at=lower.indexOf(needle,pos);
      if(at<0)break;
      html+=safe(text.slice(pos,at))+'<mark>'+safe(text.slice(at,at+needle.length))+'</mark>';
      pos=at+needle.length;
    }
    return html+safe(text.slice(pos));
  }
  function refreshThreadSearch({jump=false}={}){
    const bar=$('telegramThreadFind'),input=$('telegramThreadFindInput');
    if(!bar||bar.hidden)return;
    const matches=loadedSearchMatches();
    state.threadSearchIndex=Math.max(0,Math.min(state.threadSearchIndex,matches.length-1));
    const current=matches[state.threadSearchIndex];
    const box=$('telegramThreadMessages');
    let target=null;
    for(const node of box?.querySelectorAll('[data-mirror-message-id]')||[]){
      const match=matches.includes(node.dataset.mirrorMessageId);
      const active=match&&node.dataset.mirrorMessageId===current;
      node.classList.toggle('search-match',match);
      node.classList.toggle('search-active',active);
      if(active)target=node;
    }
    if($('telegramThreadFindCount'))$('telegramThreadFindCount').textContent=!state.threadSearch.trim()
      ?'Только загруженная история'
      :matches.length?(state.threadSearchIndex+1)+' из '+matches.length
        :'Совпадений нет';
    if($('telegramThreadFindPrev'))$('telegramThreadFindPrev').disabled=matches.length<2;
    if($('telegramThreadFindNext'))$('telegramThreadFindNext').disabled=matches.length<2;
    if(jump&&target)target.scrollIntoView({block:'center',behavior:'smooth'});
  }
  function closeThreadSearch(){
    state.threadSearch='';state.threadSearchIndex=0;
    if($('telegramThreadFindInput'))$('telegramThreadFindInput').value='';
    if($('telegramThreadFind'))$('telegramThreadFind').hidden=true;
    if($('telegramThreadSearchToggle'))$('telegramThreadSearchToggle').setAttribute('aria-expanded','false');
    for(const el of $('telegramThreadMessages')?.querySelectorAll('.search-match,.search-active')||[]){
      el.classList.remove('search-match','search-active');
    }
    for(const el of $('telegramThreadMessages')?.querySelectorAll('mark')||[]){
      el.replaceWith(document.createTextNode(el.textContent||''));
    }
  }
  function showLatestShortcut(){
    const scroller=$('telegramThreadMessages'),shortcut=$('telegramThreadJumpLatest');
    if(!scroller||!shortcut)return;
    const remaining=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight;
    shortcut.hidden=!state.thread||state.messages.length<9||remaining<160;
  }
  function renderMessages({keepScroll=false,anchor=null}={}){
    const box=$('telegramThreadMessages');
    if(!box)return;
    const previousHeight=box.scrollHeight, previousScroll=box.scrollTop;
    // Keep the exact media element and capture active playback. Some Android
    // WebViews pause detached audio; restore only media already playing by
    // user action, never autoplay unopened voice messages.
    const playingBeforePaint=[];
    for(const slot of box.querySelectorAll('[data-mirror-expanded]')){
      const entry=state.expandedAttachments.get(String(slot.dataset.mirrorExpanded));
      if(entry?.node?.parentNode===slot){
        const media=entry.node.querySelector('audio,video');
        if(media&&!media.paused&&!media.ended)
          playingBeforePaint.push({media,position:media.currentTime});
        entry.node.remove();
      }
    }
    if(!state.messages.length){
      box.innerHTML=state.threadLoading
        ?empty('Загружаю сообщения','Получаю историю напрямую из Telegram…')
        :empty('Пустой чат','В Telegram нет доступных сообщений');
    }else{
      let day='';
      let previous=null;
      box.innerHTML=state.messages.map(message=>{
        const date=message.date?new Date(message.date):null;
        const dayKey=date&&!Number.isNaN(date.getTime())?date.toDateString():'';
        const divider=dayKey!==day&&dayKey
          ?'<div class="veto-mirror-day"><span>'+
            safe(date.toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'}))+
            '</span></div>':'';
        day=dayKey||day;
        const compact=previous && previous.out===message.out && dayKey===previous.day
          && Math.abs(date?.getTime() - previous.stamp) < 5*60000
          && (!message.sender || message.sender===previous.sender);
        previous={out:message.out,day:dayKey,stamp:date?.getTime()||0,sender:message.sender||''};
        const text=String(message.text||'');
        const media=message.media
          ?'<div class="veto-mirror-media">'+inlineImage(message)+safe(mediaLabels[message.media]||'◫ Вложение')+
            '<small>'+safe(message.saved&&message.mediaAvailable
              ?'Независимая копия · Media Vault'
              :message.saved?'Сохранена отметка о вложении':'Файл доступен в Telegram')+'</small></div>':'';
        const replySource=Number(message.replyTo)>0
          ?state.messages.find(m=>Number(m.id)===Number(message.replyTo)):null;
        const replyMarkup=Number(message.replyTo)>0
          ?'<div class="veto-mirror-reply-tag">↩ '+safe(replySource?.text?.slice(0,90)||('Ответ на сообщение '+message.replyTo))+'</div>'
          :'';
        const savedBanner=message.deleted
          ?'<div class="veto-mirror-preserved-flag deleted">↶ УДАЛЕНО В TELEGRAM · СОХРАНЕНО В VETO</div>'
          :message.preservedOnly
            ?'<div class="veto-mirror-preserved-flag">◈ СОХРАНЁННАЯ КОПИЯ VETO</div>'
            :'';
        const isAudio=['voice','audio'].includes(message.media);
        const cachedFile=state.expandedAttachments.get(String(message.id));
        const viewFile=cachedFile&&message.media
          ?'<div class="veto-mirror-expanded-slot" data-mirror-expanded="'+safe(message.id)+'"></div>'
          :message.saved&&message.media&&message.mediaAvailable
          ?'<button type="button" class="veto-mirror-open-vault" data-mirror-file="'+safe(message.id)+
             '">'+(isAudio?'▶ Слушать сохранённое аудио':'Открыть сохранённый файл ↗')+'</button>'
          :message.media&&!message.deleted&&!message.preservedOnly&&message.media!=='photo'
            ?'<button type="button" class="veto-mirror-open-vault" data-mirror-live-file="'+safe(message.id)+
               '">'+(isAudio?'▶ Слушать в переписке':'Открыть файл из Telegram ↗')+'</button>'
            :'';
        return divider+'<article data-mirror-message-id="'+safe(message.id)+'" class="veto-mirror-bubble'+(message.out?' outgoing':'')+
          (compact?' compact':'')+(message.deleted?' is-deleted':'')+
          (state.intelFocus&&String(state.intelFocus.chatId)===String(state.thread?.id)&&
            String(state.intelFocus.messageId)===String(message.id)?' veto-intel-exact-source':'')+
          '"><div class="veto-mirror-bubble-inner">'+
          (message.sourceIsolated?'<div class="veto-intel-source-notice">Точное сообщение из источника · окружающая история не загружена</div>':'')+
          savedBanner+
          (message.sender&&!message.out?'<strong class="veto-mirror-bubble-sender">'+
            safe(message.sender)+'</strong>':'')+
          replyMarkup+media+viewFile+(text?'<p>'+searchedText(text)+'</p>':'')+
          '<footer>'+(canSendInThread(state.thread)&&Number.isSafeInteger(Number(message.id))&&!message.deleted&&!message.preservedOnly
            ?'<button type="button" class="veto-mirror-reply-action" data-mirror-reply="'+safe(message.id)+'" aria-label="Ответить на сообщение">↩</button>':'')+
          (message.replyTo?'<span>↩ '+safe(message.replyTo)+'</span>':'')+
          (message.pending?'<span class="veto-mirror-send-pending">◌ Отправляется…</span>':'')+
          (message.sent?'<span class="veto-mirror-send-accepted" title="Telegram принял отправку, статус прочтения неизвестен">✓ Принято</span>':'')+
          (message.edited?'<span>изменено</span>':'')+
          (message.saved&&!message.deleted?'<span title="Сохранено в VETO">↶</span>':'')+
          '<time>'+safe(messageTime(message.date))+'</time></footer></div></article>';
      }).join('');
    }
    restoreExpandedAttachments();
    for(const {media,position} of playingBeforePaint){
      if(!media.isConnected||!media.paused)continue;
      try{
        if(Number.isFinite(position)&&position>0)media.currentTime=position;
        const resumed=media.play();
        if(resumed?.catch)resumed.catch(()=>{});
      }catch{}
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
    refreshThreadSearch();
    showLatestShortcut();
  }

  // Active chat feels live without maintaining a server-side permanent user
  // Telegram session or sending read receipts. Messages are kept only in RAM,
  // scoped to this initData, and refreshed while the visible chat is open.
  function activeChatScreen(){
    return document.querySelector('.screen.active')?.dataset?.screen==='telegram';
  }
  function maySyncThread(){
    return Boolean(state.thread&&!state.thread.archiveOnly&&
      state.connectionProof?.verified&&!document.hidden&&navigator.onLine!==false&&
      activeChatScreen());
  }
  function stopThreadSync(){
    if(state.syncTimer!==null)clearTimeout(state.syncTimer);
    state.syncTimer=null;
  }
  function syncLabel(value,busy=false){
    const el=$('telegramThreadSyncStatus'),dot=$('telegramThreadSyncDot');
    if(el)el.textContent=value;
    if(dot)dot.classList.toggle('is-busy',busy);
  }
  function scheduleThreadSync(ms=26000){
    stopThreadSync();
    if(!maySyncThread())return;
    state.syncTimer=setTimeout(()=>{void pollThread();},ms);
  }
  function rememberHotThread(){
    if(!state.thread||!state.messages.length)return;
    const chatId=String(state.thread.id);
    const copy={
      at:Date.now(),messages:state.messages.slice(-150).map(m=>({...m})),
      threadOffset:state.threadOffset,archiveOffset:state.archiveOffset,
      liveHasMore:state.liveHasMore,archiveHasMore:state.archiveHasMore,
      threadHasMore:state.threadHasMore,serverCanSend:state.thread.serverCanSend,
    };
    state.threadCache.delete(chatId);
    state.threadCache.set(chatId,copy);
    while(state.threadCache.size>4){
      const oldest=state.threadCache.keys().next().value;
      state.threadCache.delete(oldest);
    }
  }
  function restoreHotThread(chatId){
    const value=state.threadCache.get(String(chatId));
    if(!value||Date.now()-value.at>90000){
      state.threadCache.delete(String(chatId));return false;
    }
    state.threadCache.delete(String(chatId));
    state.threadCache.set(String(chatId),value);
    state.messages=value.messages.map(m=>({...m}));
    state.threadOffset=value.threadOffset;
    state.archiveOffset=value.archiveOffset;
    state.liveHasMore=value.liveHasMore;
    state.archiveHasMore=value.archiveHasMore;
    state.threadHasMore=value.threadHasMore;
    state.thread.serverCanSend=value.serverCanSend;
    return true;
  }
  async function pollThread({manual=false}={}){
    if(resetOwner()||!maySyncThread()||state.syncBusy||state.threadLoading||state.sendInFlight){
      if(!state.syncBusy&&maySyncThread())scheduleThreadSync(15000);
      return;
    }
    const chatId=String(state.thread.id),generation=state.threadGeneration;
    const ownerKey=state.ownerInitData;
    const runId=++state.syncRunId;
    state.syncBusy=true;
    syncLabel('Проверяю новые сообщения…',true);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),18500);
    try{
      const response=await fetch('/api/telegram-chat-updates',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':ownerKey},
        body:JSON.stringify({action:'poll_thread',chatId}),
        signal:controller.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||'Не удалось обновить переписку');
      if(generation!==state.threadGeneration||ownerKey!==state.ownerInitData||
        ownerKey!==String(tg?.initData||'')||String(state.thread?.id)!==chatId)return;
      const current=new Map(state.messages.map(m=>[String(m.id),m]));
      const box=$('telegramThreadMessages');
      const atBottom=box?box.scrollHeight-box.scrollTop-box.clientHeight<110:true;
      const anchor=atBottom?null:visibleMessageAnchor();
      let changed=false,newItems=0;
      for(const msg of data.messages||[]){
        if(!msg||!Number.isSafeInteger(Number(msg.id))||Number(msg.id)<=0)continue;
        const key=String(msg.id),old=current.get(key);
        if(!old){current.set(key,msg);changed=true;newItems++;continue;}
        const merged={...old,...msg,
          saved:Boolean(old.saved||msg.saved),
          deleted:Boolean(old.deleted||msg.deleted),
          preservedOnly:Boolean(old.preservedOnly||msg.preservedOnly),
          mediaAvailable:Boolean(old.mediaAvailable||msg.mediaAvailable),
        };
        // Edits and confirmed deletions are visible even when the message ID
        // did not change; absence alone is never treated as a deletion.
        if(old.text!==merged.text||old.deleted!==merged.deleted||
          old.edited!==merged.edited||old.saved!==merged.saved||
          old.mediaAvailable!==merged.mediaAvailable){
          current.set(key,merged);changed=true;
        }
      }
      if(changed){
        state.messages=[...current.values()].sort((a,b)=>
          new Date(a.date||0).getTime()-new Date(b.date||0).getTime()||
          Number(a.id)-Number(b.id));
        renderMessages({keepScroll:atBottom,anchor});
        rememberHotThread();
      }
      state.syncFailures=0;
      state.lastSyncedAt=Date.now();
      const date=new Date(state.lastSyncedAt);
      syncLabel(newItems&&!atBottom
        ?newItems+' новых · '+two(date.getHours())+':'+two(date.getMinutes())+' · прокрути вниз'
        :'Обновлено '+two(date.getHours())+':'+two(date.getMinutes())+' · без отметки «прочитано»');
    }catch(error){
      if(String(state.thread?.id)===chatId && ownerKey===state.ownerInitData){
        state.syncFailures=Math.min(4,state.syncFailures+1);
        syncLabel(error?.name==='AbortError'?'Telegram отвечает медленно — повторю позже'
          :navigator.onLine===false?'Нет сети — обновление приостановлено'
            :'Связь с Telegram прервана — повторю позже');
        // Repeated failures must not erase visible conversations or pretend
        // to receive updates. Retries exponentially slow down.
      }
    }finally{
      clearTimeout(timeout);
      if(runId===state.syncRunId&&generation===state.threadGeneration&&
         String(state.thread?.id)===chatId&&ownerKey===state.ownerInitData){
        state.syncBusy=false;
        scheduleThreadSync(state.syncFailures?Math.min(120000,30000*2**state.syncFailures):26000);
      }
    }
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
    // Immediate owner-verified inbox snapshot; not misrepresented as history.
    const teaser=state.connectionProof?.verified&&chat.preview
      ?'<div class="veto-mirror-first-preview" role="status"><span>ПОСЛЕДНЕЕ ИЗ СПИСКА</span><p>'+
        safe(String(chat.preview).slice(0,200))+'</p><small>Открываю историю из Telegram…</small></div>'
      :empty('Открываю переписку','Получаю последние сообщения из Telegram…');
    $('telegramThreadMessages').innerHTML=teaser;
    if($('telegramThreadJumpLatest'))$('telegramThreadJumpLatest').hidden=true;
    renderSendComposer();
    threadNotice('');
    const shell=$('telegramMirror');
    shell?.classList.add('thread-mode');
    window.VetoThemeDock?.('thread');
    window.scrollTo({top:0,behavior:'instant'});
  }
  async function openThread(chat){
    if(resetOwner()||!chat)return;
    revokeMediaUrls();
    haptic();
    cancelVoiceCapture();
    stopThreadSync();
    state.syncRunId++;state.syncBusy=false;
    // Older thread fetches may still be running: don't let their loading flag
    // block this newly selected dialog for the rest of the session.
    state.threadLoading=false;
    state.syncFailures=0;state.lastSyncedAt=null;
    state.thread=chat;state.messages=[];state.threadHasMore=false;
    state.intelFocus=null;
    state.deliveryStage=null;renderDeliveryStatus();
    closeThreadSearch();
    state.replyTo=null;state.pendingAttachment=null;
    renderReplyPreview();renderAttachmentChip();
    if($('telegramThreadStickerDrawer'))$('telegramThreadStickerDrawer').hidden=true;
    state.threadOffset=0;state.archiveOffset=0;
    state.archiveHasMore=false;state.liveHasMore=!chat.archiveOnly;
    state.threadGeneration++;
    setThread(chat);
    if(restoreHotThread(chat.id)){
      renderMessages();
      renderSendComposer();
      syncLabel('Предпросмотр из памяти · обновляю Telegram…',true);
    }else syncLabel('Подключаюсь к Telegram…',true);
    await loadMessages({reset:true});
  }
  // First paint comes from owner-verified MTProto; archived deletion evidence
  // is fetched afterwards and reconciled without blocking the visible chat.
  // Both stages stay in memory and are invalidated on account/thread changes.
  async function mergeDeferredArchive(chatId,generation,ownerKey){
    try{
      const data=await request('thread_archive',{chatId,archiveOffset:0});
      if(resetOwner()||ownerKey!==state.ownerInitData||
         generation!==state.threadGeneration||String(state.thread?.id)!==chatId)return;
      const anchor=visibleMessageAnchor();
      const byId=new Map(state.messages.map(msg=>[String(msg.id),msg]));
      for(const kept of data.messages||[]){
        if(!kept||!kept.id)continue;
        const id=String(kept.id),previous=byId.get(id);
        if(previous){
          byId.set(id,{...previous,saved:true,
            deleted:Boolean(kept.deleted),archivedOriginal:Boolean(kept.deleted),
            mediaAvailable:Boolean(kept.mediaAvailable||previous.mediaAvailable)});
        }else byId.set(id,{...kept,preservedOnly:true});
      }
      state.messages=[...byId.values()].sort((a,b)=>
        new Date(a.date||0).getTime()-new Date(b.date||0).getTime()||
        Number(a.id)-Number(b.id));
      state.archiveHasMore=Boolean(data.archiveHasMore);
      state.archiveOffset=Number(data.archiveNextOffset||0);
      state.threadHasMore=state.liveHasMore||state.archiveHasMore;
      renderMessages({anchor});
      rememberHotThread();
    }catch(error){
      // Live messages are valid even when Privacy storage is slow or offline.
      // Don't mislabel lack of stored evidence as restored deletions.
      if(ownerKey===state.ownerInitData&&
         generation===state.threadGeneration&&String(state.thread?.id)===chatId&&
         state.thread?.savedCopy===true)
        threadNotice('Облачная история открыта. Защищённый архив пока не ответил; обнови чат позже.');
    }
  }
  async function loadMessages({reset=false}={}){
    if(resetOwner()||!state.thread||state.threadLoading)return;
    const chatId=String(state.thread.id);
    const rememberedAnchor=state.messages.length?visibleMessageAnchor():null;
    const generation=++state.threadGeneration;
    state.syncRunId++;state.syncBusy=false; // current history load supersedes any old poll
    state.threadLoading=true;
    if(reset&&!rememberedAnchor)state.messages=[];
    $('telegramThreadOlder').hidden=true;
    if(reset&&state.messages.length)renderMessages();
    try{
      const ownerKey=state.ownerInitData;
      const fastLive=reset&&state.thread.archiveOnly!==true&&
        state.connectionProof?.verified===true;
      const data=await request('thread',{
        chatId,offsetId:reset?0:state.threadOffset,
        archiveOffset:reset?0:state.archiveOffset,
        archiveOnly:Boolean(state.thread.archiveOnly),
        liveExhausted:!reset&&!state.liveHasMore,
        fastLive,
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
      if(state.thread)state.thread.serverCanSend=data.canSend===true;
      if(data.chat && state.thread && data.chat.type!=='copy'){
        state.thread={...state.thread,...data.chat,
          savedCopy:Boolean(state.thread.savedCopy||data.chat.savedCopy)};
        $('telegramThreadMeta').textContent=(labels[data.chat.type]||'чат')+
          (state.thread.savedCopy?' · сохранённая история VETO':' · Telegram');
      }
      state.threadLoading=false;
      renderMessages({keepScroll:!reset,anchor:rememberedAnchor});
      rememberHotThread();
      renderSendComposer();
      syncLabel(data.archiveDeferred
        ?'Telegram подключён · синхронизирую архив VETO…'
        :'Telegram подключён · проверка каждые 26 сек.');
      scheduleThreadSync();
      if(data.archiveDeferred===true)
        void mergeDeferredArchive(chatId,generation,ownerKey);
    }catch(error){
      if(generation!==state.threadGeneration)return;
      state.threadLoading=false;
      threadNotice(error.message);
      syncLabel('Нет подтверждения Telegram · проверю снова');
      scheduleThreadSync(45000);
      if(reset)renderMessages();
      else $('telegramThreadOlder').hidden=!state.threadHasMore;
    }
  }
  function back(){
    if(!$('telegramThreadView')||$('telegramThreadView').hidden)return;
    rememberHotThread();
    stopThreadSync();
    state.syncRunId++;state.syncBusy=false;
    state.threadGeneration++;
    closeThreadSearch();
    cancelVoiceCapture();
    state.thread=null;state.threadLoading=false;state.intelFocus=null;
    state.deliveryStage=null;renderDeliveryStatus();
    state.replyTo=null;state.pendingAttachment=null;renderReplyPreview();renderAttachmentChip();
    $('telegramThreadView').hidden=true;
    $('telegramChatsView').hidden=false;
    $('telegramMirror')?.classList.remove('thread-mode');
    window.VetoThemeDock?.('inbox');
    revokeMediaUrls();
    renderSendComposer();
    renderChats();
    // Show cached chat list instantly, reconcile server-side ordering when it
    // is old. Never delay the Back gesture on a round trip to Telegram.
    if(state.connectionProof?.verified&&state.ownerInitData===String(tg?.initData||'')&&
       !state.loading&&navigator.onLine!==false&&Date.now()-state.lastListFetchedAt>45000)
      void loadChats({reset:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function closeVetoMessengerTools(){
    const pane=$('vetoMessengerTools'),button=$('vetoMessengerToolsToggle');
    if(pane)pane.hidden=true;
    if(button)button.setAttribute('aria-expanded','false');
  }
  $('vetoMessengerToolsToggle')?.addEventListener('click',()=>{
    if(resetOwner())return;
    const pane=$('vetoMessengerTools'),button=$('vetoMessengerToolsToggle');
    if(!pane)return;
    pane.hidden=!pane.hidden;
    button?.setAttribute('aria-expanded',String(!pane.hidden));
  });
  $('vetoMessengerConnectCta')?.addEventListener('click',()=>{
    if(typeof window.VetoTelegramOpenAccountConnection==='function')
      void window.VetoTelegramOpenAccountConnection();
  });
  $('vetoMessengerTools')?.addEventListener('click',event=>{
    const action=event.target.closest('[data-veto-messenger-tool]')?.dataset.vetoMessengerTool;
    if(!action||resetOwner())return;
    if(action==='intel'){
      const panel=$('vetoMessengerIntelArea'),inside=$('vetoIntelSearchPanel');
      if(panel){panel.hidden=false;inside.hidden=false;}
      $('vetoIntelSearchToggle')?.setAttribute('aria-expanded','true');
      closeVetoMessengerTools();
      panel?.scrollIntoView({block:'nearest',behavior:'smooth'});
      $('vetoIntelSearchInput')?.focus();
    }else if(action==='access'){
      const drawer=$('telegramMirrorAccessDrawer');
      if(drawer){drawer.open=true;drawer.dataset.userToggled='1';}
      drawer?.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  });
  $('vetoMessengerFiltersToggle')?.addEventListener('click',()=>{
    const box=$('telegramMirrorFilters'),button=$('vetoMessengerFiltersToggle');
    if(!box||!button)return;
    const next=box.dataset.expanded!=='true';
    box.dataset.expanded=String(next);
    button.setAttribute('aria-expanded',String(next));
  });
  $('vetoIntelSearchToggle')?.addEventListener('click',()=>{
    const panel=$('vetoIntelSearchPanel');
    if(!panel)return;
    panel.hidden=!panel.hidden;
    $('vetoIntelSearchToggle')?.setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)$('vetoIntelSearchInput')?.focus();
  });
  $('vetoIntelLoadMore')?.addEventListener('click',()=>void searchIntel({loadMore:true}));
  for(const id of ['vetoIntelSearchInput','vetoIntelIncludeVault']){
    $(id)?.addEventListener(id==='vetoIntelSearchInput'?'input':'change',()=>{
      state.intelEpoch++;
      state.intelBusy=false;state.intelNextPage=null;
      if($('vetoIntelLoadMore'))$('vetoIntelLoadMore').hidden=true;
      if($('vetoIntelSearchSubmit'))$('vetoIntelSearchSubmit').disabled=false;
      if($('vetoIntelSearchStatus')&&state.intelResults.length)
        $('vetoIntelSearchStatus').textContent='Параметры изменились. Нажми «Найти» для нового поиска.';
    });
  }
  $('vetoIntelSearchForm')?.addEventListener('submit',event=>{
    event.preventDefault();void searchIntel();
  });
  document.querySelectorAll('[data-veto-intel-example]').forEach(button=>
    button.addEventListener('click',()=>{
      if($('vetoIntelSearchInput'))$('vetoIntelSearchInput').value=button.dataset.vetoIntelExample||'';
      void searchIntel();
    }));
  // No guessed jump: locate an actually loaded message or re-fetch precisely
  // by its signed source ID. Missing/deleted Telegram evidence is reported.
  function highlightIntelSource(chatId,messageId){
    const box=$('telegramThreadMessages');
    if(!box||String(state.thread?.id)!==String(chatId))return false;
    const node=[...box.querySelectorAll('[data-mirror-message-id]')]
      .find(el=>el.dataset.mirrorMessageId===String(messageId));
    if(!node)return false;
    state.intelFocus={chatId:String(chatId),messageId:Number(messageId)};
    box.querySelectorAll('.veto-intel-exact-source')
      .forEach(el=>el.classList.remove('veto-intel-exact-source'));
    node.classList.add('veto-intel-exact-source');
    node.scrollIntoView({block:'center',behavior:'smooth'});
    return true;
  }
  async function openIntelSource(trigger){
    if(!trigger||resetOwner())return;
    const result=state.intelResults[Number(trigger.dataset.vetoIntelOpen)];
    if(!result)return;
    const chatId=String(result.chatId),messageId=Number(result.messageId);
    if(!/^-?\d{1,22}$/.test(chatId)||!Number.isSafeInteger(messageId)||messageId<1)return;
    const ownerKey=state.ownerInitData;
    const current=state.chats.find(chat=>String(chat.id)===chatId);
    const archiveOnly=result.source==='veto-vault'&&!current;
    const chat=current||{
      id:chatId,title:String(result.chatTitle||'Telegram чат'),
      type:archiveOnly?'copy':
        ['private','group','channel'].includes(result.kind)?result.kind:'other',
      archiveOnly,savedCopy:result.saved===true,serverCanSend:false,preview:'',
    };
    await openThread(chat);
    if(resetOwner()||ownerKey!==state.ownerInitData||
       ownerKey!==String(tg?.initData||'')||String(state.thread?.id)!==chatId)return;
    const generation=state.threadGeneration;
    if(highlightIntelSource(chatId,messageId))return;
    const source=archiveOnly||result.source==='veto-vault'||
      (result.deleted===true&&result.saved===true)?'veto-vault':'telegram-cloud';
    const vaultOffset=result.vaultOffset;
    if(source==='veto-vault'&&(!Number.isSafeInteger(vaultOffset)||vaultOffset<0)){
      threadNotice('Точная позиция сохранённой копии отсутствует. Проверь сообщение в VETO Vault.');return;
    }
    threadNotice('Ищу точный источник сообщения #'+messageId+'…');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/telegram-message-context',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':ownerKey},
        body:JSON.stringify({chatId,messageId,source,
          ...(source==='veto-vault'?{vaultOffset}:{})}),
        signal:controller.signal,
      });
      const data=await response.json().catch(()=>({}));
      if(resetOwner()||ownerKey!==state.ownerInitData||
         ownerKey!==String(tg?.initData||'')||
         generation!==state.threadGeneration||String(state.thread?.id)!==chatId)return;
      if(!response.ok||!data.ok||Number(data.message?.id)!==messageId)
        throw new Error(data.error||'Оригинальное сообщение сейчас недоступно.');
      if(!state.messages.some(m=>String(m.id)===String(messageId))){
        state.messages.push({...data.message,sourceIsolated:true});
        state.messages.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)||Number(a.id)-Number(b.id));
      }
      state.intelFocus={chatId,messageId};
      renderMessages({keepScroll:true});
      if(highlightIntelSource(chatId,messageId))
        threadNotice('Показано исходное сообщение #'+messageId+'. Остальная история вокруг него может быть не загружена.');
    }catch(error){
      if(ownerKey===state.ownerInitData&&generation===state.threadGeneration)
        threadNotice(String(error.message||'Не удалось открыть точный источник.'));
    }finally{clearTimeout(timer)}
  }
  $('vetoIntelSearchResults')?.addEventListener('click',event=>
    openIntelSource(event.target.closest('[data-veto-intel-open]')));
  $('vetoIntelTimeline')?.addEventListener('click',event=>
    openIntelSource(event.target.closest('[data-veto-intel-open]')));
  $('telegramThreadAttachButton')?.addEventListener('click',()=>{
    if(canSendInThread(state.thread))$('telegramThreadFileInput')?.click();
  });
  $('telegramThreadAudioButton')?.addEventListener('click',()=>{
    if(canSendInThread(state.thread))$('telegramThreadAudioInput')?.click();
  });
  $('telegramThreadAudioInput')?.addEventListener('change',event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(file.size<1||file.size>2*1024*1024){toast('Аудиофайл должен быть до 2 МБ');event.target.value='';return;}
    if(!['audio/mpeg','audio/mp4','audio/ogg','audio/webm'].includes(file.type)){
      toast('Поддерживаются MP3, M4A, OGG, WebM');return;
    }
    if(!canSendInThread(state.thread))return;
    state.pendingAttachment={file,kind:'document'};
    renderAttachmentChip();renderSendComposer();
  });
  $('telegramThreadFileInput')?.addEventListener('change',event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(file.size<1||file.size>2*1024*1024){toast('Выбери фото или документ до 2 МБ');event.target.value='';return;}
    if(!canSendInThread(state.thread))return;
    state.pendingAttachment={file,kind:['image/jpeg','image/png','image/webp'].includes(file.type)?'photo':'document'};
    renderAttachmentChip();renderSendComposer();
  });
  $('telegramThreadAttachmentClear')?.addEventListener('click',()=>{
    state.pendingAttachment=null;
    if($('telegramThreadFileInput'))$('telegramThreadFileInput').value='';
    if($('telegramThreadAudioInput'))$('telegramThreadAudioInput').value='';
    renderAttachmentChip();renderSendComposer();
  });
  $('telegramThreadReplyCancel')?.addEventListener('click',()=>{
    state.replyTo=null;renderReplyPreview();
  });
  $('telegramThreadStickersButton')?.addEventListener('click',openStickerDrawer);
  $('telegramThreadStickersClose')?.addEventListener('click',closeStickerDrawer);
  $('telegramThreadStickerDrawer')?.addEventListener('click',event=>{
    const tab=event.target.closest('[data-sticker-tab]');
    if(tab){void selectStickerTab(tab.dataset.stickerTab);return;}
    const open=event.target.closest('[data-open-sticker-pack]');
    if(open){void openStickerPack(open.dataset.openStickerPack);return;}
    const sticker=event.target.closest('[data-send-sticker]');
    if(sticker)void sendRichOutgoing('send_sticker',{
      id:String(sticker.dataset.sendSticker),
      ...(sticker.dataset.stickerSetId?{setId:String(sticker.dataset.stickerSetId)}:{}),
    });
  });
  $('vetoStickersBackPack')?.addEventListener('click',()=>{
    state.stickerEpoch++;state.stickerPack=null;state.stickerVisible=16;
    state.stickerQuery='';if($('vetoStickersSearch'))$('vetoStickersSearch').value='';
    renderStickerDrawer();
  });
  $('vetoStickersSearch')?.addEventListener('input',event=>{
    state.stickerEpoch++;state.stickerQuery=String(event.target.value||'').slice(0,45);
    state.stickerVisible=16;renderStickerDrawer();
  });
  $('vetoStickersMore')?.addEventListener('click',()=>{
    state.stickerEpoch++;state.stickerVisible+=8;renderStickerDrawer();
  });
  $('telegramThreadRecordVoice')?.addEventListener('click',toggleVoiceRecording);
  $('telegramThreadVoiceModes')?.addEventListener('click',event=>{
    const btn=event.target.closest('[data-chat-voice-preset]');
    if(!btn||state.recording)return;
    state.voicePreset=btn.dataset.chatVoicePreset;
    renderVoiceDraft();
  });
  $('telegramThreadVoiceCancel')?.addEventListener('click',dropVoiceDraft);
  $('telegramThreadVoiceRedo')?.addEventListener('click',()=>{
    dropVoiceDraft();void toggleVoiceRecording();
  });
  $('telegramThreadVoiceSend')?.addEventListener('click',()=>{
    const draft=state.voiceDraft;
    if(!draft||String(state.thread?.id)!==draft.origin)return;
    void sendRichOutgoing('send_media',{file:draft.file,kind:'voice',duration:draft.duration});
  });
  $('telegramThreadComposer')?.addEventListener('submit',event=>{
    event.preventDefault();
    sendOutgoing();
  });
  $('telegramThreadCompose')?.addEventListener('input',event=>{
    const chatId=String(state.thread?.id||'');
    if(chatId){
      state.drafts.set(chatId,event.target.value);
      if(state.lastSendFailure?.chatId===chatId && state.lastSendFailure.message!==event.target.value.trim()){
        state.lastSendFailure=null; // The user deliberately changed their send intent.
      }
    }
    renderSendComposer();
  });
  $('telegramThreadCompose')?.addEventListener('keydown',event=>{
    if(event.key==='Enter' && !event.shiftKey && !event.isComposing && !event.repeat &&
        !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
      event.preventDefault();
      sendOutgoing();
    }
  });
  $('telegramMirrorArchiveLink')?.addEventListener('click',()=>{
    window.VetoTelegramNavigate?.('privacy');
  });
  $('telegramMirrorAccessDrawer')?.addEventListener('toggle',event=>{
    // Don't mark the initial native <details> toggle as user choice.
    if (event.isTrusted) event.currentTarget.dataset.userToggled='1';
  });
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
      'Для будущих удалений включи Anti-Delete через Telegram Business для выбранных или всех личных чатов. История через код/QR сохраняет содержимое выбранных чатов, но без события Telegram не доказывает удаление.'+
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
  // Only append more rows when the owner reaches the visible bottom.
  if('IntersectionObserver' in window && $('telegramMirrorMore')){
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(e=>e.isIntersecting)||state.loading||!state.hasMore||state.page===0)return;
      if(state.autoPages>=2||$('telegramChatsView')?.hidden ||
        document.querySelector('.screen.active')?.dataset?.screen!=='telegram')return;
      state.autoPages++;void loadChats();
    },{rootMargin:'170px'});
    observer.observe($('telegramMirrorMore'));
  }
  // Filtering 500 dialogues on every keystroke can jank Android WebView;
  // debounce DOM replacement while keeping typed input responsive.
  $('telegramMirrorSearch')?.addEventListener('input',event=>{
    state.search=event.target.value;
    clearTimeout(chatFilterTimer);
    chatFilterTimer=setTimeout(()=>{
      chatFilterTimer=null;
      if(!resetOwner())renderChats();
    },110);
  });
  $('telegramMirrorSearchClear')?.addEventListener('click',()=>{
    clearTimeout(chatFilterTimer);chatFilterTimer=null;
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
    const photo=event.target.closest('[data-mirror-photo]');
    if(photo){openPhotoViewer(photo.dataset.mirrorPhoto);return;}
    const retry=event.target.closest('[data-mirror-preview]');
    if(retry){
      const id=Number(retry.dataset.mirrorPreview);
      if(Number.isSafeInteger(id)&&id>0&&!state.previewInflight.has(id)){
        state.previewSeen.delete(id);loadInlinePreviews({requestedId:id});
      }
      return;
    }
    const button=event.target.closest('[data-mirror-file]');
    if(button)openArchivedFile(button);
    const liveFile=event.target.closest('[data-mirror-live-file]');
    if(liveFile)openLiveAttachment(liveFile);
    const reply=event.target.closest('[data-mirror-reply]');
    if(reply){
      const message=state.messages.find(m=>String(m.id)===String(reply.dataset.mirrorReply));
      if(!message||!canSendInThread(state.thread))return;
      const mid=Number(message.id);
      if(!Number.isSafeInteger(mid)||mid<1)return;
      state.replyTo={id:mid,preview:String(message.text||mediaLabels[message.media]||'Сообщение').slice(0,120)};
      renderReplyPreview();
      $('telegramThreadCompose')?.focus();
      haptic();
    }
  });
  $('telegramThreadSearchToggle')?.addEventListener('click',()=>{
    const bar=$('telegramThreadFind');
    if(!bar)return;
    if(!bar.hidden){closeThreadSearch();renderMessages({anchor:visibleMessageAnchor()});return;}
    bar.hidden=false;
    $('telegramThreadSearchToggle')?.setAttribute('aria-expanded','true');
    refreshThreadSearch();
    $('telegramThreadFindInput')?.focus();
  });
  $('telegramThreadFindInput')?.addEventListener('input',event=>{
    state.threadSearch=String(event.target.value||'').slice(0,90);
    state.threadSearchIndex=0;
    const anchor=visibleMessageAnchor();
    renderMessages({anchor});
    refreshThreadSearch({jump:true});
  });
  function moveThreadSearch(delta){
    const matches=loadedSearchMatches();
    if(!matches.length)return;
    state.threadSearchIndex=(state.threadSearchIndex+delta+matches.length)%matches.length;
    refreshThreadSearch({jump:true});
  }
  $('telegramThreadFindPrev')?.addEventListener('click',()=>moveThreadSearch(-1));
  $('telegramThreadFindNext')?.addEventListener('click',()=>moveThreadSearch(1));
  $('telegramThreadFindClose')?.addEventListener('click',()=>{
    const anchor=visibleMessageAnchor();closeThreadSearch();renderMessages({anchor});
  });
  $('telegramThreadFindInput')?.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();const anchor=visibleMessageAnchor();closeThreadSearch();renderMessages({anchor});
    }else if(event.key==='Enter'){
      event.preventDefault();moveThreadSearch(event.shiftKey?-1:1);
    }
  });
  $('telegramThreadMessages')?.addEventListener('scroll',()=>{
    // Browsers can emit dozens of scroll events per frame; schedule a single
    // inexpensive bottom-distance check rather than rebuilding messages.
    if(showLatestShortcut.frame)return;
    showLatestShortcut.frame=requestAnimationFrame(()=>{
      showLatestShortcut.frame=0;
      showLatestShortcut();
      loadInlinePreviews();
    });
  },{passive:true});
  $('telegramThreadJumpLatest')?.addEventListener('click',()=>{
    const box=$('telegramThreadMessages');if(!box)return;
    box.scrollTo({top:box.scrollHeight,behavior:'smooth'});
    const button=$('telegramThreadJumpLatest');
    if(button)button.hidden=true;
  });
  $('telegramThreadPhotoClose')?.addEventListener('click',closePhotoViewer);
  $('telegramThreadPhotoDialog')?.addEventListener('click',event=>{
    if(event.target===event.currentTarget)closePhotoViewer();
  });
  $('telegramThreadPhotoDialog')?.addEventListener('close',()=>{
    if($('telegramThreadPhotoFull'))$('telegramThreadPhotoFull').removeAttribute('src');
    if($('telegramThreadPhotoSave'))$('telegramThreadPhotoSave').removeAttribute('href');
  });
  $('telegramThreadBack')?.addEventListener('click',back);
  $('telegramThreadRefresh')?.addEventListener('click',()=>loadMessages({reset:true}));
  $('telegramThreadSyncNow')?.addEventListener('click',()=>{
    if(state.syncBusy||state.threadLoading)return;
    stopThreadSync();void pollThread({manual:true});
  });
  $('telegramThreadOlder')?.addEventListener('click',()=>loadMessages());
  window.addEventListener('veto:screen-changed',event=>{
    resetOwner();
    const current=event.detail?.screen;
    if(current!=='telegram'){
      closeVetoMessengerTools();
      if($('vetoMessengerIntelArea'))$('vetoMessengerIntelArea').hidden=true;
      clearIntelSearch({close:true});
      cancelVoiceCapture();stopThreadSync();
    }else{
      if(state.thread)scheduleThreadSync(3500);
      else if(state.chats.length===0&&!state.loading)loadChats({reset:true});
    }
  });
  window.addEventListener('focus',resetOwner);
  window.addEventListener('pageshow',resetOwner);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopThreadSync();
    else if(!resetOwner()&&state.thread)scheduleThreadSync(2800);
  });
  window.addEventListener('online',()=>{if(state.thread)scheduleThreadSync(1800)});
  window.addEventListener('offline',()=>{
    stopThreadSync();syncLabel('Нет сети · сообщения сохранены на этом экране');
  });
  // Opening a deep-linked screen may precede the first screen-change event.
  if(document.querySelector('.screen.active')?.dataset?.screen==='telegram')
    loadChats({reset:true});
})();
