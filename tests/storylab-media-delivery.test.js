import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fakeFile={name:'message.webm',size:123,mime:'audio/webm'};

function retryHarness(){
  const ui=read('public/telegram-chats.js');
  const start=ui.indexOf('function richSendIntent('),end=ui.indexOf('async function sendRichOutgoing(',start);
  assert.ok(start>=0&&end>start);
  const sandbox={};
  runInNewContext(ui.slice(start,end)+'\nthis.helpers={richSendIntent,sameRichIntent}',sandbox);
  return sandbox.helpers;
}

test('identical media intent can reuse a previous nonce on deliberate retry',()=>{
  const {richSendIntent,sameRichIntent}=retryHarness();
  const first=richSendIntent('send_media','10',{file:fakeFile,kind:'voice'},'',null,null);
  const same=richSendIntent('send_media','10',{file:fakeFile,kind:'voice'},'',null,null);
  assert.equal(sameRichIntent(first,same),true);
  assert.equal(sameRichIntent(first,{...same,caption:'new caption'}),false);
  assert.equal(sameRichIntent(first,{...same,chatId:'11'}),false);
  assert.equal(sameRichIntent(first,{...same,file:{...fakeFile}}),false);
  assert.equal(sameRichIntent(first,{...same,replyTo:75}),false);
  assert.equal(sameRichIntent(first,{...same,action:'send_sticker'}),false);
});

test('sticker retries require identical selection and cannot reuse unrelated random IDs',()=>{
 const {richSendIntent,sameRichIntent}=retryHarness();
 const original=richSendIntent('send_sticker','11',null,'',4,'55');
 assert.equal(sameRichIntent(original,richSendIntent('send_sticker','11',null,'',4,'55')),true);
 assert.equal(sameRichIntent(original,richSendIntent('send_sticker','11',null,'',4,'56')),false);
 assert.equal(sameRichIntent(original,richSendIntent('send_sticker','11',null,'',5,'55')),false);
});

test('UI retains uncertain media nonce but never automatically sends another message',()=>{
 const ui=read('public/telegram-chats.js');
 const outgoing=ui.slice(ui.indexOf('async function sendRichOutgoing('),ui.indexOf('async function openStickerDrawer'));
 assert.match(outgoing,/sameRichIntent\(prior\?\.intent,intent\)/);
 assert.match(outgoing,/state\.lastRichFailure=\{intent,nonce\}/);
 assert.match(outgoing,/error\?\.uncertain===true/);
 assert.match(outgoing,/String\(state\.thread\?\.id\)===chatId/);
 assert.match(outgoing,/const current=\(\)=>ownerKey===state\.ownerInitData&&ownerKey===String\(tg\?\.initData\|\|''\)&&/);
 assert.match(outgoing,/generation===state\.threadGeneration&&String\(state\.thread\?\.id\)===chatId/);
 assert.ok(outgoing.indexOf('if(!current())')<outgoing.indexOf('await richRequest(action,request)'));
 assert.equal((outgoing.match(/await richRequest\(action,request\)/g)||[]).length,1);
 assert.doesNotMatch(outgoing,/setTimeout\([^)]*sendRichOutgoing/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/i);
});

test('sticker picker avoids fetching large dialog windows, media retains safe fallback',()=>{
 const send=read('api/telegram-send.js'),media=read('api/telegram-chat-media.js');
 const checked=send.slice(send.indexOf('await verifyTelegramClientOwner(client,userId);'));
 assert.ok(checked.indexOf("if(action==='recent_stickers')")<checked.indexOf("client.getDialogs({limit:60})"));
 assert.match(media,/const recent=await client\.getDialogs\(\{limit:60\}\)/);
 assert.match(media,/if\(!dialog\)\{[\s\S]*?getDialogs\(\{limit:MAX_DIALOGS\}\)/);
 assert.match(media,/await verifyTelegramClientOwner\(client,userId\)/);
 assert.match(media,/Cache-Control','private,no-store/);
});
