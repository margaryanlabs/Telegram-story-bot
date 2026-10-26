import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveWebAppUrl} from '../lib/vetogram-public-origin.js';
test('canonical HTTPS origin creates stable chat link',()=>{
 assert.equal(archiveWebAppUrl('https://vetogram.example/','123'),
 'https://vetogram.example/studio.html?screen=chats&chat=123&v=20261016-veto-smart-inbox-v1');
});
test('never fall back to guessed Vercel URL',()=>{
 for(const origin of [undefined,'','http://vetogram.example','https://localhost/',
 'https://vetogram.example/api','https://user:pass@vetogram.example/',
 'https://vetogram.example?evil=1','https://vetogram.example:444/','https://vetogram.example/#x'])
  assert.equal(archiveWebAppUrl(origin,'1'),null);
});
test('invalid chat ids are rejected',()=>{
 for(const chat of ['','NaN','12?x=1','1%26admin=1','a'.repeat(500)])
  assert.equal(archiveWebAppUrl('https://vetogram.example/',chat),null);
});
test('negative Telegram chat ids are supported',()=>{
 const url=archiveWebAppUrl('https://vetogram.example/','-1001234');
 assert.equal(new URL(url).searchParams.get('chat'),'-1001234');
});
