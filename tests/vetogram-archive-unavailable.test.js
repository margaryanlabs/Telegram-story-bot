import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// No real Telegram, archive, token or server traffic. These tests execute
// real functions from api/telegram-chats.js with mocked store/HTTP dependencies.
const api=readFileSync(new URL('../api/telegram-chats.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=api.indexOf('async function archivedMessages(');
const end=api.indexOf('export function combineLiveAndPreserved',start);
assert.ok(start>=0&&end>start);
function archiveReader(listPrivacyMessages){
  return vm.runInNewContext('('+api.slice(start,end).trim()+')',
    vm.createContext({listPrivacyMessages,ARCHIVE_PAGE:100,
      clean:(x,n)=>String(x||'').slice(0,n)}));
}
test('storage failure reports unavailable rather than an empty successful archive',async()=>{
  const reader=archiveReader(async()=>{throw Error('storage offline')});
  const result=await reader('111','222',0);
  assert.equal(result.unavailable,true);
  assert.deepEqual(result.messages,[]);
  assert.equal(result.hasMore,false);
  assert.equal(result.nextOffset,0);
});
test('genuinely empty archive remains different from an unavailable archive',async()=>{
  const reader=archiveReader(async()=>({messages:[],hasMore:false}));
  const result=await reader('111','222',0);
  assert.equal(result.unavailable,undefined);
  assert.equal(result.messages.length,0);
});
test('saved deleted messages preserve evidence when the archive responds normally',async()=>{
  const reader=archiveReader(async()=>({messages:[{
    message_id:17,chat_id:'222',text_content:'before deletion',
    deleted_at:'2026-10-01T09:00:00Z',sent_at:'2026-10-01T08:59:00Z',
    media_type:'photo',media_file_id:'mock-photo',direction:'incoming'
  }],hasMore:false}));
  const result=await reader('111','222',0);
  assert.equal(result.messages.length,1);
  assert.equal(result.messages[0].saved,true);
  assert.equal(result.messages[0].deleted,true);
  assert.equal(result.messages[0].text,'before deletion');
  assert.equal(result.messages[0].mediaAvailable,true);
});
test('thread_archive API responds 503 on outage, not 200 with fake emptiness',async()=>{
  const pos=api.indexOf('export default async function handler(');
  assert.ok(pos>0);
  const source=api.slice(pos).replace(/^export default /,'')+'\nhandler;';
  const ctx={
    BOT:'test-bot',
    validateTelegramMiniApp:()=>({id:111}),
    validChatId:x=>/^\d+$/.test(x),
    FIRST_PAGE_SIZE:24,PAGE_SIZE:50,MAX_DIALOGS:500,
    shouldFetchLiveFirst:()=>false,
    archivedMessages:archiveReader(async()=>{throw Error('DB offline')}),
    respond:(res,status,data)=>res.status(status).json({ok:status<400,...data})
  };
  const handler=vm.runInNewContext(source,vm.createContext(ctx));
  const res={setHeader(){return this},status(code){this.code=code;return this},
    json(payload){this.payload=payload;return this}};
  await handler({method:'POST',headers:{'x-telegram-init-data':'test'},
    body:{action:'thread_archive',chatId:'222',archiveOffset:0}},res);
  assert.equal(res.code,503);
  assert.equal(res.payload.ok,false);
  assert.equal(res.payload.archiveUnavailable,true);
  assert.match(res.payload.error,/архив/i);
});
test('deferred archive sync reports temporary failure for live, not only saved-copy, chats',()=>{
  const start=ui.indexOf('async function mergeDeferredArchive(');
  const end=ui.indexOf('async function loadMessages(',start);
  assert.ok(start>=0&&end>start);
  const sync=ui.slice(start,end);
  assert.match(sync,/threadNotice\('Защищённый архив пока недоступен/);
  assert.doesNotMatch(sync,/state\.thread\?\.savedCopy===true/);
  assert.match(sync,/syncLabel\('Telegram подключён · архив ожидает повторной проверки'\)/);
});
