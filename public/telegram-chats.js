(() => {
  'use strict';
  const tg=window.Telegram?.WebApp;
  const $=id=>document.getElementById(id);
  const state={
    chats:[],page:0,hasMore:true,loading:false,
    filter:'all',search:'',generation:0,
    thread:null,messages:[],threadLoading:false,
    threadHasMore:false,threadOffset:0,archiveHasMore:false,archiveOffset:0,liveHasMore:false,threadGeneration:0,
    connectionProof:null,ownerInitData:String(tg?.initData||''),mediaUrls:[],avatarUrls:new Map(),mediaPreviewUrls:new Map(),avatarQueue:[],avatarRequested:new Set(),avatarActive:0,avatarLoaded:0,
    previewActive:0,previewSeen:new Set(),
    drafts:new Map(),sendInFlight:false,lastSendFailure:null,
    pendingAttachment:null,replyTo:null,stickers:[],recording:null,lastRichFailure:null,
    voicePreset:'original',voiceDraft:null,voicePermissionGeneration:0,autoPages:0,
    threadCache:new Map(),syncTimer:null,syncBusy:false,syncFailures:0,lastSyncedAt:null,syncRunId:0,
    threadSearch:'',threadSearchIndex:0,deliveryStage:null,
  };
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
      if(!response.ok||!data.ok)
        throw new Error(data.error||'Не удалось получить переписки');
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
    if(!signed)throw new Error('Открой StoryLab внутри Telegram');
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
      caption,replyTo,stickerId:action==='send_sticker'?String(stickerId):null,
    };
  }
  function sameRichIntent(a,b){
    return Boolean(a&&b&&a.action===b.action&&a.chatId===b.chatId&&
      a.file===b.file&&a.caption===b.caption&&a.replyTo===b.replyTo&&
      a.stickerId===b.stickerId);
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
      }else if(action==='send_sticker')request={...request,stickerId:String(attachmentOrIndex)};
      else return;
      // A file read can outlive both the original thread and the Telegram owner.
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();throw new Error('Аккаунт изменился. Отправка отменена.');}
      if(String(state.thread?.id)!==chatId)throw new Error('Чат изменился. Отправка отменена.');
      await richRequest(action,request);
      if(ownerKey!==state.ownerInitData||ownerKey!==String(tg?.initData||'')){resetOwner();return;}
      if(String(state.thread?.id)===chatId){
        if(field&&!voiceSend)field.value='';
        if(!voiceSend)state.drafts.delete(chatId);
        state.replyTo=null;state.pendingAttachment=null;
        if($('telegramThreadFileInput'))$('telegramThreadFileInput').value='';
        if($('telegramThreadAudioInput'))$('telegramThreadAudioInput').value='';
        if(voiceSend)dropVoiceDraft();
        $('telegramThreadStickerDrawer').hidden=true;
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
  async function openStickerDrawer(){
    if(!canSendInThread(state.thread)||state.sendInFlight)return;
    const pane=$('telegramThreadStickerDrawer'),list=$('telegramThreadStickerList');
    if(!pane||!list)return;
    pane.hidden=!pane.hidden;
    if(pane.hidden)return;
    list.textContent='Загружаю твои недавние стикеры…';
    const chatId=String(state.thread.id);
    try {
      const data=await richRequest('recent_stickers',{chatId});
      if(String(state.thread?.id)!==chatId)return;
      state.stickers=Array.isArray(data.stickers)?data.stickers:[];
      list.innerHTML=state.stickers.length
        ?state.stickers.map(x=>'<button type="button" data-send-sticker="'+safe(x.id)+'" title="Отправить стикер">'+
            safe(x.emoji||'🎭')+'</button>').join('')
        :'<p>В Telegram пока нет недавних стикеров.</p>';
    }catch(error){list.textContent=error.message;}
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
        ' с · '+(draft.preset==='deep'?'Глубже (эквалайзер)':draft.preset==='warm'?'Теплее':
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
  function processedVoiceStream(microphone,preset){
    if(preset==='original')return {recordStream:microphone,close:()=>{}};
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Аудиоэффекты недоступны в этом браузере. Выбери «Оригинал».');
    const context=new AudioCtx();
    if(context.state==='suspended')void context.resume().catch(()=>{});
    const source=context.createMediaStreamSource(microphone);
    const filter=context.createBiquadFilter();
    const compressor=context.createDynamicsCompressor();
    const output=context.createMediaStreamDestination();
    if(preset==='radio'){
      filter.type='bandpass';filter.frequency.value=1600;filter.Q.value=.58;
    }else if(preset==='deep'){
      filter.type='lowshelf';filter.frequency.value=270;filter.gain.value=7;
    }else{
      filter.type='lowshelf';filter.frequency.value=420;filter.gain.value=3;
    }
    compressor.threshold.value=-21;compressor.ratio.value=2.4;
    source.connect(filter);filter.connect(compressor);compressor.connect(output);
    return {recordStream:output.stream,close:()=>{try{source.disconnect();filter.disconnect();compressor.disconnect()}catch{};void context.close().catch(()=>{})}};
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
      effect=processedVoiceStream(stream,preset);
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
  function renderChats(){
    const list=$('telegramMirrorList');
    if(!list)return;
    const items=filteredChats();
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
    if (drawer && !drawer.dataset.userToggled) drawer.open=!state.connectionProof?.verified;
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
    if(reset){
      state.page=0;state.autoPages=0;state.chats=[];state.hasMore=true;state.connectionProof=null;
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
      if(generation===state.generation){state.loading=false;renderChats();}
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
      const ownerChatId=String(state.thread.id),ownerKey=state.ownerInitData;
      const generation=state.threadGeneration;
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
        const container=[...document.querySelectorAll('[data-mirror-preview]')]
          .find(x=>Number(x.dataset.mirrorPreview)===id);
        if(container){
          const btn=document.createElement('button');
          btn.type='button';btn.className='veto-mirror-inline-photo-btn';
          btn.dataset.mirrorPhoto=String(id);btn.setAttribute('aria-label','Развернуть фотографию');
          const img=document.createElement('img');img.className='veto-mirror-inline-photo';
          img.alt='Фото из переписки';img.loading='lazy';img.src=href;
          btn.appendChild(img);container.replaceWith(btn);
        }
      }).catch(()=>{});
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
    state.page=0;state.hasMore=true;state.autoPages=0;
    state.connectionProof=null;state.loading=false;state.threadLoading=false;
    state.sendInFlight=false;state.lastSendFailure=null;state.lastRichFailure=null;
    state.drafts.clear();state.pendingAttachment=null;state.replyTo=null;state.stickers=[];
    state.filter='all';state.search='';state.threadSearch='';state.threadSearchIndex=0;
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
    state.mediaPreviewUrls.clear();state.previewSeen.clear();
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
      const href=URL.createObjectURL(blob);
      state.mediaUrls.push(href);
      const wrapper=document.createElement('div');
      wrapper.className='veto-mirror-media-reveal';
      const mime=String(blob.type||'').toLowerCase();
      if(['image/jpeg','image/png','image/webp','image/gif'].includes(mime)){
        const thumb=document.createElement('button');thumb.type='button';
        thumb.className='veto-mirror-inline-photo-btn';thumb.dataset.mirrorPhoto=String(id);
        thumb.setAttribute('aria-label','Развернуть сохранённое фото');
        const img=document.createElement('img');
        img.src=href;img.alt='Сохранённое вложение из чата';img.loading='lazy';
        thumb.appendChild(img);wrapper.appendChild(thumb);
        state.mediaPreviewUrls.set(String(id),href);
      }else if(mime.startsWith('audio/')){
        const audio=document.createElement('audio');
        audio.controls=true;audio.preload='metadata';audio.src=href;
        audio.setAttribute('aria-label','Сохранённое аудио из VETO Vault');
        wrapper.appendChild(audio);
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
      const href=URL.createObjectURL(blob);
      state.mediaUrls.push(href);
      const element=document.createElement('div');
      element.className='veto-mirror-media-reveal';
      if(blob.type.startsWith('audio/')){
        const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';
        audio.setAttribute('aria-label','Прослушать аудио из Telegram');
        audio.src=href;element.appendChild(audio);
      }else if(['image/png','image/jpeg','image/webp'].includes(blob.type)){
        const thumb=document.createElement('button');thumb.type='button';
        thumb.className='veto-mirror-inline-photo-btn';thumb.dataset.mirrorPhoto=String(id);
        thumb.setAttribute('aria-label','Развернуть фото');
        const image=document.createElement('img');image.src=href;image.alt='Вложение Telegram';
        thumb.appendChild(image);element.appendChild(thumb);
        state.mediaPreviewUrls.set(String(id),href);
      }else if(['video/mp4','video/webm'].includes(blob.type)){
        const video=document.createElement('video');video.src=href;video.controls=true;video.preload='metadata';element.appendChild(video);
      }
      const link=document.createElement('a');link.href=href;link.download='storylab-attachment-'+id;
      link.textContent='Скачать вложение ↓';element.appendChild(link);
      button.after(element);button.hidden=true;
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
        const viewFile=message.saved&&message.media&&message.mediaAvailable
          ?'<button type="button" class="veto-mirror-open-vault" data-mirror-file="'+safe(message.id)+
             '">'+(isAudio?'▶ Слушать сохранённое аудио':'Открыть сохранённый файл ↗')+'</button>'
          :message.media&&!message.deleted&&!message.preservedOnly&&message.media!=='photo'
            ?'<button type="button" class="veto-mirror-open-vault" data-mirror-live-file="'+safe(message.id)+
               '">'+(isAudio?'▶ Слушать в переписке':'Открыть файл из Telegram ↗')+'</button>'
            :'';
        return divider+'<article data-mirror-message-id="'+safe(message.id)+'" class="veto-mirror-bubble'+(message.out?' outgoing':'')+
          (compact?' compact':'')+(message.deleted?' is-deleted':'')+
          '"><div class="veto-mirror-bubble-inner">'+savedBanner+
          (message.sender&&!message.out?'<strong class="veto-mirror-bubble-sender">'+
            safe(message.sender)+'</strong>':'')+
          replyMarkup+media+viewFile+(text?'<p>'+searchedText(text)+'</p>':'')+
          '<footer>'+(canSendInThread(state.thread)&&Number.isSafeInteger(Number(message.id))&&!message.deleted&&!message.preservedOnly
            ?'<button type="button" class="veto-mirror-reply-action" data-mirror-reply="'+safe(message.id)+'" aria-label="Ответить на сообщение">↩</button>':'')+
          (message.replyTo?'<span>↩ '+safe(message.replyTo)+'</span>':'')+
          (message.pending?'<span>Отправляется…</span>':'')+
          (message.sent?'<span>✓</span>':'')+
          (message.edited?'<span>изменено</span>':'')+
          (message.saved&&!message.deleted?'<span title="Сохранено в VETO">↶</span>':'')+
          '<time>'+safe(messageTime(message.date))+'</time></footer></div></article>';
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
    refreshThreadSearch();
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
    $('telegramThreadMessages').innerHTML=empty('Открываю переписку','История загружается из Telegram');
    renderSendComposer();
    threadNotice('');
    const shell=$('telegramMirror');
    shell?.classList.add('thread-mode');
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
  async function loadMessages({reset=false}={}){
    if(resetOwner()||!state.thread||state.threadLoading)return;
    const chatId=String(state.thread.id);
    const rememberedAnchor=state.messages.length?visibleMessageAnchor():null;
    const generation=++state.threadGeneration;
    state.syncRunId++;state.syncBusy=false; // current history load supersedes any old poll
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
      syncLabel('Telegram подключён · проверка каждые 26 сек.');
      scheduleThreadSync();
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
    state.thread=null;state.threadLoading=false;
    state.deliveryStage=null;renderDeliveryStatus();
    state.replyTo=null;state.pendingAttachment=null;renderReplyPreview();renderAttachmentChip();
    $('telegramThreadView').hidden=true;
    $('telegramChatsView').hidden=false;
    $('telegramMirror')?.classList.remove('thread-mode');
    revokeMediaUrls();
    renderSendComposer();
    window.scrollTo({top:0,behavior:'instant'});
  }
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
  $('telegramThreadStickersClose')?.addEventListener('click',()=>{
    $('telegramThreadStickerDrawer').hidden=true;
  });
  $('telegramThreadStickerList')?.addEventListener('click',event=>{
    const btn=event.target.closest('[data-send-sticker]');
    if(btn)sendRichOutgoing('send_sticker',String(btn.dataset.sendSticker));
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
    const photo=event.target.closest('[data-mirror-photo]');
    if(photo){openPhotoViewer(photo.dataset.mirrorPhoto);return;}
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
