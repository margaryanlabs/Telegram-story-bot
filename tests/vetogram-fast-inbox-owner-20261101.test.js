import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const chats=readFileSync(new URL('../api/telegram-chats.js',import.meta.url),'utf8');
const script=chats.replace(/^import .*?;\s*$/gm,'')
  .replace(/export default async function handler/,'async function handler')
  .replace(/^export /gm,'');

function fixture({connected=true,owner='123'}={}){
  const counts={mtproto:0,archive:0,privacy:0};
  const context=vm.createContext({
    process:{env:{TELEGRAM_BOT_TOKEN:'fake-token'}},
    openJson:async()=>({session:'fixture-session'}),
    validateTelegramMiniApp:()=>({id:'123'}),
    getViewerSession:async()=>connected
      ?{status:'active',session_ciphertext:'cipher',telegram_account_user_id:owner}:null,
    listPrivacyThreads:async()=>{
      counts.archive++;
      return {threads:[{chatId:'999',title:'Vault-only',messageCount:1,
        preview:'Archived',deletedCount:1}]};
    },
    listPrivacyMessages:async()=>({messages:[]}),
    getPrivacySettings:async()=>{counts.privacy++;return {antiDelete:true}},
    getBusinessConnectionState:async()=>null,
    inboxSignals:()=>({}),
    privacyReadiness:()=>({antiDelete:true}),
    withBackupClient:async(_,callback)=>{
      counts.mtproto++;
      return callback({getDialogs:async()=>[{
        id:'42',title:'Live',isUser:true,entity:{id:'42',firstName:'Live'},
        message:{id:1,date:1770000000,message:'hello'},
      }]});
    },
    sameTelegramAccount:(a,b)=>a===b,
    verifyTelegramClientOwner:async()=>({verified:true,name:'Owner'}),
    telegramOwnerError:()=>null,
    SENDABLE_TYPES:new Set(['private','group','bot','saved']),
  });
  new vm.Script(script+'\nglobalThis.chatHandler=handler').runInContext(context);
  return {counts,handler:context.chatHandler,request:body=>({
    method:'POST',headers:{'x-telegram-init-data':'signed'},body,
  }),response:()=>({
    setHeader(){return this},status(code){this.code=code;return this},
    json(data){this.data=data;return this},
  })};
}

test('first owner-verified inbox paints before unrelated archive or Business reads',async()=>{
  const f=fixture(),r=f.response();
  await f.handler(f.request({action:'list',page:0,fastInbox:true}),r);
  assert.equal(r.code,200);
  assert.equal(r.data.connection.verified,true);
  assert.equal(r.data.archiveDeferred,true);
  assert.equal(r.data.chats.length,1);
  assert.deepEqual(f.counts,{mtproto:1,archive:0,privacy:0});
  const second=f.response();
  await f.handler(f.request({action:'list_overlay'}),second);
  assert.equal(second.code,200);
  assert.equal(second.data.archivedChats.length,1);
  assert.deepEqual(f.counts,{mtproto:1,archive:1,privacy:1});
});

test('without a confirmed Telegram session fast inbox must preserve archive-only conversations',async()=>{
  const f=fixture({connected:false}),r=f.response();
  await f.handler(f.request({action:'list',page:0,fastInbox:true}),r);
  assert.equal(r.code,200);
  assert.equal(r.data.archiveDeferred,false);
  assert.equal(r.data.chats[0].id,'999');
  assert.equal(r.data.chats[0].archiveOnly,true);
  assert.equal(f.counts.archive,1);
  assert.equal(f.counts.mtproto,0);
});

test('owner-mismatched sessions fail closed instead of opening Telegram or archives',async()=>{
  const f=fixture({connected:true,owner:'other-user'}),r=f.response();
  await f.handler(f.request({action:'list',page:0,fastInbox:true}),r);
  assert.equal(r.code,409);
  assert.equal(f.counts.mtproto,0);
});
