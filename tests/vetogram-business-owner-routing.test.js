import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  normalizeBusinessMessage, archiveDeletedBusinessMessages
} from '../lib/privacy-business.js';

const owner={id:111};
const connection={id:'bc-A',user:owner,user_chat_id:888222,
  is_enabled:true,rights:{can_manage_stories:true}};
const message={business_connection_id:'bc-A',message_id:17,
  chat:{id:333,type:'private'},from:{id:333},text:'sample',date:1770000000};

test('private archive is keyed by signed owner user.id, not bot notification chat',()=>{
  const row=normalizeBusinessMessage(connection,message);
  assert.equal(row.telegram_user_id,'111');
  assert.equal(row.business_connection_id,'bc-A');
  assert.equal(row.chat_id,'333');
  assert.equal(row.message_id,17);
  assert.equal(row.direction,'incoming');
});
test('owner messages keep outgoing direction with unrelated bot chat ID',()=>{
  const row=normalizeBusinessMessage(connection,{...message,
    from:{id:111},message_id:18});
  assert.equal(row.direction,'outgoing');
  assert.equal(row.telegram_user_id,'111');
});
test('wrong connection ID or absent Telegram owner is rejected before archive write',()=>{
  assert.throws(()=>normalizeBusinessMessage(connection,
    {...message,business_connection_id:'foreign'}),/mismatched/);
  assert.throws(()=>normalizeBusinessMessage({...connection,user:null},message),/identity/);
});
test('deleted business messages use owner user.id and reject cross-connection IDs',async()=>{
  const token=process.env.TELEGRAM_BOT_TOKEN,hash=process.env.TELEGRAM_API_HASH,
    provider=process.env.VETO_STORAGE_PROVIDER,fetchBefore=globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN='fixture-token';
  process.env.TELEGRAM_API_HASH='fixture-hash';
  process.env.VETO_STORAGE_PROVIDER='supabase';
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.match(String(url),/story-pilot-store/);
    const req=JSON.parse(options.body);
    assert.equal(req.op,'mark_business_messages_deleted');
    assert.equal(req.args.userId,'111');
    assert.equal(req.args.chatId,'333');
    assert.deepEqual(req.args.messageIds,[17]);
    return {ok:true,json:async()=>({ok:true,data:{affected:1,retained:true}})};
  };
  try{
    const result=await archiveDeletedBusinessMessages(connection,{
      business_connection_id:'bc-A',chat:{id:333},message_ids:[17]});
    assert.equal(result.affected,1);
    assert.equal(calls,1);
    await assert.rejects(archiveDeletedBusinessMessages(connection,{
      business_connection_id:'bc-B',chat:{id:333},message_ids:[17]}),/not confirmed/);
    assert.equal(calls,1);
  }finally{
    globalThis.fetch=fetchBefore;
    for(const [key,value] of [['TELEGRAM_BOT_TOKEN',token],
      ['TELEGRAM_API_HASH',hash],['VETO_STORAGE_PROVIDER',provider]]){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
test('Business event persistence keeps Bot API notification chat separate from archive owner',()=>{
  const webhook=readFileSync(new URL('../api/webhook-v7.js',import.meta.url),'utf8');
  assert.match(webhook,/async function persistBusinessConnection[\s\S]*?const chatId = connection\?\.user_chat_id;\s*const ownerUserId = connection\?\.user\?\.id/);
  assert.match(webhook,/telegramUserId: ownerUserId/);
  assert.match(webhook,/String\(connection\?\.user\?\.id\)!==String\(message\.from\.id\)/);
  const privacy=readFileSync(new URL('../lib/privacy-business.js',import.meta.url),'utf8');
  assert.match(privacy,/telegram_user_id: String\(ownerUserId\)/);
  assert.doesNotMatch(privacy,/telegram_user_id: String\(ownerChatId\)/);
});
