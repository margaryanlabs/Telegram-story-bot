/* VETO MEDIA V6 · provider honesty, collection restore, continue reading */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const mk=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
  const sources={music:null,films:null,books:null,audiobooks:null};
  const sourceNames={music:'Музыка · Audius',films:'Кино · Internet Archive',books:'Книги · Gutenberg',audiobooks:'Аудиокниги · LibriVox'};
  const top=document.querySelector('.top-actions')||document.querySelector('.nav-right')||document.body;
  const statusButton=mk('button','v6-source-button','◌ Каталоги: не проверены');
  statusButton.id='v6SourceButton';statusButton.type='button';statusButton.setAttribute('aria-expanded','false');
  const flyout=mk('div','v6-source-flyout hidden');flyout.id='v6SourceFlyout';
  flyout.setAttribute('role','region');flyout.setAttribute('aria-label','Подключённые каталоги');
  const heading=mk('div','v6-flyout-head');heading.append(mk('strong','', 'Состояние каталогов'));
  const close=mk('button','v6-source-close','×');close.type='button';close.setAttribute('aria-label','Свернуть');
  heading.append(close);flyout.append(heading);
  const statusList=mk('div','v6-provider-rows');flyout.append(statusList);
  const hint=mk('p','v6-flyout-hint','Статус отражает последний ответ API в этой вкладке. Он не доказывает, что любой фильм или трек можно воспроизвести.');
  flyout.append(hint);
  top.append(statusButton);document.body.append(flyout);
  const openPanel=(next)=>{
    const opened=typeof next==='boolean'?next:flyout.classList.contains('hidden');
    flyout.classList.toggle('hidden',!opened);
    statusButton.setAttribute('aria-expanded',String(opened));
    if(opened)renderStatus();
  };
  statusButton.addEventListener('click',()=>openPanel());close.addEventListener('click',()=>openPanel(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!flyout.classList.contains('hidden'))openPanel(false)});
  document.addEventListener('click',e=>{if(!flyout.classList.contains('hidden')&&!flyout.contains(e.target)&&!statusButton.contains(e.target))openPanel(false)});
  function renderStatus(){
    statusList.replaceChildren();
    const values=Object.values(sources);
    const okCount=values.filter(v=>v===true).length,badCount=values.filter(v=>v===false).length;
    const label=badCount? '⚠ '+badCount+' источник недоступен':okCount?'● '+okCount+' из 4 каталогов ответили':'◌ Каталоги: не проверены';
    statusButton.textContent=label;
    statusButton.classList.toggle('has-error',badCount>0);
    for(const [id,title] of Object.entries(sourceNames)){
      const row=mk('div','v6-provider-row');
      const dot=mk('i',sources[id]===true?'healthy':sources[id]===false?'unavailable':'unknown');
      const name=mk('span','',title);
      const indicator=mk('small','',sources[id]===true?'Отвечает':sources[id]===false?'Не отвечает':'Не проверен');
      row.append(dot,name,indicator);statusList.append(row);
    }
  }
  document.addEventListener('veto:provider',e=>{
    const type=e.detail?.source;if(!Object.prototype.hasOwnProperty.call(sources,type))return;
    sources[type]=e.detail.ok===true;renderStatus();
  });
  window.addEventListener('offline',()=>{statusButton.textContent='◌ Нет соединения'});
  window.addEventListener('online',renderStatus);
  renderStatus();
  const bar=mk('div','v6-recovery hidden');bar.id='v6Recovery';
  const text=mk('span','','Аудиопоток не загрузился. Можно попробовать ещё раз или открыть Audius.');
  const retry=mk('button','','Повторить');retry.type='button';
  const link=mk('a','','Открыть источник ↗');link.href='https://audius.co/';link.target='_blank';link.rel='noopener noreferrer';
  const dismiss=mk('button','v6-recovery-close','×');dismiss.type='button';dismiss.setAttribute('aria-label','Закрыть');
  bar.append(text,retry,link,dismiss);
  const player=$('player');if(player)player.insertAdjacentElement('beforebegin',bar);else document.body.append(bar);
  dismiss.addEventListener('click',()=>bar.classList.add('hidden'));
  retry.addEventListener('click',()=>{
    const audio=$('audio');if(!audio||!audio.getAttribute('src'))return;
    bar.classList.add('hidden');audio.load();
    audio.play().catch(()=>{bar.classList.remove('hidden')});
  });
  document.addEventListener('veto:stream-error',()=>{
    bar.classList.remove('hidden');
    const isAudioBook=$('favoriteNow')?.classList.contains('hidden');
    if(isAudioBook){text.textContent='Аудиокнига недоступна во встроенном плеере. Проверь источник LibriVox.';link.href='https://librivox.org/';link.textContent='Открыть LibriVox ↗';}
    else{text.textContent='Трек не загрузился. Попробуй ещё раз или открой Audius.';link.href='https://audius.co/';link.textContent='Открыть Audius ↗';}
  });
  $('audio')?.addEventListener('play',()=>bar.classList.add('hidden'));
  // Readable offline-safe collection section. Content stored only by explicit clicks.
  const existing=document.getElementById('v5Personal');
  const personalApi=window.VetoPersonal;
  if(existing&&personalApi){
    const controls=mk('div','v6-personal-actions');
    const importBtn=mk('button','v6-import-btn','↓ Восстановить коллекцию');
    importBtn.type='button';
    const file=mk('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    file.id='v6ImportFile';
    importBtn.addEventListener('click',()=>file.click());
    file.addEventListener('change',async()=>{
      const selected=file.files?.[0];file.value='';
      if(!selected)return;
      if(selected.size>200000||selected.size<10){message('Файл слишком большой или пустой. Лимит — 200 КБ.');return}
      try{
        const parsed=JSON.parse(await selected.text());
        const size=(parsed?.films?.length||0)+(parsed?.books?.length||0);
        if(!confirm('Заменить текущие сохранённые фильмы и книги '+size+' записями из файла?'))return;
        personalApi.importCollection(parsed);
        updateContinue();
      }catch(e){message('Не удалось восстановить: '+String(e.message).slice(0,100))}
    });
    const feedback=mk('div','v6-import-note');feedback.id='v6ImportFeedback';feedback.setAttribute('role','status');
    controls.append(importBtn,file,feedback);existing.append(controls);
  }
  function message(msg){const el=$('v6ImportFeedback');if(el)el.textContent=msg}
  // Personal continuation: no server lookup or implicit data transfer.
  const home=$('homeView')||$('home');
  let continueBox=null;
  if(home&&personalApi){
    continueBox=mk('section','v6-continue');continueBox.id='v6Continue';
    home.append(continueBox);
  }
  function updateContinue(){
    if(!continueBox||!personalApi)return;
    const saved=personalApi.snapshot();
    const items=[
      ...saved.films.slice(0,2).map(x=>({...x,kind:'films'})),
      ...saved.books.slice(0,2).map(x=>({...x,kind:'books'}))
    ];
    continueBox.replaceChildren();
    if(!items.length)return;
    const head=mk('div','v6-continue-head');head.append(mk('span','v6-label','ТВОЯ ПОДБОРКА'),mk('h3','','Вернуться к историям'));
    continueBox.append(head);
    const rail=mk('div','v6-continue-rail');continueBox.append(rail);
    items.forEach(item=>{
      const card=mk('article','v6-continue-card');
      card.append(mk('span','v6-type',item.kind==='films'?'◉ FILMS':'▤ BOOKS'),mk('strong','',item.title));
      const actions=mk('div','v6-continue-actions');
      if(item.source.startsWith('https://')){
        const a=mk('a','','Открыть источник ↗');a.href=item.source;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);
      }
      const button=mk('button','','К коллекции');
      button.addEventListener('click',()=>{
        const tab=document.querySelector('[data-tab="library"]')||document.querySelector('[data-page="mine"]');
        tab?.click();
      });
      actions.append(button);card.append(actions);rail.append(card);
    });
  }
  updateContinue();
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#v5SaveBook,#v5SaveFilm,.v5-card-actions button'))setTimeout(updateContinue,100);
    if(e.target.closest?.('[data-tab="home"],[data-page="home"]'))updateContinue();
  });
  window.addEventListener('storage',e=>{if(e.key==='veto-media-personal-v5')updateContinue()});
  const srcCopy=mk('div','v6-privacy-footnote','Личные списки хранятся в браузере. Очистка данных устройства может удалить их; резервная копия сохраняется вручную.');
  existing?.append(srcCopy);
})();