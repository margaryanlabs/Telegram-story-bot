/* RB3 API regression: a failed Privacy store must never be mistaken for an
 * empty verified archive. Runs the real API handler with no real credentials.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const api=readFileSync(new URL('../api/telegram-chat-updates.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const normalizerStart=api.indexOf('export function normalizePolledArchive(');
const handlerStart=api.indexOf('export default async function handler(req,res){');
const normalizerEnd=api.indexOf('// Short-lived MTProto',normalizerStart);
assert.ok(normalizerStart>0&&handlerStart>normalizerStart&&normalizerEnd>normalizerStart);
const runnable=api.slice(normalizerStart,normalizerEnd).replace(/^export /,'')+
  '\n'+api.slice(handlerStart).replace(/^export default /,'');

function fixture({archiveAvailable=true,archiveMalformed=false,ownerMatches=true}={}){
  const visited=[];
  const context=vm.createContext({
    BOT:'fake-test-token',
    ACTIVE_DIALOG_SCAN:70,
    ACTIVE_LATEST_MESSAGES:28,
    id:v=>String(v?.toString?.()||v||''),
    reply:(res,status,data)=>res.status(status).json({ok:status<400,...data}),
    validateTelegramMiniApp:()=>({id:123}),
    getViewerSession:async()=>({
      status:'active',
      session_ciphertext:'test-only-encrypted',
      telegram_account_user_id:'123',
    }),
    sameTelegramAccount:()=>ownerMatches,
    openJson:async()=>({session:'mock-session'}),
    listPrivacyMessages:async()=>{
      visited.push('archive');
      if(!archiveAvailable)throw Error('Privacy store unavailable');
      if(archiveMalformed)return {message_count:0};
      return {messages:[{
        message_id:10, sent_at:'2026-11-05T00:10:00Z',
        text_content:'Archived message', direction:'incoming',
      }]};
    },
    withBackupClient:async(_session,action)=>{
      visited.push('owner-mtproto');
      return action({
        getDialogs:async()=>[{id:'55',entity:{id:'55'},isGroup:false}],
        getMessages:async()=>[{id:11,text:'Latest Telegram message'}],
      });
    },
    verifyTelegramClientOwner:async()=>{visited.push('owner-verified');},
    messageInfo:m=>({id:m.id,text:m.text}),
    combineLiveAndPreserved:(live,archived)=>[...live,...archived],
    telegramOwnerError:()=>null,
  });
  vm.runInContext(runnable,context,{timeout:1000});
  const response={statusCode:200,body:null,headers:{},
    setHeader(key,value){this.headers[key.toLowerCase()]=value;},
    status(value){this.statusCode=value;return this;},
    json(value){this.body=value;return this;},
  };
  const request={method:'POST',
    headers:{'x-telegram-init-data':'fake-signed-owner'},
    body:{action:'poll_thread',chatId:'55'},
  };
  return {response,visited,request,run:()=>vm.runInContext('handler',context)(request,response)};
}

test('when archive is unavailable, live messages remain but coverage is unknown',async()=>{
  const f=fixture({archiveAvailable:false});
  await f.run();
  assert.equal(f.response.statusCode,200);
  assert.equal(f.response.body.ok,true);
  assert.equal(f.response.body.archiveAvailable,false);
  assert.equal(f.response.body.messages.length,1);
  assert.equal(f.response.body.messages[0].id,11);
  assert.equal(f.response.body.messages[0].deleted,undefined);
  assert.ok(f.visited.includes('owner-verified'));
});

test('when archive is available, server reports verified archive coverage',async()=>{
  const f=fixture({archiveAvailable:true});
  await f.run();
  assert.equal(f.response.statusCode,200);
  assert.equal(f.response.body.archiveAvailable,true);
  assert.deepEqual(f.response.body.messages.map(m=>m.id),[11,10]);
  assert.equal(f.response.body.messages[1].saved,true);
});

test('malformed archive response is not reported as verified empty coverage',async()=>{
  const f=fixture({archiveMalformed:true});
  await f.run();
  assert.equal(f.response.statusCode,200);
  assert.equal(f.response.body.archiveAvailable,false);
  assert.deepEqual(f.response.body.messages.map(m=>m.id),[11]);
});

test('polling never opens someone else’s Telegram session',async()=>{
  const f=fixture({ownerMatches:false});
  await f.run();
  assert.equal(f.response.statusCode,403);
  assert.equal(f.response.body.ok,false);
  assert.equal(f.visited.includes('owner-mtproto'),false);
});

test('client reports optional archive failure separately from live message updates',()=>{
  const position=ui.indexOf('if(data.archiveAvailable===false){');
  assert.ok(position>0);
  assert.match(ui.slice(position,position+520),/архив Vetogram временно недоступен/);
  assert.match(ui.slice(position,position+600),/Обновлено /);
  assert.match(api,/archiveAvailable:saved\.available/);
  assert.match(api,/messages:combineLiveAndPreserved\(live\.messages,saved\.messages\)/);
});
