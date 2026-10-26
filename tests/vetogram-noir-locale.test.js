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
  assert.match(html,/data-nav="ai"/);
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
