/* Actual private-media handler in a mock Telegram/runtime sandbox. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const original=readFileSync(new URL('../api/telegram-chat-media.js',import.meta.url),'utf8');
const runtime=original
  .replace(/^import .+;\s*$/gm,'')
  .replace(/export async function /g,'async function ')
  .replace(/export default async function handler/,'async function handler');
function fixture(){
  let dialogCalls=0,downloads=0,sessionCalls=0;
  const client={
    getDialogs:async()=>{dialogCalls++;return [
      {id:'1',entity:{photo:{}}},
      {id:'2',entity:{photo:{}}},
    ]},
    downloadProfilePhoto:async()=>{downloads++;return Buffer.from([255,216,255,217])},
  };
  const context=vm.createContext({
    Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'test-token'}},
    validateTelegramMiniApp:()=>({id:'owner-7'}),
    getViewerSession:async()=>{sessionCalls++;return {
      status:'active',telegram_account_user_id:'owner-7',session_ciphertext:'cipher',
    }},
    openJson:async()=>({session:'signed-telegram-session'}),
    withBackupClient:async(_,fn)=>fn(client),
    verifyTelegramClientOwner:async()=>({verified:true}),
    telegramOwnerError:()=>null,
    sharp:()=>{throw Error('Tiny JPEG should not need conversion')},
  });
  new vm.Script(runtime+'\nglobalThis.mediaHandler=handler;').runInContext(context);
  const res=()=>({
    code:200,headers:{},body:null,
    setHeader(name,value){this.headers[name]=value;return this},
    status(code){this.code=code;return this},
    json(value){this.body=value;return this},
    end(value){this.bytes=value;return this},
  });
  const request=body=>({
    method:'POST',headers:{'x-telegram-init-data':'signed'},body,
  });
  return {handler:context.mediaHandler,res,request,
    stats:()=>({dialogCalls,downloads,sessionCalls})};
}

test('batch validates all requested IDs and owner; one dialog scan returns only owner photos',async()=>{
  const f=fixture(),response=f.res();
  await f.handler(f.request({action:'avatar_batch',chatIds:['1','2','3']}),response);
  assert.equal(response.code,200);
  assert.equal(response.body.ok,true);
  assert.deepEqual(Object.keys(response.body.avatars).sort(),['1','2']);
  assert.equal(response.body.avatars['1'],Buffer.from([255,216,255,217]).toString('base64'));
  assert.equal(f.stats().dialogCalls,2,'missing third chat causes one bounded fallback scan');
  assert.equal(f.stats().downloads,2,'only owner-visible avatars are downloaded');
});

test('batch rejects too many or invalid chat IDs before opening a session',async()=>{
  const f=fixture();
  const invalid=[
    ['1','2','3','4','5','6','7'],
    ['1','hack-peer'],
    [],
  ];
  for(const ids of invalid){
    const response=f.res();
    await f.handler(f.request({action:'avatar_batch',chatIds:ids}),response);
    assert.equal(response.code,400);
  }
  assert.equal(f.stats().sessionCalls,0);
  assert.equal(f.stats().dialogCalls,0);
});


test('six profile thumbnails share one verified client and max two parallel downloads',async()=>{
  let active=0,peak=0,downloads=0,clientSessions=0;
  const client={
    getDialogs:async()=>Array.from({length:6},(_,i)=>({
      id:String(i+1),entity:{photo:{}},
    })),
    downloadProfilePhoto:async()=>{
      active++;peak=Math.max(peak,active);downloads++;
      await new Promise(resolve=>setImmediate(resolve));
      active--;
      return Buffer.from([255,216,255,217]);
    },
  };
  const ctx=vm.createContext({
    Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'test-token'}},
    validateTelegramMiniApp:()=>({id:'signed-user'}),
    getViewerSession:async()=>({
      status:'active',telegram_account_user_id:'signed-user',
      session_ciphertext:'cipher',
    }),
    openJson:async()=>({session:'owner-session'}),
    withBackupClient:async(_,callback)=>{clientSessions++;return callback(client)},
    verifyTelegramClientOwner:async()=>({verified:true}),
    telegramOwnerError:()=>null,
    sharp:()=>{throw Error('Already a tiny JPEG')},
  });
  new vm.Script(runtime+'\nglobalThis.mediaHandler=handler;').runInContext(ctx);
  const response={
    code:0,headers:{},setHeader(key,val){this.headers[key]=val;return this},
    status(code){this.code=code;return this},json(body){this.body=body;return this},
  };
  await ctx.mediaHandler({
    method:'POST',headers:{'x-telegram-init-data':'signed'},
    body:{action:'avatar_batch',chatIds:['1','2','3','4','5','6']},
  },response);
  assert.equal(response.code,200);
  assert.equal(Object.keys(response.body.avatars).length,6);
  assert.equal(clientSessions,1,'never reconnect once per avatar');
  assert.equal(downloads,6);
  assert.equal(peak,2,'no more than two concurrent thumbnail downloads');
});

test('Telegram flood limit fails closed rather than silently returning incomplete avatar success',async()=>{
  let downloads=0;
  const client={
    getDialogs:async()=>[{id:'1',entity:{photo:{}}},{id:'2',entity:{photo:{}}}],
    downloadProfilePhoto:async()=>{
      downloads++;
      throw new Error('FLOOD_WAIT_20');
    },
  };
  const ctx=vm.createContext({
    Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'test-token'}},
    validateTelegramMiniApp:()=>({id:'signed-user'}),
    getViewerSession:async()=>({
      status:'active',telegram_account_user_id:'signed-user',
      session_ciphertext:'cipher',
    }),
    openJson:async()=>({session:'owner-session'}),
    withBackupClient:async(_,callback)=>callback(client),
    verifyTelegramClientOwner:async()=>({verified:true}),
    telegramOwnerError:()=>null,
    sharp:()=>{throw Error('No conversion expected')},
  });
  new vm.Script(runtime+'\nglobalThis.mediaHandler=handler;').runInContext(ctx);
  const response={
    code:0,setHeader(){return this},
    status(code){this.code=code;return this},json(body){this.body=body;return this},
  };
  await ctx.mediaHandler({
    method:'POST',headers:{'x-telegram-init-data':'signed'},
    body:{action:'avatar_batch',chatIds:['1','2']},
  },response);
  assert.equal(response.code,429);
  assert.equal(response.body.ok,false);
  assert.ok(downloads<=2);
});
