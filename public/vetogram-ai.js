import {makeApproval,activeApprovals,queueApproval,makeMemoryNote,activeMemoryNotes,buildMemoryContext,MAX_MEMORY_NOTES} from './vetogram-ai-workspace-core.js';
import {makeNegotiationPolicy,verifyNegotiationProposal,negotiationBrief} from './vetogram-negotiator-core.js';
import {mergeSendableDialogs,shouldContinueDialogLookup,hasMoreDialogPages} from './vetogram-ai-dialogs-core.js';
import {actionRecipientCandidates,actionDraftValid,isExplicitActionCommand} from './vetogram-ai-action-core.js';
(() => {
  'use strict';
  const tg=window.Telegram?.WebApp,$=id=>document.getElementById(id);
  const root=$('vtaiRoot');
  if(!root)return;
  const state={identity:null,mode:'chat',history:[],last:null,dialogs:[],busy:false,sendIntent:null,approvals:[],memory:[],selectedNotes:new Set(),reviewedApprovalId:null,suggestedChatId:null,negotiationPolicy:null,negotiationDraft:null,negotiationGrant:null,memoryRevision:null,memoryBusy:false,agentPaused:null,agentBusy:false,chatNextPage:0,chatHasMore:false,actionDraft:null,actionRecipientConfirmed:null,brief:null};
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
    state.actionDraft=null;state.actionRecipientConfirmed=null;state.brief=null;
    $('vtaiBriefList').replaceChildren();$('vtaiBriefStatus').textContent='Нет результатов для текущего аккаунта.';
    state.approvals=[];state.memory=[];state.selectedNotes.clear();state.reviewedApprovalId=null;state.suggestedChatId=null;
    state.memoryRevision=null;state.memoryBusy=false;state.agentPaused=null;state.agentBusy=false;state.chatNextPage=0;state.chatHasMore=false;
    $('vtaiMoreChats').hidden=true;$('vtaiNegMoreChats').hidden=true;$('vtaiActionMore').hidden=true;
    $('vtaiActionMatches').replaceChildren(new Option('Сначала подготовь сообщение',''));
    $('vtaiActionStatus').textContent='Опиши, кому и что нужно написать.';
    $('vtaiAgentState').textContent='Статус не проверен для текущего аккаунта.';
    $('vtaiAgentEvents').replaceChildren();$('vtaiMemoryCloudStatus').textContent='Облачные заметки не загружены. Серверное шифрование, не E2EE.';
    state.negotiationPolicy=null;state.negotiationDraft=null;state.negotiationGrant=null;$('vtaiNegNotice').textContent='Сначала выбери чат и введи условия.';
    $('vtaiIncludeMemory').checked=false;$('vtaiMemoryLabel').value='';$('vtaiMemoryContent').value='';
    renderApprovals();renderMemory();
    $('vtaiConsent').checked=false;$('vtaiReplacePortal').checked=false;$('vtaiPortalReview').hidden=true;
    $('vtaiThread').replaceChildren();$('vtaiText').value='';$('vtaiDraft').value='';
    $('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;
    $('vtaiRecipients').replaceChildren();$('vtaiRecipients').append(new Option('Сначала загрузить чаты',''));
    // Owner-switch privacy: remove hidden form data as well as visible history.
    $('vtaiNegRecipient').replaceChildren(new Option('Сначала загрузить чаты',''));
    for(const id of ['vtaiStoryTitle','vtaiStorySubtitle','vtaiStoryCaption',
      'vtaiPortalTitle','vtaiPortalDescription','vtaiPortalCta','vtaiNegGoal'])
      $(id).value='';
    $('vtaiPortalType').value='offer';
    $('vtaiNegCurrency').value='USD';$('vtaiNegAsking').value='500';
    $('vtaiNegFloor').value='475';$('vtaiNegDiscount').value='5';
    $('vtaiNegMinutes').value='60';
    $('vtaiDraft').readOnly=false;
    $('vtaiQuota').textContent='Потребление AI ограничено дневным бюджетом. Данные Telegram не анализируются автоматически.';
    state.busy=false;
    $('vtaiCreate').disabled=false;$('vtaiLoadChats').disabled=false;
    $('vtaiNegLoadChats').disabled=false;
    $('vtaiSend').disabled=true;
    setMode('chat');
  }
  function addBubble(text,kind){
    const card=document.createElement('div');card.className='vtai-bubble '+kind;
    card.textContent=String(text||'');
    $('vtaiThread').append(card);
    card.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  function setMode(mode){
    if(!['chat','translate','reply','story','campaign','negotiator','action','brief'].includes(mode))return;
    if(state.mode!==mode){state.history=[];$('vtaiThread').replaceChildren();state.last=null;state.reviewedApprovalId=null;
      $('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;}
    if(mode!=='negotiator'){state.negotiationPolicy=null;state.negotiationDraft=null;$('vtaiDraft').readOnly=false;}
    if(mode!=='action'){state.actionDraft=null;state.actionRecipientConfirmed=null;}
    state.mode=mode;
    $('vtaiNegPanel').hidden=mode!=='negotiator';
    $('vtaiActionPanel').hidden=mode!=='action';
    $('vtaiBriefPanel').hidden=mode!=='brief';
    if(mode!=='brief'){state.brief=null;$('vtaiBriefList').replaceChildren();}
    document.querySelectorAll('[data-vtai-mode]').forEach(b=>{
      b.classList.toggle('active',b.dataset.vtaiMode===mode);
      b.setAttribute('aria-pressed',String(b.dataset.vtaiMode===mode));
    });
    $('vtaiLanguage').hidden=mode!=='translate';
    $('vtaiText').placeholder={
      chat:'Спроси AI или попроси подготовить сообщение…',
      translate:'Вставь текст для перевода…',
      reply:'Опиши ситуацию или вставь сообщение, на которое нужен ответ…',
      action:'Например: напиши Артуру, что созвонимся завтра в 15:00…',
      brief:'Вставь конкретное сообщение или фрагмент переписки для поиска задач и сроков…',
      story:'О чём создать Story? Для кого, какой стиль и предложение?',
      campaign:'Что продаём или анонсируем? Кто покупатель и какое действие нужно?',
      negotiator:'Вставь сообщение клиента, на которое нужно подготовить ответ…'
    }[mode];
    $('vtaiCreate').textContent=mode==='brief'?'Разобрать договорённости':mode==='action'?'Подготовить действие':mode==='negotiator'?'Подготовить ответ на переговоры':mode==='campaign'?'Создать Story + Portal':mode==='story'?'Создать текст для Stories':'Спросить VETO AI';
  }
  function actionRecipientReady(chatId){
    return state.mode!=='action'||(actionDraftValid(state.actionDraft)&&
      state.actionRecipientConfirmed===String(chatId)&&
      state.dialogs.some(c=>String(c.id)===String(chatId)));
  }
  function canSendDraft(){
    return Boolean(state.last&&state.dialogs.length&&
      !['story','campaign','brief'].includes(state.mode)&&
      (state.mode!=='negotiator'||Boolean(state.negotiationDraft))&&
      actionRecipientReady($('vtaiRecipients').value));
  }
  function renderActionMatches(){
    const select=$('vtaiActionMatches'),before=select.value;
    select.replaceChildren(new Option('Выбери получателя из совпадений',''));
    if(!actionDraftValid(state.actionDraft))return;
    const matches=actionRecipientCandidates(state.dialogs,state.actionDraft.recipientQuery);
    for(const match of matches){
      const label=match.title+(match.username?' · @'+match.username:'')+' · '+match.id;
      select.append(new Option(label,match.id));
    }
    if(before&&matches.some(x=>x.id===before))select.value=before;
    $('vtaiActionStatus').textContent=matches.length
      ?'AI предложил имя «'+state.actionDraft.recipientQuery+'». Найдено совпадений: '+
        matches.length+'. Выбери и подтверди правильный чат.'
      :'AI предложил имя «'+state.actionDraft.recipientQuery+
        '». Среди загруженных чатов совпадений нет. Загрузите следующие страницы или используй обычный выбор чата.';
  }
  function chooseActionRecipient(){
    if(!safeIdentity()||!actionDraftValid(state.actionDraft))return;
    const id=$('vtaiActionMatches').value;
    const chat=state.dialogs.find(c=>String(c.id)===id);
    if(!chat)return notice('Сначала выбери найденного получателя.',true);
    $('vtaiRecipients').value=id;
    state.actionRecipientConfirmed=id;
    $('vtaiActionStatus').textContent='Получатель подтверждён: '+chat.title+
      '. Проверь весь текст в редакторе перед отдельным подтверждением отправки.';
    $('vtaiSend').disabled=!canSendDraft();
    notice('Чат выбран вручную. Отправка не выполнена.');
  }
  function renderBrief(){
    const list=$('vtaiBriefList');list.replaceChildren();
    if(!state.brief?.items?.length){
      $('vtaiBriefStatus').textContent=state.brief
        ?'Явных договорённостей не найдено. AI мог упустить детали; проверь исходный текст.'
        :'Для анализа вставь выбранное сообщение.';
      return;
    }
    const kinds={task:'Задача',followup:'Связаться повторно',meeting:'Встреча',payment:'Оплата'};
    $('vtaiBriefStatus').textContent='Найдено '+state.brief.items.length+
      ' пунктов. Проверь источник, прежде чем сохранять.';
    for(const item of state.brief.items){
      const card=document.createElement('article');card.className='vtai-workspace-item';
      const head=document.createElement('strong');head.textContent=(kinds[item.kind]||'Задача')+' · '+item.title;
      const date=document.createElement('p');
      date.textContent='Срок: '+(item.deadlineText||'не указан')+
        (item.certainty==='unclear'?' · требует проверки':'');
      const quote=document.createElement('p');quote.textContent='Из текста: «'+item.sourceQuote+'»';
      const buttons=document.createElement('div');buttons.className='vtai-row';
      const save=document.createElement('button');save.type='button';save.className='vtai-action';
      save.textContent='Добавить в мои заметки';
      save.addEventListener('click',()=>{
        if(!safeIdentity()||!state.brief?.items.includes(item))return;
        if(state.memory.length>=MAX_MEMORY_NOTES)return notice('В AI Memory допускается максимум 8 заметок.',true);
        if(!window.crypto?.randomUUID)return notice('В этом браузере не поддерживаются безопасные идентификаторы.',true);
        if(!window.confirm('Добавить эту AI-гипотезу в локальную Memory? Это не напоминание, а заметка, требующая твоей проверки.'))return;
        try{
          const label=(kinds[item.kind]||'Задача')+': '+item.title;
          const note=makeMemoryNote({owner:owner(),id:crypto.randomUUID(),label:label.slice(0,55),
            content:('Срок: '+(item.deadlineText||'не установлен')+
              '. Источник: '+item.sourceQuote+
              (item.certainty==='unclear'?'. Нужно подтвердить.':'')).slice(0,450)});
          state.memory=[...state.memory,note];renderMemory();
          notice('Добавлено в заметки открытой сессии. Облако и напоминания не включались.');
        }catch{notice('Не удалось создать заметку.',true)}
      });
      const copy=document.createElement('button');copy.type='button';copy.className='vtai-action';
      copy.textContent='Копировать';
      copy.addEventListener('click',()=>{
        const text=item.title+(item.deadlineText?' · '+item.deadlineText:'')+
          '\nИсточник: '+item.sourceQuote;
        if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text)
          .then(()=>notice('Пункт скопирован.'),()=>notice('Не удалось скопировать.',true));
        else notice('Копирование не поддерживается.',true);
      });
      buttons.append(save,copy);card.append(head,date,quote,buttons);list.append(card);
    }
  }
  function setBusy(value){
    state.busy=value;
    $('vtaiCreate').disabled=value;$('vtaiLoadChats').disabled=value;
    $('vtaiSend').disabled=value||!canSendDraft();
  }
  async function request(url,body,consent=false){
    const requestOwner=signed();
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),21000);
    try{
      const result=await fetch(url,{method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':requestOwner,
          ...(consent===true?{'x-vetogram-ai-consent':'yes'}:{}),
          ...(consent==='memory'?{'x-vetogram-memory-consent':'yes'}:{}),
          ...(consent==='grant'?{'x-vetogram-grant-consent':'yes'}:{}),
          ...(consent==='agent'?{'x-vetogram-agent-consent':'yes'}:{})},
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
    if(state.mode==='chat'&&isExplicitActionCommand(original)){
      setMode('action');
      notice('Распознана команда для сообщения. AI подготовит только черновик; получателя выберешь сам.');
    }
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
      if(prompt.length>3000)return notice('Сократи текст клиента или цель: максимальная длина запроса с условиями — 3000 символов.',true);
    }
    if(prompt.length>3000)return notice('Запрос с инструкциями превышает 3000 символов. Сократи текст, чтобы AI ничего не потерял.',true);
    if(mode==='action'){state.actionDraft=null;state.actionRecipientConfirmed=null;}
    const approvedNotes=$('vtaiIncludeMemory').checked
      ?buildMemoryContext(state.memory,[...state.selectedNotes],owner()):[];
    // One-shot consent: notes cannot silently leak into the next request.
    $('vtaiIncludeMemory').checked=false;
    setBusy(true);$('vtaiReview').hidden=true;$('vtaiStoryReview').hidden=true;
    notice('Проверяю AI и дневной лимит. Telegram-сообщения не отправляются.');
    try{
      let grant=null;
      if(mode==='brief'){
        state.brief=answer.brief||null;
        $('vtaiReview').hidden=true;renderBrief();
        notice('Second Brain подготовил разбор. Никаких напоминаний или сообщений не создано.');
      }else if(mode==='action'){
        state.actionDraft=null;state.actionRecipientConfirmed=null;
        if(actionDraftValid(answer.action)){
          state.actionDraft=answer.action;
          $('vtaiDraft').value=answer.action.message;
          $('vtaiReview').hidden=false;
          renderActionMatches();
          $('vtaiSend').disabled=true;
          notice('AI подготовил черновик, но не нашёл и не выбрал адресата автоматически. Выбери чат вручную.');
        }else{
          $('vtaiReview').hidden=true;state.last=null;
          $('vtaiActionStatus').textContent=answer.text;
          notice('AI уточняет запрос. Никакое действие не выполнено.');
        }
      }else if(mode==='negotiator'){
        if(!window.confirm('Разрешить VETOGRAM AI готовить черновик переговоров только для выбранного чата и в заданных пределах? Никакая автоматическая отправка не включается.'))return;
        const issued=await request('/api/vetogram-ai-grants',{
          action:'issue',chatId:negotiationPolicy.chatId,currency:negotiationPolicy.currency,
          askingPrice:$('vtaiNegAsking').value,minPrice:$('vtaiNegFloor').value,
          maxDiscountPct:negotiationPolicy.discountPct,minutes:$('vtaiNegMinutes').value
        },'grant');
        grant=issued.grant;
        if(!grant?.active||grant.chatId!==negotiationPolicy.chatId)
          throw Error('Сервер не подтвердил ограниченное разрешение.');
        state.negotiationGrant=grant;
        $('vtaiNegNotice').textContent='Серверное разрешение создано. Только черновики, без автоматической отправки.';
      }
      const answer=await request('/api/vetogram-ai',
        {mode,prompt,history:mode==='chat'?oldHistory:[],notes:approvedNotes,
          ...(grant?{grantId:grant.grantId,chatId:grant.chatId}:{})},true);
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
    finally{setBusy(false);$('vtaiSend').disabled=!canSendDraft();}
  }
  // Telegram returns only 24 dialogs in the initial page. Other existing
  // conversations stay accessible by explicit "more" or target lookup.
  // Only dialog metadata enters this screen; chat messages are never sent to AI.
  async function loadChats({more=false,seekChatId=null}={}){
    if(state.busy||!safeIdentity())return;
    const searchId=String(seekChatId||(more?'':state.suggestedChatId)||'');
    const validTarget=/^-?\d{1,22}$/.test(searchId)?searchId:null;
    if(more&&!state.chatHasMore)return;
    const startedOwner=signed();
    setBusy(true);
    notice(validTarget?'Нахожу выбранную переписку среди доступных чатов…':
      more?'Загружаю следующую страницу чатов…':'Загружаю список твоих чатов без передачи сообщений AI.');
    let page=more?state.chatNextPage:0;
    let merged=more?[...state.dialogs]:[];
    let hasMore=more?state.chatHasMore:true;
    try{
      const selected=$('vtaiRecipients').value;
      const negSelected=$('vtaiNegRecipient').value;
      // At most 11 bounded pages: first 24 then ten pages of 50 (max 500).
      while(hasMore&&page<=10){
        const result=await request('/api/telegram-chats',{action:'list',page});
        if(startedOwner!==signed())throw Error('Аккаунт изменился.');
        merged=mergeSendableDialogs(merged,result.chats);
        hasMore=result.hasMore===true;
        page++;
        // Search older dialogs only on explicit owner-selected chat intent.
        if(!shouldContinueDialogLookup(page,hasMore,validTarget,merged))break;
      }
      state.dialogs=merged;
      state.chatNextPage=page;
      state.chatHasMore=hasMoreDialogPages(page,hasMore);
      const populate=(id,title,previous)=>{
        const pick=$(id);pick.replaceChildren(new Option(title,''));
        for(const c of state.dialogs)pick.append(new Option(String(c.title||'Чат').slice(0,90),String(c.id)));
        if(previous&&state.dialogs.some(c=>String(c.id)===previous))pick.value=previous;
      };
      populate('vtaiRecipients','Выбрать получателя',selected);
      populate('vtaiNegRecipient','Выбери один чат',negSelected);
      if(validTarget&&state.dialogs.some(c=>String(c.id)===validTarget))
        $('vtaiRecipients').value=validTarget;
      $('vtaiMoreChats').hidden=!state.chatHasMore;
      $('vtaiNegMoreChats').hidden=!state.chatHasMore;
      $('vtaiActionMore').hidden=!state.chatHasMore;
      renderActionMatches();
      notice(validTarget&&!state.dialogs.some(c=>String(c.id)===validTarget)
        ?'Переписка не найдена среди доступных Telegram-диалогов.':
        state.dialogs.length?'Доступно чатов: '+state.dialogs.length+'. Содержимое не передано AI.':
        'Нет доступных диалогов для отправки.',!state.dialogs.length||
          Boolean(validTarget&&!state.dialogs.some(c=>String(c.id)===validTarget)));
    }catch(error){
      notice('Не удалось загрузить чаты: '+error.message,true);
    }finally{
      setBusy(false);
      $('vtaiSend').disabled=!canSendDraft();
    }
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
    if(!actionRecipientReady(chatId))return notice('AI Action: сначала вручную подтверди получателя.',true);
    const title=state.dialogs.find(c=>String(c.id)===chatId)?.title||'чат';
    // No autonomous sends. This confirmation is separate from AI-provider consent.
    if(!window.confirm('Отправить ПОЛНЫЙ текст сообщения от твоего имени в чат «'+String(title).slice(0,70)+'»?\n\n'+message))return;
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
    if(!actionRecipientReady(chatId))return notice('AI Action: получатель не подтверждён.',true);
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
    if(!state.dialogs.some(chat=>String(chat.id)===item.chatId))await loadChats({seekChatId:item.chatId});
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

  function memoryStatus(text,isError=false){
    $('vtaiMemoryCloudStatus').textContent=text;
    if(isError)notice(text,true);
  }
  async function loadMemoryCloud(){
    if(state.memoryBusy||state.busy||!safeIdentity())return;
    if(state.memory.length&&!window.confirm('Загрузить серверную копию? Несохранённые локальные заметки будут заменены.'))return;
    state.memoryBusy=true;
    $('vtaiMemoryCloudLoad').disabled=true;
    try{
      const result=await request('/api/vetogram-ai-memory',{action:'list'});
      if(!safeIdentity())return;
      state.memory=Array.isArray(result.notes)?result.notes.map(note=>({...note,owner:owner()})):[];
      state.memoryRevision=result.revision;
      state.selectedNotes.clear();$('vtaiIncludeMemory').checked=false;
      renderMemory();memoryStatus('Заметки загружены из зашифрованного хранилища VETOGRAM. Ревизия: '+result.revision+'.');
    }catch(error){memoryStatus('Облачная память не загружена: '+error.message,true);}
    finally{state.memoryBusy=false;$('vtaiMemoryCloudLoad').disabled=false;}
  }
  async function writeMemoryCloud(notes){
    if(state.memoryBusy||state.busy||!safeIdentity())return false;
    if(!Number.isSafeInteger(state.memoryRevision))return memoryStatus('Сначала загрузите облачные заметки, чтобы не перезаписать другую версию.',true),false;
    state.memoryBusy=true;
    $('vtaiMemoryCloudSave').disabled=true;$('vtaiMemoryCloudErase').disabled=true;
    try{
      const rows=notes.map(note=>({id:note.id,label:note.label,content:note.content,createdAt:note.createdAt}));
      const result=await request('/api/vetogram-ai-memory',
        {action:'replace',revision:state.memoryRevision,notes:rows},'memory');
      if(!safeIdentity())return false;
      state.memoryRevision=result.revision;
      memoryStatus('Сервер подтвердил зашифрованное сохранение. Ревизия: '+result.revision+'.');
      return true;
    }catch(error){memoryStatus('Не сохранено: '+error.message,true);return false;}
    finally{state.memoryBusy=false;$('vtaiMemoryCloudSave').disabled=false;$('vtaiMemoryCloudErase').disabled=false;}
  }
  async function saveMemoryCloud(){
    if(!safeIdentity())return;
    if(!window.confirm('Сохранить выбранные локальные заметки в серверное зашифрованное хранилище VETOGRAM? Это не E2EE.'))return;
    await writeMemoryCloud(state.memory);
  }
  async function eraseMemoryCloud(){
    if(state.memoryBusy||state.busy||!safeIdentity())return;
    if(!Number.isSafeInteger(state.memoryRevision)||state.memoryRevision<1)
      return memoryStatus('Сначала загрузи существующую облачную копию.',true);
    if(!window.confirm('Безвозвратно удалить зашифрованную запись AI Memory из Neon? Локальные заметки останутся в этом окне.'))return;
    if(!safeIdentity())return;
    state.memoryBusy=true;
    $('vtaiMemoryCloudErase').disabled=true;$('vtaiMemoryCloudSave').disabled=true;
    try{
      const result=await request('/api/vetogram-ai-memory',
        {action:'erase',revision:state.memoryRevision},'memory');
      if(result.deleted!==true)throw Error('Удаление не подтверждено сервером');
      if(!safeIdentity())return;
      state.memoryRevision=0;
      memoryStatus('Зашифрованная запись удалена из Neon. Локальные заметки в этом окне сохранены.');
    }catch(error){memoryStatus('Не удалось удалить облачную запись: '+error.message,true);}
    finally{state.memoryBusy=false;$('vtaiMemoryCloudErase').disabled=false;$('vtaiMemoryCloudSave').disabled=false;}
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


  function renderAgentEvents(events){
    const list=$('vtaiAgentEvents');list.replaceChildren();
    const labels={
      grant_issued:'Выдано разрешение на черновики',
      grant_revoked:'Разрешение отозвано',
      drafting_paused:'Подготовка AI остановлена',
      drafting_resumed:'Подготовка AI возобновлена'
    };
    for(const event of (Array.isArray(events)?events:[]).slice(0,30)){
      if(!labels[event?.kind])continue;
      const card=document.createElement('div');card.className='vtai-workspace-item';
      const headline=document.createElement('strong');headline.textContent=labels[event.kind];
      const meta=document.createElement('p');
      const date=new Date(event.at);
      const stamp=Number.isFinite(date.getTime())?date.toLocaleString('ru-RU'):'Дата неизвестна';
      meta.textContent=stamp+(event.chatId?' · чат '+String(event.chatId).slice(0,22):'');
      card.append(headline,meta);list.append(card);
    }
    if(!list.childNodes.length){
      const label=document.createElement('p');label.className='vtai-note';
      label.textContent='История изменений отсутствует.';list.append(label);
    }
  }
  function agentStateText(paused){
    state.agentPaused=paused===true;
    $('vtaiAgentState').textContent=paused
      ?'Серверная подготовка переговорных черновиков остановлена. Активные разрешения отозваны.'
      :'Серверная подготовка черновиков не остановлена. Выдача разрешений требует отдельного подтверждения.';
    $('vtaiAgentPause').disabled=state.agentPaused===true;
    $('vtaiAgentResume').disabled=state.agentPaused===false;
  }
  async function agentStatus(){
    if(state.agentBusy||state.busy||!safeIdentity())return;
    state.agentBusy=true;
    try{
      const response=await request('/api/vetogram-ai-agent',{action:'status'});
      agentStateText(response.draftingPaused);
      notice('Состояние Agent Control получено от сервера.');
    }catch(error){state.agentPaused=null;$('vtaiAgentState').textContent='Не удалось подтвердить серверный статус. Действия AI недоступны.';notice(error.message,true);}
    finally{state.agentBusy=false;}
  }
  async function changeAgentPause(paused){
    if(state.agentBusy||state.busy||!safeIdentity())return;
    const detail=paused?'Остановить выдачу разрешений на черновики и отозвать действующее разрешение?'
      :'Разрешить снова создавать черновики AI? Это не включает отправку или автоматический агент.';
    if(!window.confirm(detail))return;
    if(!safeIdentity())return;
    state.agentBusy=true;
    try{
      const result=await request('/api/vetogram-ai-agent',{action:paused?'pause':'resume'},'agent');
      agentStateText(result.draftingPaused);
      if(paused){
        state.negotiationPolicy=null;state.negotiationDraft=null;state.negotiationGrant=null;
        $('vtaiReview').hidden=true;$('vtaiSend').disabled=true;
      }
      await agentHistory(true);
      notice(paused?'Сервер подтвердил остановку черновиков.':'Сервер подтвердил возобновление режима черновиков.');
    }catch(error){state.agentPaused=null;$('vtaiAgentState').textContent='Последнее изменение не подтверждено. Обнови статус.';notice(error.message,true);}
    finally{state.agentBusy=false;}
  }
  async function agentHistory(internal=false){
    if(!internal&&(state.busy||state.agentBusy||!safeIdentity()))return;
    try{
      const response=await request('/api/vetogram-ai-agent',{action:'history'});
      renderAgentEvents(response.events);
      if(!internal)notice('Журнал разрешений загружен. Тексты переписок не сохраняются.');
    }catch(error){if(!internal)notice(error.message,true);}
  }

  $('vtaiCreate').addEventListener('click',()=>void generate());
  $('vtaiLoadChats').addEventListener('click',()=>void loadChats());
  $('vtaiNegLoadChats').addEventListener('click',()=>void loadChats());
  $('vtaiMoreChats').addEventListener('click',()=>void loadChats({more:true}));
  $('vtaiNegMoreChats').addEventListener('click',()=>void loadChats({more:true}));
  $('vtaiActionFind').addEventListener('click',()=>void loadChats());
  $('vtaiActionMore').addEventListener('click',()=>void loadChats({more:true}));
  $('vtaiActionChoose').addEventListener('click',chooseActionRecipient);
  $('vtaiRecipients').addEventListener('change',()=>{
    if(state.mode==='action'){
      state.actionRecipientConfirmed=null;
      $('vtaiSend').disabled=true;
      $('vtaiActionStatus').textContent='Получатель изменён. Выбери его снова в AI Action.';
    }
  });
  $('vtaiAgentRefresh').addEventListener('click',()=>void agentStatus());
  $('vtaiAgentPause').addEventListener('click',()=>void changeAgentPause(true));
  $('vtaiAgentResume').addEventListener('click',()=>void changeAgentPause(false));
  $('vtaiAgentHistory').addEventListener('click',()=>void agentHistory());

  $('vtaiNegRevoke').addEventListener('click',async()=>{
    if(!safeIdentity()||state.busy)return;
    if(!window.confirm('Отозвать серверное разрешение Negotiator для твоего аккаунта?'))return;
    try{
      const status=await request('/api/vetogram-ai-grants',{action:'status'});
      const grant=status.grant;
      if(!grant){$('vtaiNegNotice').textContent='Активных разрешений нет.';return;}
      await request('/api/vetogram-ai-grants',{action:'revoke',grantId:grant.grantId},'grant');
      state.negotiationGrant=null;state.negotiationPolicy=null;state.negotiationDraft=null;
      $('vtaiReview').hidden=true;$('vtaiSend').disabled=true;
      $('vtaiNegNotice').textContent='Разрешение отозвано на сервере.';
    }catch(error){notice('Не удалось проверить или отозвать разрешение: '+error.message,true);}
  });
  $('vtaiSend').addEventListener('click',()=>void send());
  $('vtaiQueue').addEventListener('click',queueCurrent);
  $('vtaiClearApprovals').addEventListener('click',()=>{
    if(!safeIdentity())return;
    state.approvals=[];state.reviewedApprovalId=null;renderApprovals();
  });
  $('vtaiAddMemory').addEventListener('click',addMemory);
  $('vtaiMemoryCloudLoad').addEventListener('click',()=>void loadMemoryCloud());
  $('vtaiMemoryCloudSave').addEventListener('click',()=>void saveMemoryCloud());
  $('vtaiMemoryCloudErase').addEventListener('click',()=>void eraseMemoryCloud());
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
