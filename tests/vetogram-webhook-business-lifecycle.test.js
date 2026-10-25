import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';

// Uses the *actual* production webhook handler with mocked Bot API + archive.
// No Telegram token, network request, database, cron, or paid action.
const webhookSource=readFileSync(new URL('../api/webhook-v7.js',import.meta.url),'utf8');
const start=webhookSource.indexOf('export default async function handler(');
assert.ok(start>0);
const body=webhookSource.slice(start).replace(/^export default /,'')+'\nhandler;';
const token='fixture-token',secret=crypto.createHash('sha256').update(token).digest('hex').slice(0,32);
const newMessage={business_connection_id:'connected-A',chat:{id:333},
  from:{id:333},message_id:17,text:'Owner-approved test'};

function fixture(state=true){
  const calls={archive:[],deletions:[],alerts:[],connectionReads:0};
  const connection={id:'connected-A',user:{id:111},
    user_chat_id:999999,is_enabled:state};
  const scope={
    crypto,process:{env:{TELEGRAM_BOT_TOKEN:token}},
    console:{warn(){},error(){}},
    originFromRequest:()=> 'https://example.test',
    businessConnectionIdFromActivity:()=>null,
    tg:async(_token,method)=>{
      assert.equal(method,'getBusinessConnection');
      calls.connectionReads++;
      return connection;
    },
    archiveBusinessMessage:async(_connection,message,type)=>{
      calls.archive.push({message,type});
      return {captured:true,row:{direction:'incoming',
        media_file_id:null,chat_id:'333',message_id:message.message_id},
        settings:{antiDelete:true,editHistory:true,notifyEdits:true}};
    },
    archiveBusinessMediaVault:async()=>{throw Error('No media allowed in test')},
    archiveDeletedBusinessMessages:async(_connection,deleted)=>{
      calls.deletions.push(deleted);
      return {retained:true,affected:1,events:[{chatId:'333',messageId:17}],
        settings:{notifyDeletes:true},mediaRecovery:[]};
    },
    sendGhostEditAlert:async(_token,destination)=>{
      calls.alerts.push({kind:'edit',destination});return true;
    },
    sendGhostDeleteAlert:async(_token,destination)=>{
      calls.alerts.push({kind:'delete',destination});return true;
    }
  };
  const handler=vm.runInNewContext(body,vm.createContext(scope));
  async function call(update,providedSecret=secret){
    const res={code:null,payload:null,headers:{},
      setHeader(name,value){this.headers[name]=value;return this},
      status(code){this.code=code;return this},
      json(body){this.payload=body;return this}};
    await handler({method:'POST',headers:{
      'x-telegram-bot-api-secret-token':providedSecret
    },body:update},res);
    return res;
  }
  return {connection,calls,call};
}
test('after Business revocation, queued create/edit/delete webhooks are acknowledged without archiving',async()=>{
  const f=fixture(false);
  for(const action of ['business_message','edited_business_message']){
    const result=await f.call({[action]:newMessage});
    assert.equal(result.code,200);
    assert.equal(result.payload.privacy_message_ignored,'business_connection_disabled');
  }
  const del=await f.call({deleted_business_messages:{
    business_connection_id:'connected-A',chat:{id:333},message_ids:[17]}});
  assert.equal(del.code,200);
  assert.equal(del.payload.privacy_delete_ignored,'business_connection_disabled');
  assert.equal(f.calls.connectionReads,3);
  assert.equal(f.calls.archive.length,0);
  assert.equal(f.calls.deletions.length,0);
  assert.equal(f.calls.alerts.length,0);
});
test('unknown Business status returns retryable 503, never falsely stores or acknowledges',async()=>{
  const f=fixture(null);
  for(const action of ['business_message','deleted_business_messages']){
    const payload=action==='business_message'?newMessage:{
      business_connection_id:'connected-A',chat:{id:333},message_ids:[17]};
    const response=await f.call({[action]:payload});
    assert.equal(response.code,503);
    assert.equal(response.payload.retryable,true);
    assert.equal(response.headers['Retry-After'],'2');
  }
  assert.equal(f.calls.archive.length,0);
  assert.equal(f.calls.deletions.length,0);
  assert.equal(f.calls.alerts.length,0);
});
test('verified active connection retains new/edit/delete events and notifies owner bot chat',async()=>{
  const f=fixture(true);
  const fresh=await f.call({business_message:newMessage});
  assert.equal(fresh.code,200);
  assert.equal(fresh.payload.privacy_message_captured,true);
  const edit=await f.call({edited_business_message:{...newMessage,text:'Edited',
    edit_date:1770000000}});
  assert.equal(edit.code,200);
  assert.equal(edit.payload.edit_alert_sent,true);
  const del=await f.call({deleted_business_messages:{
    business_connection_id:'connected-A',chat:{id:333},message_ids:[17]}});
  assert.equal(del.code,200);
  assert.equal(del.payload.retained,true);
  assert.deepEqual(f.calls.archive.map(x=>x.type),['new','edit']);
  assert.equal(f.calls.deletions.length,1);
  assert.equal(f.calls.alerts.length,2);
  assert.ok(f.calls.alerts.every(x=>x.destination===999999));
});
test('unsigned webhook never reaches Telegram or the private archive',async()=>{
  const f=fixture(true);
  const result=await f.call({business_message:newMessage},'bad-secret');
  assert.equal(result.code,401);
  assert.equal(f.calls.connectionReads,0);
  assert.equal(f.calls.archive.length,0);
});
