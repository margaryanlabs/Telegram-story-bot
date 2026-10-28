import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {UI_LOCALES,normalizeLocale,uiText} from '../public/vetogram-locale-core.js';
test('Russian remains default and UI locales are explicitly allowlisted',()=>{
  assert.deepEqual(UI_LOCALES,['ru','en','hy']);
  assert.equal(normalizeLocale('untrusted'),'ru');
  assert.equal(uiText('chats'),'Чаты');
  assert.equal(uiText('chats','en'),'Chats');
  assert.equal(uiText('chats','hy'),'Զրույցներ');
  assert.equal(uiText('untranslated','en','Исходная подпись'),'Исходная подпись');
});

test('primary screen headings translate in all three languages without editing user content',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const titles=[
    ['chats','Чаты','Chats','Զրույցներ'],
    ['viewersHead','Зрители','Viewers','Դիտողները'],
    ['analyticsHead','Аналитика','Analytics','Վերլուծություն'],
    ['privacyCenterHead','Центр приватности','Privacy Center','Գաղտնիության կենտրոն'],
    ['composeHead','Создай момент.','Create a moment.','Ստեղծիր պահը։'],
    ['stickersHead','Студия стикеров','Sticker Studio','Սթիքերների ստուդիա'],
    ['relayHead','Защита Telegram','Telegram Protection','Telegram-ի պաշտպանություն'],
    ['archiveHead','Архив','Archive','Արխիվ'],
  ];
  for(const [key,ru,en,hy] of titles){
    assert.match(html,new RegExp('<h1 data-ui-text="'+key+'">'+
      ru.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'<\\/h1>'));
    assert.equal(uiText(key,'ru'),ru);
    assert.equal(uiText(key,'en'),en);
    assert.equal(uiText(key,'hy'),hy);
  }
  assert.match(html,/data-nav="telegram"/);
  assert.match(html,/data-open-screen="ai"/);
  assert.match(html,/data-nav="privacy"/);
});


test('all static section headings and marked controls have real localization keys',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const keys=[...html.matchAll(/\bdata-ui-(?:text|label|placeholder)=["']([^"']+)["']/g)]
    .map(match=>match[1]);
  assert.ok(keys.length>=80,'main application chrome must remain localized');
  for(const key of new Set(keys)){
    for(const lang of UI_LOCALES){
      const value=uiText(key,lang,'__MISSING__');
      assert.ok(value&&value!=='__MISSING__',key+':'+lang);
    }
  }
  const staticHeadings=[...html.matchAll(/<(h[23])(?:\s+[^>]*)?>([^<]+)<\/\1>/g)]
    .filter(match=>/[А-Яа-яЁё]/.test(match[2]));
  assert.equal(staticHeadings.filter(match=>/data-ui-text=/.test(match[0])).length,48);
  // Live status headings are written by the backend/onboarding controllers,
  // so the static locale switch must not overwrite their status text.
  for(const id of [
    'vg27MissionTitle','activationTitle','viewerSyncTitle','timelineTitle',
    'privacyBusinessOnboardingTitle','smartBriefTitle','vg26CreativeTitle',
    'sePreviewTitle','relayPowerState','vg26CommandTitle'
  ]){
    assert.match(html,new RegExp('<h2 id="'+id+'">'));
  }
});

