import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Exercise the REAL v8 wrapper with fake v7, Telegram API and UI helpers.
// No network, Bot token, private Telegram account or Neon writes.
const src=readFileSync(new URL('../api/webhook-v8.js',import.meta.url),'utf8');
const start=src.indexOf('async function bestEffortUi(');
assert.ok(start>0);
const actual=src.slice(start).replace(/^export default async function handler/m,'async function handler')+
  '\nhandler;';

function fixture({readError=false,progressError=false,editError=false,cleanupError=false,
    supportedImage=true,storyPublished=true}={}){
  const calls={base:0,reads:0,progress:0,edits:0,cleanups:0,warnings:[]};
  const hash='d'.repeat(32);
  const fakeCrypto={createHash:()=>({update(){return this},digest(){return hash}})};
  const scope={
    crypto:fakeCrypto,
    process:{env:{TELEGRAM_BOT_TOKEN:'fixture-bot-token'}},
    console:{warn:(...args)=>calls.warnings.push(args)},
    isSupportedImageMessage:()=>supportedImage,
    getStoredState:async()=>{
      calls.reads++;
      if(readError)throw Error('transient_get_state_error');
      return {pickerMessage:42,selectedCount:0,audience:'standard'};
    },
    tg:async()=>{
      calls.progress++;
      if(progressError)throw Error('transient_send_progress_error');
      return {message_id:999};
    },
    deleteMessage:async()=>{
      calls.cleanups++;
      if(cleanupError)throw Error('transient_cleanup_error');
    },
    editMessage:async()=>{
      calls.edits++;
      if(editError)throw Error('transient_edit_notice_error');
    },
    audienceLabel:()=> 'Стандарт Telegram',
    v7Handler:async(_req,res)=>{
      calls.base++;
      res.status(200).json(storyPublished
        ? {ok:true,story_id:321}
        : {ok:false,error:'story_not_published'});
    },
  };
  const handler=vm.runInNewContext(actual,vm.createContext(scope));
  const res={
    code:0,payload:null,headers:{},
    setHeader(k,v){this.headers[k]=v;return this},
    status(code){this.code=code;return this},
    json(body){this.payload=body;return this},
  };
  const call=async body=>{
    await handler({method:'POST',headers:{'x-telegram-bot-api-secret-token':hash},body},res);
    return res;
  };
  return {calls,call};
}
const photo={message:{chat:{id:500},message_id:13,photo:[{file_id:'image'}]}};

test('failed Telegram progress message cannot suppress Story processing',async()=>{
  const f=fixture({progressError:true});
  const response=await f.call(photo);
  assert.equal(response.code,200);
  assert.equal(response.payload.story_id,321);
  assert.equal(f.calls.base,1);
  assert.equal(f.calls.progress,1);
  assert.equal(f.calls.edits,0);
  assert.ok(f.calls.warnings.length>0);
});
test('failed optional state lookup cannot suppress main webhook handler',async()=>{
  const f=fixture({readError:true});
  const response=await f.call(photo);
  assert.equal(response.code,200);
  assert.equal(f.calls.base,1);
  assert.equal(f.calls.edits,1);
});
test('failed publication UI status edit never changes v7 webhook response',async()=>{
  const f=fixture({editError:true});
  const response=await f.call(photo);
  assert.equal(response.code,200);
  assert.equal(response.payload.story_id,321);
  assert.equal(f.calls.base,1);
  assert.equal(f.calls.edits,1);
  assert.ok(f.calls.warnings.length>0);
});
test('optional picker cleanup failures cannot hide the real picker handling',async()=>{
  const f=fixture({supportedImage:false,cleanupError:true});
  const response=await f.call({message:{chat:{id:500},message_id:31,
    users_shared:{users:[{user_id:50}]}}});
  assert.equal(response.code,200);
  assert.equal(f.calls.base,1);
  assert.equal(f.calls.cleanups,2);
});
test('failed real Story creation cannot be claimed as published by visual UI',async()=>{
  const f=fixture({storyPublished:false});
  const response=await f.call(photo);
  assert.equal(response.code,200); // Mock v7 JSON response is the source of truth.
  assert.equal(response.payload.ok,false);
  assert.equal(f.calls.base,1);
});
