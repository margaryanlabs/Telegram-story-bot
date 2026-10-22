import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import webhook from '../api/webhook-v8.js';
function response(){return {setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}}
test('mocked signed webhook preserves new/edit/delete archive flow and sends owner notifications with Mini App closed',async()=>{
  const oldFetch=globalThis.fetch,oldToken=process.env.TELEGRAM_BOT_TOKEN,oldHash=process.env.TELEGRAM_API_HASH;
  const token='fixture-token';process.env.TELEGRAM_BOT_TOKEN=token;process.env.TELEGRAM_API_HASH='fixture-hash';
  const connection={id:'new-connection',user:{id:111},user_chat_id:111,is_enabled:true,rights:{can_manage_stories:true}};
  const archive=new Map(),versions=[],alerts=[];
  let storeFail=false;
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options?.body||'{}');
    if(String(url).includes('api.telegram.org')) {
      const method=String(url).split('/').pop();
      let result;
      if(method==='getBusinessConnection') result=connection;
      else if(method==='sendMessage') {alerts.push(body);result={message_id:900};}
      else if(method==='getChatMenuButton') result={type:'web_app',web_app:{url:'https://example.test/studio.html?bc=old-connection&aud=contacts'}};
      else result=true;
      return {ok:true,json:async()=>({ok:true,result})};
    }
    const {op,args}=body;let data;
    if(op==='capture_business_message') {
      if(storeFail)throw Error('fixture storage unavailable');
      const row=args.row;versions.push(row.text_content);archive.set(row.message_id,row);
      data={captured:true,settings:{antiDelete:true,editHistory:true,notifyEdits:true}};
    } else if(op==='mark_business_messages_deleted') {
      if(storeFail)throw Error('fixture storage unavailable');
      const events=[];
      for(const id of args.messageIds) {
        const row=archive.get(id);if(row){row.deleted_at=args.deletedAt;events.push({chatId:row.chat_id,messageId:id,preview:row.text_content,direction:row.direction})}
      }
      data={affected:events.length,retained:events.length>0,events,settings:{notifyDeletes:true},mediaRecovery:[]};
    } else if(op==='upsert_business_connection_state') {
      if(storeFail)throw Error('fixture storage unavailable');
      assert.equal(args.row.businessConnectionId,'new-connection');data=args.row;
    } else throw Error('Unexpected store operation: '+op);
    return {ok:true,json:async()=>({ok:true,data})};
  };
  const send=async body=>{const res=response();await webhook({method:'POST',headers:{host:'example.test','x-telegram-bot-api-secret-token':crypto.createHash('sha256').update(token).digest('hex').slice(0,32)},body},res);return res};
  const message={business_connection_id:'new-connection',message_id:1,chat:{id:202,type:'private'},from:{id:202,first_name:'Consenting test'},text:'before',date:Math.floor(Date.now()/1000)};
  try {
    assert.equal((await send({business_message:message})).code,200);assert.equal(archive.get(1).text_content,'before');
    const edit=await send({edited_business_message:{...message,text:'after',edit_date:message.date+1}});
    assert.equal(edit.body.edit_alert_sent,true);assert.deepEqual(versions,['before','after']);
    const del=await send({deleted_business_messages:{business_connection_id:'new-connection',chat:message.chat,message_ids:[1]}});
    assert.equal(del.body.retained,true);assert.equal(del.body.alert_sent,true);assert.ok(archive.get(1).deleted_at);
    assert.equal(alerts.length,2);assert.ok(alerts.every(a=>String(a.chat_id)==='111'));
    assert.match(alerts[1].text,/after/);
    storeFail=true;
    assert.equal((await send({business_message:{...message,message_id:2}})).code,503);
    assert.equal((await send({deleted_business_messages:{business_connection_id:'new-connection',chat:message.chat,message_ids:[1]}})).code,503);
    const connectionFailure=await send({business_connection:connection});assert.equal(connectionFailure.code,503);
    assert.equal(connectionFailure.body.retryable,true);
    storeFail=false;assert.equal((await send({business_connection:connection})).code,200);
  } finally {
    globalThis.fetch=oldFetch;if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;
    if(oldHash===undefined)delete process.env.TELEGRAM_API_HASH;else process.env.TELEGRAM_API_HASH=oldHash;
  }
});