test('switching RU, EN, HY translates marked chrome, never chat or AI user content',()=>{
  const localeClient=readFileSync(new URL('../public/vetogram-locale.js',import.meta.url),'utf8')
    .replace(/^import .*;\s*/m,'');
  const callbacks={};
  const selector={value:'ru',addEventListener:(event,cb)=>{callbacks[event]=cb}};
  const title={dataset:{uiText:'recent'},textContent:'Недавние разделы'};
  const nav={dataset:{uiText:'chats'},textContent:'Чаты'};
  const liveMessage={textContent:'Личный текст пользователя'};
  const aria={
    dataset:{uiLabel:'closePreview'},getAttribute:()=> 'Закрыть предпросмотр',
    setAttribute(name,value){this[name]=value}
  };
  const placeholder={
    dataset:{uiPlaceholder:'search'},getAttribute:()=> 'Найти чат…',
    setAttribute(name,value){this[name]=value}
  };
  const html={lang:'ru'};
  const values=new Map();
  const win={dispatchEvent:()=>{}};
  vm.runInNewContext(localeClient,{
    normalizeLocale,uiText,window:win,
    localStorage:{
      getItem:key=>values.get(key)||null,
      setItem:(key,value)=>values.set(key,value)
    },
    document:{
      documentElement:html,
      getElementById:id=>id==='noirLocale'?selector:null,
      querySelectorAll:query=>({
        '[data-ui-text]':[title,nav],
        '[data-ui-label]':[aria],
        '[data-ui-placeholder]':[placeholder],
      })[query]||[]
    },
    CustomEvent:class{constructor(name,options){this.name=name;this.detail=options.detail}},
  });
  assert.equal(title.textContent,'Недавние разделы');
  selector.value='en';callbacks.change();
  assert.equal(html.lang,'en');
  assert.equal(title.textContent,'Recent sections');
  assert.equal(nav.textContent,'Chats');
  assert.equal(aria['aria-label'],'Close preview');
  assert.equal(placeholder.placeholder,'Find a chat…');
  assert.equal(liveMessage.textContent,'Личный текст пользователя');
  selector.value='hy';callbacks.change();
  assert.equal(html.lang,'hy');
  assert.equal(nav.textContent,'Զրույցներ');
  assert.equal(title.textContent,'Վերջին բաժինները');
  assert.equal(liveMessage.textContent,'Личный текст пользователя');
  assert.equal(values.get('vetogram-ui-locale'),'hy');
});


test('chat and privacy filters plus AI mode tabs remain localized and actionable',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const bindings=[
    ['data-mirror-filter="private"','filterPrivate'],
    ['data-mirror-filter="group"','filterGroups'],
    ['data-mirror-filter="channel"','filterChannels'],
    ['data-mirror-filter="bot"','filterBots'],
    ['data-mirror-filter="saved"','filterSaved'],
    ['data-mirror-filter="pinned"','filterPinned'],
    ['data-mirror-filter="unread"','filterUnread'],
    ['data-mirror-filter="archived"','filterArchived'],
    ['data-privacy-filter="all"','privacyFilterAll'],
    ['data-privacy-filter="deleted"','privacyFilterDeleted'],
    ['data-privacy-filter="edited"','privacyFilterEdited'],
    ['data-privacy-filter="media"','privacyFilterMedia'],
    ['data-vtai-mode="chat"','aiModeChat'],
    ['data-vtai-mode="translate"','aiModeTranslate'],
    ['data-vtai-mode="reply"','aiModeReply'],
    ['data-vtai-mode="action"','aiModeAction'],
    ['data-vtai-mode="brief"','aiModeBrief'],
    ['data-vtai-mode="story"','aiModeStory'],
    ['data-vtai-mode="campaign"','aiModeCampaign'],
    ['data-vtai-mode="negotiator"','aiModeNegotiator'],
    ['data-sticker-tab="recent"','stickerRecent'],
    ['data-sticker-tab="packs"','stickerPacks'],
  ];
  const buttons=[...html.matchAll(/<button\b([^>]*)>([^<]+)<\/button>/g)];
  for(const [action,key] of bindings){
    const matches=buttons.filter(match=>
      match[1].includes(action)&&match[1].includes('data-ui-text="'+key+'"'));
    assert.equal(matches.length,1,'missing translated actionable button '+action);
    assert.equal(matches[0][2].trim(),uiText(key,'ru'));
    for(const lang of ['en','hy'])
      assert.ok(uiText(key,lang)&&uiText(key,lang)!==uiText(key,'ru'),
        key+' must have a translated label in '+lang);
  }
});


