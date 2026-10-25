import test from 'node:test';
import assert from 'node:assert/strict';
import {UI_LOCALES,normalizeLocale,uiText} from '../public/vetogram-locale-core.js';
test('Russian remains default and UI locales are explicitly allowlisted',()=>{
  assert.deepEqual(UI_LOCALES,['ru','en','hy']);
  assert.equal(normalizeLocale('untrusted'),'ru');
  assert.equal(uiText('chats'),'Чаты');
  assert.equal(uiText('chats','en'),'Chats');
  assert.equal(uiText('chats','hy'),'Զրույցներ');
  assert.equal(uiText('untranslated','en','Исходная подпись'),'Исходная подпись');
});
