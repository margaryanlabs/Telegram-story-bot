import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