test('bottom navigation exposes localized screen-reader labels',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const nav=html.match(/<nav\b[^>]*class="[^"]*\bbottom-nav\b[^"]*"[^>]*>[\s\S]*?<\/nav>/)?.[0]||'';
  assert.ok(nav,'main navigation exists');
  for(const [screen,key] of [
    ['telegram','chats'],['publish','stories'],['privacy','privacy']
  ]){
    const button=[...nav.matchAll(/<button\b([^>]*)>/g)].map(x=>x[1])
      .find(attrs=>attrs.includes('data-nav="'+screen+'"'));
    assert.ok(button,'missing screen '+screen);
    assert.ok(button.includes('data-ui-label="'+key+'"'),screen);
    for(const locale of ['ru','en','hy'])
      assert.ok(uiText(key,locale),screen+':'+locale);
  }
});


test('AI mode locale repaints preserve signed drafts and mode-specific approvals',()=>{
  const browser=readFileSync(new URL('../public/vetogram-ai.js',import.meta.url),'utf8');
  const first=browser.indexOf('  function setMode(mode){');
  const end=browser.indexOf('  function actionRecipientReady(',first);
  assert.ok(first>0 && end>first);
  const actual=browser.slice(first,end);
  const modes=[
    ['chat','aiPromptChat','aiCreateAsk'],
    ['translate','aiPromptTranslate','aiCreateAsk'],
    ['reply','aiPromptReply','aiCreateAsk'],
    ['story','aiPromptStory','aiCreateStory'],
    ['campaign','aiPromptCampaign','aiCreateCampaign'],
    ['negotiator','aiPromptNegotiator','aiCreateNegotiator'],
    ['action','aiPromptAction','aiCreateAction'],
    ['brief','aiPromptBrief','aiCreateBrief']
  ];
  for(const [mode,promptKey,actionKey] of modes){
    let lang='ru';
    const elements=new Map(),buttons=modes.map(([value])=>({
      dataset:{vtaiMode:value},
      classList:{toggle(){}},
      setAttribute(){}
    }));
    const $=id=>{
      if(!elements.has(id))elements.set(id,{
        value:'',textContent:'',placeholder:'',checked:false,
        hidden:false,readOnly:false,disabled:false,replaceChildren(){}
      });
      return elements.get(id);
    };
    const history=[{role:'user',text:'Private owner A message'}];
    const sendIntent={nonce:'private owner A nonce'};
    const approval={chatId:'44',owner:'111'};
    const state={
      mode,history,last:'Owner A draft',sendIntent,
      reviewedApprovalId:'grant-A',generateIntent:7,generateAbort:null,
      negotiationPolicy:approval,negotiationDraft:approval,
      actionDraft:approval,actionRecipientConfirmed:'44',
      brief:{tasks:[{title:'private task A'}]}
    };
    $('vtaiText').value='Private owner A prompt';
    $('vtaiDraft').value='Private owner A draft';
    $('vtaiConsent').checked=true;
    const ctx=vm.createContext({
      state,$,document:{querySelectorAll:()=>buttons},
      window:{VetogramI18n:{t:(key,ru)=>uiText(key,lang,ru)}},
      setBusy:()=>{throw Error('Locale repaint must not affect busy or requests')}
    });
    const apply=vm.runInContext('('+actual.trim()+')',ctx);
    for(const language of ['ru','en','hy']){
      lang=language;apply(mode);
      assert.equal($('vtaiText').placeholder,uiText(promptKey,language),mode+':'+language);
      assert.equal($('vtaiCreate').textContent,uiText(actionKey,language),mode+':'+language);
      assert.equal($('vtaiText').value,'Private owner A prompt');
      assert.equal($('vtaiDraft').value,'Private owner A draft');
      assert.equal($('vtaiConsent').checked,true);
      assert.equal(state.generateIntent,7,'locale repaint must not cancel a request');
      assert.equal(state.last,'Owner A draft');
      assert.equal(state.history,history);
      assert.equal(state.sendIntent,sendIntent);
      assert.equal(state.reviewedApprovalId,'grant-A');
      if(mode==='negotiator')assert.equal(state.negotiationPolicy,approval);
      if(mode==='action')assert.equal(state.actionDraft,approval);
      if(mode==='brief')assert.equal(state.brief.tasks[0].title,'private task A');
    }
  }
});
