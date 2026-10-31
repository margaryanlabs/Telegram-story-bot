/* VETOGRAM 6.2 — deterministic no-network Messenger Calm regression tests.
 * Native Telegram top chrome and real private account traffic need device QA.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-messenger-calm.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const mediaSource=readFileSync(new URL('../api/telegram-chat-media.js',import.meta.url),'utf8');

test('calm palette is isolated to the combined VETOGRAM messenger and its story rail',()=>{
  assert.match(html,/href="\/vetogram-messenger-calm\.css\?v=20261031-v61-universe"/);
  assert.ok(html.indexOf('vetogram-messenger-calm.css')>html.indexOf('vetogram-universe-61.css'));
  assert.match(css,/body\.veto-chat-active \.veto-stage-fx/);
  assert.match(css,/\.veto-story-ring\{/);
  assert.match(css,/background-image:none!important/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/\b(?:https?:)?\/\//,'chat polish must not make external asset requests');
});

test('opening a thread does not fake a last-message history and warning-only reads are retryable',()=>{
  assert.doesNotMatch(source,/ПОСЛЕДНЕЕ ИЗ СПИСКА/);
  assert.match(source,/const teaser=empty\('Загружаю переписку'/);
  assert.match(source,/state\.threadLoadError=data\.warning&&!state\.messages\.length/);
  assert.match(source,/data-mirror-retry-thread/);
  assert.match(source,/owner!==state\.ownerInitData\|\|epoch!==state\.avatarEpoch/);
});

test('owner-verified avatar API separates peers with no photo from peers missing from the account',async()=>{
  const api=mediaSource
    .replace(/^import .+;\s*$/gm,'')
    .replace(/export async function /g,'async function ')
    .replace(/export default async function handler/,'async function handler');
  let photoDownloads=0;
  const client={
    getDialogs:async()=>[
      {id:'1',entity:{photo:{}}},
      {id:'2',entity:{}}, // real owner dialog without a profile photo
    ],
    downloadProfilePhoto:async()=>{photoDownloads++;return Buffer.from([255,216,255,217])},
  };
  const context=vm.createContext({
    Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'test'}},
    validateTelegramMiniApp:()=>({id:'owner'}),
    getViewerSession:async()=>({
      status:'active',telegram_account_user_id:'owner',session_ciphertext:'cipher',
    }),
    openJson:async()=>({session:'signed'}),
    withBackupClient:async(_,fn)=>fn(client),
    verifyTelegramClientOwner:async()=>({verified:true}),
    telegramOwnerError:()=>null,
    sharp:()=>{throw Error('JPEG should not be resized')},
  });
  new vm.Script(api+'\nglobalThis.avatarHandler=handler;').runInContext(context);
  const res={
    code:0,setHeader(){return this},
    status(code){this.code=code;return this},
    json(body){this.body=body;return this},
  };
  await context.avatarHandler({
    method:'POST',headers:{'x-telegram-init-data':'signed'},
    body:{action:'avatar_batch',chatIds:['1','2','3']},
  },res);
  assert.equal(res.code,200);
  assert.deepEqual(Array.from(res.body.noPhoto),['2']);
  assert.deepEqual(Object.keys(res.body.avatars),['1']);
  assert.equal(photoDownloads,1);
  assert.equal(res.body.noPhoto.includes('3'),false,'never expose whether a non-owner peer has a photo');
});

test('a failed avatar batch retries after backoff; photo-less peers never flood Telegram',async()=>{
  const start=source.indexOf('  // A single signed MTProto connection');
  const end=source.indexOf('  function rememberPreview(',start);
  assert.ok(start>0&&end>start,'keep the actual existing batch controller');
  const snippet=source.slice(start,end);
  let now=100000,seq=0,calls=0;
  const timers=new Map();
  const picture=Buffer.from([255,216,255,217]).toString('base64');
  const elements=['1','2'].map(id=>({
    dataset:{vetoAvatar:id},
    getBoundingClientRect:()=>({top:80,bottom:140}),
    closest:()=>null,
    replaceChildren(child){this.child=child},
  }));
  const state={
    ownerInitData:'signed',avatarEpoch:0,avatarActive:0,
    avatarQueue:[],avatarRequested:new Set(),avatarRetryAt:new Map(),
    avatarRetryCounts:new Map(),avatarNoPhoto:new Set(),avatarUrls:new Map(),
    thread:null,connectionProof:{verified:true},
  };
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},Date:class extends Date{static now(){return now}},
    $:id=>id==='telegramChatsView'?{hidden:false}:{hidden:true},
    document:{
      querySelector:()=>({dataset:{screen:'telegram'}}),
      querySelectorAll:()=>elements,
      createElement:tag=>({tag}),
    },
    window:{innerHeight:750,addEventListener:()=>{}},
    fetch:async(_,options)=>{
      calls++;
      const ids=JSON.parse(options.body).chatIds;
      assert.ok(ids.length<=6);
      if(calls===1)return {ok:true,json:async()=>({ok:true,avatars:{},noPhoto:['2']})};
      return {ok:true,json:async()=>({ok:true,avatars:{'1':picture},noPhoto:[]})};
    },
    AbortController,
    setTimeout:(fn,delay)=>{const id=++seq;timers.set(id,{fn,delay});return id},
    clearTimeout:id=>timers.delete(id),
    atob:encoded=>Buffer.from(encoded,'base64').toString('binary'),
    Blob:class{constructor(parts){this.parts=parts}},
    URL:{createObjectURL:()=> 'blob:signed-owner-photo',revokeObjectURL:()=>{}},
    requestAnimationFrame:fn=>fn(),
  });
  new vm.Script(snippet).runInContext(ctx);
  const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
  new vm.Script('queueVisibleAvatars()').runInContext(ctx);
  await flush();
  assert.equal(calls,1);
  assert.equal(state.avatarNoPhoto.has('2'),true);
  assert.equal(state.avatarRetryAt.has('1'),true);
  assert.equal(state.avatarRetryAt.has('2'),false);
  assert.equal(timers.size,1,'one automatic retry after a failed profile download');
  const [timerId,timer]=[...timers.entries()][0];
  now+=timer.delay;timers.delete(timerId);timer.fn();
  await flush();
  assert.equal(calls,2,'avatar retry happens without scrolling or reopening a chat');
  assert.equal(state.avatarUrls.get('1'),'blob:signed-owner-photo');
  assert.equal(state.avatarRetryAt.size,0);
  assert.equal(timers.size,0);
});
