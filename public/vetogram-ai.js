(() => {
  'use strict';
  const tg=window.Telegram?.WebApp,$=id=>document.getElementById(id);
  const root=$('vtaiRoot');
  if(!root)return;
  const state={identity:null,mode:'chat',history:[],last:null,dialogs:[],busy:false};
  const owner=()=>tg?.initData?String(tg?.initDataUnsafe?.user?.id||''):'';
  const signed=()=>String(tg?.initData||'');
  function notice(message,error=false){
    const box=$('vtaiNotice');box.textContent=String(message||'');box.hidden=false;
    box.dataset.error=error?'true':'false';
  }
  function safeIdentity(){
    const id=owner(),init=signed();
    if(!/^\d{1,20}$/.test(id)||!init){
      reset();notice('Открой VETOGRAM внутри собственного Telegram',true);return false;
    }
    if(state.identity!==init){reset();state.identity=init;}
    return true;
  }
  function reset(){
    state.history=[];state.last=null;state.dialogs=[];state.identity=null;
    $('vtaiThread').replaceChildren();$('vtaiText').value='';$('vtaiDraft').value='';
    $('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;
    $('vtaiRecipients').replaceChildren();$('vtaiRecipients').append(new Option('Сначала загрузить чаты',''));
    $('vtaiSend').disabled=true;
  }
  function addBubble(text,kind){
    const card=document.createElement('div');card.className='vtai-bubble '+kind;
    card.textContent=String(text||'');
    $('vtaiThread').append(card);
    card.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  function setMode(mode){
    if(!['chat','translate','reply','story'].includes(mode))return;
    if(state.mode!==mode){state.history=[];$('vtaiThread').replaceChildren();state.last=null;
      $('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;}
    state.mode=mode;
    document.querySelectorAll('[data-vtai-mode]').forEach(b=>{
      b.classList.toggle('active',b.dataset.vtaiMode===mode);
      b.setAttribute('aria-pressed',String(b.dataset.vtaiMode===mode));
    });
    $('vtaiLanguage').hidden=mode!=='translate';
    $('vtaiText').placeholder={
      chat:'Спроси AI или попроси подготовить сообщение…',
      translate:'Вставь текст для перевода…',
      reply:'Опиши ситуацию или вставь сообщение, на которое нужен ответ…',
      story:'О чём создать Story? Для кого, какой стиль и предложение?'
    }[mode];
    $('vtaiCreate').textContent=mode==='story'?'Создать текст для Stories':'Спросить VETO AI';
  }
  function setBusy(value){
    state.busy=value;
    $('vtaiCreate').disabled=value;$('vtaiLoadChats').disabled=value;
    $('vtaiSend').disabled=value||!state.last||state.mode==='story';
  }
  async function request(url,body,consent=false){
    const requestOwner=signed();
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),21000);
    try{
      const result=await fetch(url,{method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':requestOwner,
          ...(consent?{'x-vetogram-ai-consent':'yes'}:{})},
        body:JSON.stringify(body),signal:abort.signal});
      const json=await result.json().catch(()=>({}));
      if(signed()!==requestOwner||!owner()){reset();throw Error('Аккаунт изменился. Действие отменено.');}
      if(!result.ok||!json.ok)throw Error(json.error||'Сервис недоступен');
      return json;
    }finally{clearTimeout(timeout)}
  }
  async function generate(){
    if(state.busy||!safeIdentity())return;
    if(!$('vtaiConsent').checked)return notice('Разреши передачу введённого текста AI-провайдеру',true);
    const original=$('vtaiText').value.trim();
    if(original.length<2||original.length>3000)return notice('Введите от 2 до 3000 символов',true);
    const prompt=state.mode==='translate'
      ?'Переведи точно на '+$('vtaiLanguageSelect').value+'. Верни только перевод:\n'+original
      :original;
    const mode=state.mode,oldHistory=[...state.history];
    setBusy(true);$('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;
    notice('Запрос отправлен AI-провайдеру. Telegram-сообщения не отправляются.');
    try{
      const answer=await request('/api/vetogram-ai',{mode,prompt,history:mode==='chat'?oldHistory:[]},true);
      if(state.mode!==mode)return notice('Режим изменился. Ответ не применён.',true);
      if(Number.isInteger(Number(answer?.quota?.remainingRequests)))$('vtaiQuota').textContent='Осталось AI-запросов на сегодня (UTC): '+Number(answer.quota.remainingRequests)+'.';
      addBubble(original,'user');addBubble(answer.text,'assistant');
      if(mode==='chat')state.history=[...oldHistory,{role:'user',text:prompt},{role:'assistant',text:answer.text}].slice(-6);
      state.last=answer.text;
      if(mode==='story'&&answer.story){
        $('vtaiStoryTitle').value=answer.story.title;
        $('vtaiStorySubtitle').value=answer.story.subtitle;
        $('vtaiStoryCaption').value=answer.story.caption;
        $('vtaiStoryReview').hidden=false;
        notice('Текст готов. Отредактируй его и перенеси в Story Engine.');
      }else{
        $('vtaiDraft').value=answer.text;
        $('vtaiReview').hidden=false;
        $('vtaiSend').disabled=!state.dialogs.length;
        notice('Текст подготовлен. Ничего не отправлено.');
      }
    }catch(error){notice(error.name==='AbortError'?'AI не ответил вовремя':error.message,true);}
    finally{setBusy(false);$('vtaiSend').disabled=!state.last||state.mode==='story'||!state.dialogs.length;}
  }
  async function loadChats(){
    if(state.busy||!safeIdentity())return;
    setBusy(true);notice('Загружаю только список твоих чатов, без передачи сообщений AI.');
    try{
      const data=await request('/api/telegram-chats',{action:'list',page:0});
      // Server still validates the owner and recipient before every send.
      const chats=(data.chats||[]).filter(c=>!c.archiveOnly&&c.serverCanSend!==false &&
        ['private','group','bot','saved'].includes(c.type)&&/^-?\d{1,22}$/.test(String(c.id)));
      state.dialogs=chats;
      const picker=$('vtaiRecipients');picker.replaceChildren(new Option('Выбрать получателя',''));
      for(const c of chats)picker.append(new Option(String(c.title||'Чат').slice(0,90),String(c.id)));
      notice(chats.length?'Чаты загружены. AI не получил их содержимое.':'Доступных чатов для отправки нет.',!chats.length);
    }catch(error){notice(error.message,true)}
    finally{setBusy(false);$('vtaiSend').disabled=!state.last||!state.dialogs.length||state.mode==='story';}
  }
  async function send(){
    if(state.busy||!safeIdentity())return;
    const chatId=$('vtaiRecipients').value;
    if(!state.dialogs.some(c=>String(c.id)===chatId))return notice('Выбери чат из списка',true);
    const message=$('vtaiDraft').value.trim();
    if(!message||message.length>4096)return notice('Длина сообщения: 1–4096 символов',true);
    const title=state.dialogs.find(c=>String(c.id)===chatId)?.title||'чат';
    // No autonomous sends. This confirmation is separate from AI-provider consent.
    if(!window.confirm('Отправить это сообщение от твоего имени в чат «'+String(title).slice(0,70)+'»?\n\n'+message.slice(0,650)))return;
    if(!window.crypto?.randomUUID)return notice('Безопасная отправка не поддерживается этим браузером',true);
    setBusy(true);
    notice('Отправляю после твоего подтверждения…');
    try{
      const result=await request('/api/telegram-send',{
        action:'send_message',chatId,message,nonce:window.crypto.randomUUID()
      });
      notice(result.sent?'Telegram принял сообщение.':'Отправка не подтверждена.',!result.sent);
      if(result.sent){$('vtaiDraft').value='';$('vtaiReview').hidden=true;state.last=null;}
    }catch(error){notice(error.message+'. Если произошёл сбой сети, сначала проверь чат, прежде чем отправлять снова.',true)}
    finally{setBusy(false)}
  }
  async function applyStory(){
    if(state.busy||!safeIdentity())return;
    const snapshot=signed(),requestedOwner=owner();
    const story={
      title:$('vtaiStoryTitle').value.trim().slice(0,90),
      subtitle:$('vtaiStorySubtitle').value.trim().slice(0,180),
      caption:$('vtaiStoryCaption').value.trim().slice(0,800)
    };
    if(!story.title||!story.subtitle)return notice('У Story нужны заголовок и подзаголовок',true);
    if(!window.confirm('Перенести этот текст в текущий черновик? Фото, слои и Portal сохранятся.'))return;
    if(!window.VetoTelegramNavigate?.('story-engine'))return notice('Story Engine недоступен.',true);
    if(typeof window.VetoTelegramApplyAiStory!=='function')return notice('Story Engine ещё не готов. Повтори действие.',true);
    try{
      const applied=await window.VetoTelegramApplyAiStory({ownerId:requestedOwner,story});
      if(snapshot!==signed()||requestedOwner!==owner())return notice('Аккаунт изменился, перенос отменён.',true);
      if(!applied)return notice('Не удалось применить текст. Попробуй снова.',true);
      notice('Тексты добавлены в Story Engine. Проверь кадр и сохрани черновик.');
    }catch(error){notice('Перенос в Story Engine не удался. Сохрани текст вручную.',true)}
  }
  $('vtaiCreate').addEventListener('click',()=>void generate());
  $('vtaiLoadChats').addEventListener('click',()=>void loadChats());
  $('vtaiSend').addEventListener('click',()=>void send());
  $('vtaiApplyStory').addEventListener('click',()=>void applyStory());
  document.querySelectorAll('[data-vtai-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.vtaiMode)));
  document.querySelectorAll('[data-open-screen="ai"][data-ai-mode="story"]').forEach(b=>b.addEventListener('click',()=>setMode('story')));
  window.addEventListener('veto:screen-changed',e=>{
    if(e?.detail?.screen==='ai')safeIdentity();
    else if(state.busy===false)$('vtaiNotice').hidden=true;
  });
  window.addEventListener('pageshow',()=>{if(state.identity&&state.identity!==signed())reset()});
  setMode('chat');
})();
