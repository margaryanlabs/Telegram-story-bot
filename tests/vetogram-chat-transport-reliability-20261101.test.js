import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('public/telegram-chats.js');
const app=read('public/app.js');
const chats=read('api/telegram-chats.js');
const media=read('api/telegram-chat-media.js');
const auth=read('lib/viewer-sync-telegram.js');

test('OTP has bounded Telegram connect, send and disconnect while browser never resends automatically',()=>{
  assert.match(auth,/withTimeout\(client\.connect\(\), 8000, 'Telegram login connect'\)/);
  assert.match(auth,/client\.sendCode\(\{ apiId, apiHash \}, phone, false\), 12000/);
  assert.match(auth,/new Promise\(resolve => setTimeout\(resolve, 1200\)\)/);
  assert.match(app,/timeoutMs: action==='send_code' \? 34000 : 18000/);
  assert.match(app,/retry: !action/);
});

test('inbox first page does not block live Telegram on archive and verifies owner before overlay',()=>{
  assert.match(chats,/action==='list_overlay'/);
  assert.match(chats,/const fastInbox=action==='list'&&page===0&&body\.fastInbox===true/);
  assert.match(chats,/\(fastLive\|\|fastInbox\)\?Promise\.resolve\(\[\]\):archiveThreads/);
  assert.match(chats,/if\(fastInbox&&!live\.account\?\.verified\)/);
  assert.match(chats,/archiveDeferred:Boolean\(fastInbox&&live\.account\?\.verified\)/);
  assert.match(ui,/request\('list',\{page:state\.page,fastInbox:state\.page===0\}\)/);
  assert.match(ui,/ownerKey!==String\(tg\?\.initData\|\|''\)/);
  assert.match(ui,/overlayEpoch!==state\.inboxOverlayEpoch/);
});

test('avatar batch keeps missing photos distinct from temporary failures',async()=>{
  const runtime=media.replace(/^import .+;\s*$/gm,'')
    .replace(/export async function /g,'async function ')
    .replace(/export default async function handler/,'async function handler');
  const client={
    getDialogs:async()=>[
      {id:'1',entity:{id:'1',photo:{}}},
      {id:'2',entity:{id:'2'}},
      {id:'3',entity:{id:'3',photo:{}}},
    ],
    downloadProfilePhoto:async entity=>{
      if(entity.id==='3')throw Error('temporary_media_error');
      return Buffer.from([255,216,255,217]);
    },
  };
  const ctx=vm.createContext({
    Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'test'}},
    validateTelegramMiniApp:()=>({id:'signed-owner'}),
    getViewerSession:async()=>({status:'active',telegram_account_user_id:'signed-owner',session_ciphertext:'cipher'}),
    openJson:async()=>({session:'cipher'}),
    withBackupClient:async(_,cb)=>cb(client),
    verifyTelegramClientOwner:async()=>({verified:true}),
    telegramOwnerError:()=>null,
    sharp:()=>{throw Error('tiny JPEG should bypass resize')},
  });
  new vm.Script(runtime+'\nglobalThis.mediaHandler=handler').runInContext(ctx);
  const res={code:200,setHeader(){return this},status(code){this.code=code;return this},
    json(data){this.body=data;return this}};
  await ctx.mediaHandler({method:'POST',headers:{'x-telegram-init-data':'signed'},
    body:{action:'avatar_batch',chatIds:['1','2','3']}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.avatars['1'],Buffer.from([255,216,255,217]).toString('base64'));
  assert.deepEqual(Array.from(res.body.missing),['2']);
  assert.deepEqual(Array.from(res.body.failed),['3']);
});

test('avatar frontend cooldown respects owner changes and avoids a reconnect storm',()=>{
  assert.match(ui,/avatarMissing:new Set\(\)/);
  assert.match(ui,/if\(missing\.has\(id\)\)/);
  assert.match(ui,/state\.avatarRetryAt\.set\(id,Date\.now\(\)\+25000\)/);
  assert.match(ui,/if\(throttled\)state\.avatarBlockedUntil=Date\.now\(\)\+delay/);
  assert.match(ui,/clearTimeout\(state\.avatarRetryTimer\)/);
  assert.match(ui,/epoch!==state\.avatarEpoch/);
});
