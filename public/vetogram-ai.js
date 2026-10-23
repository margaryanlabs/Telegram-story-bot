import {makeApproval,activeApprovals,queueApproval,makeMemoryNote,activeMemoryNotes,buildMemoryContext,MAX_MEMORY_NOTES} from './vetogram-ai-workspace-core.js';
import {makeNegotiationPolicy,verifyNegotiationProposal,negotiationBrief} from './vetogram-negotiator-core.js';
(() => {
  'use strict';
  const tg=window.Telegram?.WebApp,$=id=>document.getElementById(id);
  const root=$('vtaiRoot');
  if(!root)return;
  const state={identity:null,mode:'chat',history:[],last:null,dialogs:[],busy:false,sendIntent:null,approvals:[],memory:[],selectedNotes:new Set(),reviewedApprovalId:null,suggestedChatId:null,negotiationPolicy:null,negotiationDraft:null};
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
    if(state.identity===null){state.identity=init;return true;}
    if(state.identity!==init){reset();state.identity=init;notice('Аккаунт изменился. Предыдущие черновики и заметки очищены.');}
    return true;
  }
  function reset(){
    state.history=[];state.last=null;state.dialogs=[];state.identity=null;state.sendIntent=null;
    state.approvals=[];state.memory=[];state.selectedNotes.clear();state.reviewedApprovalId=null;state.suggestedChatId=null;
    state.negotiationPolicy=null;state.negotiationDraft=null;$('vtaiNegNotice').textContent='Сначала выбери чат и введи условия.';
    $('vtaiIncludeMemory').checked=false;$('vtaiMemoryLabel').value='';$('vtaiMemoryContent').value='';
    renderApprovals();renderMemory();
    $('vtaiConsent').checked=false;$('vtaiReplacePortal').checked=false;$('vtaiPortalReview').hidden=true;
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
    if(!['chat','translate','reply','story','campaign','negotiator'].includes(mode))return;
    if(state.mode!==mode){state.history=[];$('vtaiThread').replaceChildren();state.last=null;state.reviewedApprovalId=null;
      $('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;}
    if(mode!=='negotiator'){state.negotiationPolicy=null;state.negotiationDraft=null;$('vtaiDraft').readOnly=false;}
    state.mode=mode;
    $('vtaiNegPanel').hidden=mode!=='negotiator';
    document.querySelectorAll('[data-vtai-mode]').forEach(b=>{
      b.classList.toggle('active',b.dataset.vtaiMode===mode);
      b.setAttribute('aria-pressed',String(b.dataset.vtaiMode===mode));
    });
    $('vtaiLanguage').hidden=mode!=='translate';
    $('vtaiText').placeholder={
      chat:'Спроси AI или попроси подготовить сообщение…',
      translate:'Вставь текст для перевода…',
      reply:'Опиши ситуацию или вставь сообщение, на которое нужен ответ…',
      story:'О чём создать Story? Для кого, какой стиль и предложение?',
      campaign:'Что продаём или анонсируем? Кто покупатель и какое действие нужно?',
      negotiator:'Вставь сообщение клиента, на которое нужно подготовить ответ…'
    }[mode];
    $('vtaiCreate').textContent=mode==='negotiator'?'Подготовить ответ на переговоры':mode==='campaign'?'Создать Story + Portal':mode==='story'?'Создать текст для Stories':'Спросить VETO AI';
  }
  function setBusy(value){
    state.busy=value;
    $('vtaiCreate').disabled=value;$('vtaiLoadChats').disabled=value;
    $('vtaiSend').disabled=value||!state.last||['story','campaign'].includes(state.mode);
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
    let prompt=state.mode==='translate'
      ?'Переведи точно на '+$('vtaiLanguageSelect').value+'. Верни только перевод:\n'+original
      :original;
    const mode=state.mode,oldHistory=[...state.history];
    let negotiationPolicy=null;
    if(mode==='negotiator'){
      const chatId=$('vtaiNegRecipient').value;
      const match=state.dialogs.find(c=>String(c.id)===chatId);
      if(!match)return notice('Сначала загрузи и выбери один собственный чат.',true);
      try{
        negotiationPolicy=makeNegotiationPolicy({
          owner:owner(),chatId,currency:$('vtaiNegCurrency').value,
          minPrice:$('vtaiNegFloor').value,askingPrice:$('vtaiNegAsking').value,
          maxDiscountPct:$('vtaiNegDiscount').value,
          minutes:$('vtaiNegMinutes').value
        });
        prompt=negotiationBrief(negotiationPolicy,$('vtaiNegGoal').value,original);
      }catch(error){return notice('Проверь цену, скидку, срок и цель: '+error.message,true);}
      state.negotiationDraft=null;
      state.negotiationPolicy=negotiationPolicy;
      $('vtaiNegNotice').textContent='Условия применены только к одному AI-запросу. Отправка остаётся ручной.';
    }
    const approvedNotes=$('vtaiIncludeMemory').checked
      ?buildMemoryContext(state.memory,[...state.selectedNotes],owner()):[];
    // One-shot consent: notes cannot silently leak into the next request.
    $('vtaiIncludeMemory').checked=false;
    setBusy(true);$('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;
    notice('Проверяю AI и дневной лимит. Telegram-сообщения не отправляются.');
    try{
      const answer=await request('/api/vetogram-ai',{mode,prompt,history:mode==='chat'?oldHistory:[],notes:approvedNotes},true);
      if(state.mode!==mode)return notice('Режим изменился. Ответ не применён.',true);
      if(Number.isInteger(Number(answer?.quota?.remainingRequests)))$('vtaiQuota').textContent='Осталось AI-запросов на сегодня (UTC): '+Number(answer.quota.remainingRequests)+'.';
      addBubble(original,'user');addBubble(answer.text,'assistant');
      if(mode==='chat')state.history=[...oldHistory,{role:'user',text:prompt},{role:'assistant',text:answer.text}].slice(-6);
      state.last=answer.text;
      if(mode==='negotiator'){
        const proposal=answer.negotiation;
        const result=verifyNegotiationProposal(negotiationPolicy,proposal,{
          owner:owner(),chatId:negotiationPolicy.chatId
        });
        $('vtaiNegNotice').textContent=result.allowed
          ?'Черновик проверен: '+result.reason+'. Прочитай перед отправкой.'
          :'Предложение заблокировано: '+result.reason+'. Исправь условия и сгенерируй заново.';
        $('vtaiDraft').value=proposal?.reply||answer.text;
        $('vtaiDraft').readOnly=true;
        if(result.allowed){
          state.negotiationDraft=proposal;
          state.negotiationPolicy=negotiationPolicy;
          $('vtaiRecipients').value=negotiationPolicy.chatId;
          $('vtaiReview').hidden=false;
          $('vtaiSend').disabled=false;
        }else{
          state.negotiationDraft=null;
          $('vtaiReview').hidden=true;
        }
        notice(result.allowed?'Переговорный ответ готов. Только ручное подтверждение.'
          :'AI предложил действие вне указанных границ. Отправка заблокирована.',!result.allowed);
      }else if(['story','campaign'].includes(mode)&&answer.story){
        $('vtaiStoryTitle').value=answer.story.title;
        $('vtaiStorySubtitle').value=answer.story.subtitle;
        $('vtaiStoryCaption').value=answer.story.caption;
        $('vtaiStoryReview').hidden=false;
        $('vtaiPortalReview').hidden=!answer.portal;
        $('vtaiReplacePortal').checked=false;
        if(answer.portal){
          $('vtaiPortalType').value=answer.portal.type;
          $('vtaiPortalTitle').value=answer.portal.title;
          $('vtaiPortalDescription').value=answer.portal.description;
          $('vtaiPortalCta').value=answer.portal.cta;
        }
        notice('Текст готов. Отредактируй его и перенеси в Story Engine.');
      }else{
        $('vtaiDraft').value=answer.text;
        $('vtaiReview').hidden=false;
        $('vtaiSend').disabled=!state.dialogs.length;
        notice('Текст подготовлен. Ничего не отправлено.');
      }
    }catch(error){notice(error.name==='AbortError'?'AI не ответил вовремя':error.message,true);}
    finally{setBusy(false);$('vtaiSend').disabled=!state.last||['story','campaign'].includes(state.mode)||!state.dialogs.length||
      (state.mode==='negotiator'&&!state.negotiationDraft);}
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
      const negPicker=$('vtaiNegRecipient');negPicker.replaceChildren(new Option('Выбери один чат',''));
      for(const c of chats)negPicker.append(new Option(String(c.title||'Чат').slice(0,90),String(c.id)));
      if(state.suggestedChatId&&chats.some(c=>String(c.id)===state.suggestedChatId))
        picker.value=state.suggestedChatId;
      notice(chats.length?'Чаты загружены. AI не получил их содержимое.':'Доступных чатов для отправки нет.',!chats.length);
    }catch(error){notice(error.message,true)}
    finally{setBusy(false);$('vtaiSend').disabled=!state.last||!state.dialogs.length||['story','campaign'].includes(state.mode)||(state.mode==='negotiator'&&!state.negotiationDraft);}
  }
  function validNegotiatorSend(chatId,message){
    if(state.mode!=='negotiator')return true;
    const policy=state.negotiationPolicy,proposal=state.negotiationDraft;
    if(!policy||!proposal||message!==proposal.reply)return false;
    return verifyNegotiationProposal(policy,proposal,{owner:owner(),chatId}).allowed;
  }
  const requestedSendKey=(ownerId,chatId,text)=>JSON.stringify([ownerId,chatId,text]);
  async function send(){
    if(state.busy||!safeIdentity())return;
    const chatId=$('vtaiRecipients').value;
    if(!state.dialogs.some(c=>String(c.id)===chatId))return notice('Выбери чат из списка',true);
    const message=$('vtaiDraft').value.trim();
    if(!message||message.length>4096)return notice('Длина сообщения: 1–4096 символов',true);
    if(!validNegotiatorSend(chatId,message))return notice('Разрешение Negotiator истекло или ответ изменён. Создай новый черновик.',true);
    const title=state.dialogs.find(c=>String(c.id)===chatId)?.title||'чат';
    // No autonomous sends. This confirmation is separate from AI-provider consent.
    if(!window.confirm('Отправить это сообщение от твоего имени в чат «'+String(title).slice(0,70)+'»?\n\n'+message.slice(0,650)))return;
    if(!safeIdentity())return;
    if(!window.crypto?.randomUUID)return notice('Безопасная отправка не поддерживается этим браузером',true);
    // Keep a stable Telegram random_id for uncertain delivery retries.
    // A new recipient/message/owner gets a different send intent.
    const intentKey=requestedSendKey(owner(),chatId,message);
    if(state.sendIntent?.key!==intentKey)state.sendIntent={key:intentKey,nonce:window.crypto.randomUUID()};
    setBusy(true);
    notice('Отправляю после твоего подтверждения…');
    try{
      const result=await request('/api/telegram-send',{
        action:'send_message',chatId,message,nonce:state.sendIntent.nonce
      });
      notice(result.sent?'Telegram принял сообщение.':'Отправка не подтверждена.',!result.sent);
      if(result.sent){
        const reviewed=state.approvals.find(x=>x.id===state.reviewedApprovalId);
        if(reviewed&&reviewed.chatId===chatId&&reviewed.message===message&&reviewed.owner===owner()){
          state.approvals=state.approvals.filter(x=>x.id!==reviewed.id);
          renderApprovals();
        }
        state.reviewedApprovalId=null;
        $('vtaiDraft').value='';$('vtaiReview').hidden=true;state.last=null;state.sendIntent=null;
      }
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
    const replacePortal=!$('vtaiPortalReview').hidden&&$('vtaiReplacePortal').checked;
    const portal=replacePortal?{
      type:$('vtaiPortalType').value,title:$('vtaiPortalTitle').value.trim(),
      description:$('vtaiPortalDescription').value.trim(),
      cta:$('vtaiPortalCta').value.trim()
    }:null;
    if(replacePortal&&(!portal.title||!portal.cta))return notice('Заполни заголовок и кнопку Portal',true);
    if(!window.confirm(replacePortal?'Заменить текст Story и текущий Portal? Это не публикация.':'Перенести текст в текущий черновик? Фото, слои и Portal сохранятся.'))return;
    if(!window.VetoTelegramNavigate?.('story-engine'))return notice('Story Engine недоступен.',true);
    if(typeof window.VetoTelegramApplyAiStory!=='function')return notice('Story Engine ещё не готов. Повтори действие.',true);
    try{
      const applied=await window.VetoTelegramApplyAiStory({ownerId:requestedOwner,story,replacePortal,portal});
      if(snapshot!==signed()||requestedOwner!==owner())return notice('Аккаунт изменился, перенос отменён.',true);
      if(!applied)return notice('Не удалось применить текст. Попробуй снова.',true);
      notice('Тексты добавлены в Story Engine. Проверь кадр и сохрани черновик.');
    }catch(error){notice('Перенос в Story Engine не удался. Сохрани текст вручную.',true)}
  }

  function renderApprovals(){
    const list=$('vtaiApprovalList');list.replaceChildren();
    const now=Date.now(),user=owner();
    state.approvals=/^\d{1,20}$/.test(user)
      ?activeApprovals(state.approvals,user,now):[];
    $('vtaiApprovalCount').textContent=String(state.approvals.length);
    if(!state.approvals.length){
      const empty=document.createElement('p');empty.className='vtai-note';
      empty.textContent='Очередь пуста. Подготовь ответ, выбери получателя и добавь сообщение.';
      list.append(empty);return;
    }
    for(const item of state.approvals){
      const card=document.createElement('article');card.className='vtai-workspace-item';
      const head=document.createElement('strong');head.textContent=item.chatTitle;
      const body=document.createElement('p');body.textContent=item.message;
      const actions=document.createElement('div');actions.className='vtai-row';
      const review=document.createElement('button');review.type='button';review.className='vtai-action';
      review.textContent='Проверить и отправить';
      review.addEventListener('click',()=>void reviewApproval(item.id));
      const drop=document.createElement('button');drop.type='button';drop.className='vtai-action';
      drop.textContent='Отклонить';
      drop.addEventListener('click',()=>{
        if(!safeIdentity())return;
        state.approvals=state.approvals.filter(entry=>entry.id!==item.id);renderApprovals();
      });
      actions.append(review,drop);card.append(head,body,actions);list.append(card);
    }
  }
  function queueCurrent(){
    if(state.busy||!safeIdentity())return;
    const chatId=$('vtaiRecipients').value;
    const chat=state.dialogs.find(x=>String(x.id)===chatId);
    const message=$('vtaiDraft').value.trim();
    if(!chat||!message||message.length>4096)return notice('Сначала подготовь ответ и выбери получателя.',true);
    if(!validNegotiatorSend(chatId,message))return notice('Negotiator: условия или срок больше не действуют.',true);
    if(!window.crypto?.randomUUID)return notice('Невозможно создать безопасный черновик.',true);
    try{
      const key=requestedSendKey(owner(),chatId,message);
      const nonce=state.sendIntent?.key===key?state.sendIntent.nonce:crypto.randomUUID();
      const pending=makeApproval({owner:owner(),chatId,chatTitle:chat.title,message,
        nonce,id:crypto.randomUUID()});
      state.approvals=queueApproval(state.approvals,pending);
      renderApprovals();notice('Добавлено в Approval Center. Ничего не отправлено.');
    }catch(error){notice('Не удалось создать черновик подтверждения.',true)}
  }
  async function reviewApproval(id){
    if(state.busy||!safeIdentity())return;
    const item=activeApprovals(state.approvals,owner()).find(entry=>entry.id===id);
    if(!item)return notice('Черновик больше не доступен.',true);
    if(!state.dialogs.some(chat=>String(chat.id)===item.chatId))await loadChats();
    if(!safeIdentity()||!state.dialogs.some(chat=>String(chat.id)===item.chatId))
      return notice('Этот Telegram-чат сейчас недоступен.',true);
    setMode('reply');
    $('vtaiRecipients').value=item.chatId;
    $('vtaiDraft').value=item.message;
    $('vtaiReview').hidden=false;
    state.last=item.message;
    state.reviewedApprovalId=item.id;
    state.sendIntent={key:requestedSendKey(owner(),item.chatId,item.message),nonce:item.nonce};
    $('vtaiSend').disabled=false;
    $('vtaiReview').scrollIntoView?.({block:'start',behavior:'smooth'});
    notice('Проверь получателя и текст. Отправка требует отдельного подтверждения.');
  }
  function renderMemory(){
    const list=$('vtaiMemoryList');list.replaceChildren();
    const user=owner();
    state.memory=/^\d{1,20}$/.test(user)?activeMemoryNotes(state.memory,user):[];
    for(const note of state.memory){
      const card=document.createElement('article');card.className='vtai-workspace-item';
      const label=document.createElement('label');label.className='vtai-consent';
      const choose=document.createElement('input');choose.type='checkbox';
      choose.checked=state.selectedNotes.has(note.id);
      choose.addEventListener('change',()=>{
        if(!safeIdentity())return;
        if(choose.checked&&state.selectedNotes.size>=3){
          choose.checked=false;notice('Можно использовать максимум три заметки за запрос.',true);return;
        }
        if(choose.checked)state.selectedNotes.add(note.id);
        else state.selectedNotes.delete(note.id);
      });
      const title=document.createElement('strong');title.textContent=note.label;
      const body=document.createElement('p');body.textContent=note.content;
      label.append(choose,title);
      const drop=document.createElement('button');drop.type='button';drop.className='vtai-action';
      drop.textContent='Удалить';
      drop.addEventListener('click',()=>{
        if(!safeIdentity())return;
        state.memory=state.memory.filter(x=>x.id!==note.id);state.selectedNotes.delete(note.id);
        renderMemory();
      });
      card.append(label,body,drop);list.append(card);
    }
    if(!state.memory.length){
      const empty=document.createElement('p');empty.className='vtai-note';
      empty.textContent='Пока пусто. Заметки исчезнут после закрытия Mini App.';
      list.append(empty);
    }
  }
  function addMemory(){
    if(!safeIdentity())return;
    if(state.memory.length>=MAX_MEMORY_NOTES)return notice('Можно сохранить до восьми заметок на время этой сессии.',true);
    if(!window.crypto?.randomUUID)return notice('Браузер не поддерживает безопасные идентификаторы.',true);
    try{
      const note=makeMemoryNote({owner:owner(),id:crypto.randomUUID(),
        label:$('vtaiMemoryLabel').value,content:$('vtaiMemoryContent').value});
      state.memory=[...state.memory,note];
      $('vtaiMemoryLabel').value='';$('vtaiMemoryContent').value='';
      renderMemory();
      notice('Заметка добавлена только в память окна. Она не передана AI.');
    }catch(error){notice('Укажи название и содержание заметки.',true)}
  }

  $('vtaiCreate').addEventListener('click',()=>void generate());
  $('vtaiLoadChats').addEventListener('click',()=>void loadChats());
  $('vtaiNegLoadChats').addEventListener('click',()=>void loadChats());
  $('vtaiSend').addEventListener('click',()=>void send());
  $('vtaiQueue').addEventListener('click',queueCurrent);
  $('vtaiClearApprovals').addEventListener('click',()=>{
    if(!safeIdentity())return;
    state.approvals=[];state.reviewedApprovalId=null;renderApprovals();
  });
  $('vtaiAddMemory').addEventListener('click',addMemory);
  $('vtaiClearMemory').addEventListener('click',()=>{
    if(!safeIdentity())return;
    state.memory=[];state.selectedNotes.clear();$('vtaiIncludeMemory').checked=false;renderMemory();
  });
  $('vtaiApplyStory').addEventListener('click',()=>void applyStory());
  document.querySelectorAll('[data-vtai-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.vtaiMode)));
  document.querySelectorAll('[data-open-screen="ai"][data-ai-mode="story"]').forEach(b=>b.addEventListener('click',()=>setMode('story')));
  // One-tap reply from the currently open Telegram thread. Local copy only.
  // Require fresh consent before passing someone else's content to any AI model.
  window.addEventListener('vetogram:ai-prefill',event=>{
    const detail=event?.detail||{};
    if(!safeIdentity()||detail.ownerId!==owner()||detail.signed!==signed())return;
    if(!/^-?\d{1,22}$/.test(String(detail.chatId||'')))return;
    setMode('reply');
    const message=String(detail.text||'').slice(0,1500).trim();
    if(!message)return;
    const person=String(detail.chatTitle||'Telegram').slice(0,80);
    $('vtaiText').value='Подготовь вежливый и конкретный ответ на сообщение из чата «'+person+'»:\n'+message;
    $('vtaiConsent').checked=false;
    $('vtaiIncludeMemory').checked=false;
    state.suggestedChatId=String(detail.chatId);
    notice('Сообщение вставлено только в черновик. Проверь текст и разрешения перед AI-запросом.');
  });
  window.addEventListener('veto:screen-changed',e=>{
    if(e?.detail?.screen==='ai')safeIdentity();
    else if(state.busy===false)$('vtaiNotice').hidden=true;
  });
  window.addEventListener('pageshow',()=>{if(state.identity&&state.identity!==signed())reset()});
  setMode('chat');
  renderApprovals();renderMemory();
})();
