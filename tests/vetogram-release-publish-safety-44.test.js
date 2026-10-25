import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ui=read('public/app.js');
const server=read('api/miniapp.js');
const publisher=read('lib/story-app-publisher.js');
const mtprotoOwner=read('lib/telegram-owner-runtime.js');
const send=read('api/telegram-send.js');
const compose=read('lib/telegram-chat-compose.js');
const privacy=read('public/privacy.js');
function section(source,open,close){
  const a=source.indexOf(open),b=source.indexOf(close,a+open.length);
  assert.ok(a>=0&&b>a,'Missing real code: '+open);
  return source.slice(a,b);
}
const appApi=section(ui,'  async function api(action = null, payload = {}) {','  async function viewerApi(');
const appPublish=section(ui,'  async function publishComposerStory() {','  function relativeTime(');
function fixture(response){
  let attempts=0;
  const tg={initData:'signed-owner'};
  const data={activity:[],history:[],lastStory:'884',ready:true};
  const fn=new Function('tg','state','requestJson','render','setAvatar',
    appApi+';return api')(
      tg,data,async(url,options,policy)=>{
        attempts++;
        assert.equal(url,'/api/miniapp');
        return response({options,policy,attempts});
      },()=>{},()=>{}
    );
  return {fn,tg,attempts:()=>attempts};
}
test('Story publication never silently retries a non-idempotent Bot API POST after timeout',async()=>{
  const f=fixture(({policy})=>{
    assert.equal(policy.retry,false);
    throw new Error('network timeout');
  });
  await assert.rejects(f.fn('publish_story',{nonce:'nonce-1'}),
    /могла пройти.*Проверь свои Stories/);
  assert.equal(f.attempts(),1);
});
test('read-only status and explicit connection check retain safe retry behavior',async()=>{
  const f=fixture(({policy})=>{
    assert.equal(policy.retry,true);
    return {response:{ok:true,status:200},data:{ok:true}};
  });
  await f.fn('check');await f.fn(null);
  assert.equal(f.attempts(),2);
});
test('uncertain HTTP 500 Story response is never displayed as a proven failure',async()=>{
  const f=fixture(()=>({
    response:{ok:false,status:500},
    data:{ok:false,error:'Timeout from publishing Telegram Story'}
  }));
  await assert.rejects(f.fn('publish_story',{nonce:'id'}),
    /Результат публикации не подтверждён.*Проверь свои Stories/);
  assert.equal(f.attempts(),1);
});
test('explicit permission rejection keeps real authorization failure, no false success',async()=>{
  const f=fixture(()=>({
    response:{ok:false,status:403},
    data:{ok:false,error:'Нужно подключить Telegram'}
  }));
  await assert.rejects(f.fn('publish_story',{nonce:'id'}),/Нужно подключить Telegram/);
});
function publishFixture(answer){
  const tg={initData:'signed-owner'},fields={storyCaption:{value:'Тестовая Story'},
    storyFileInput:{clicked:0,click(){this.clicked++}},selectedRow:{click(){}}
  };
  const state={audience:'standard',selected:[],excluded:[],processing:false,
    ready:true,lastStory:'884',protect:false};
  let busy=false,clears=0,published=0;
  const controller=new Function('tg','state','viewerState','$','telegramAccountReady',
    'renderPublish','haptic','api','resetComposer','notify','showToast','audienceLabel',
    'escapeHtml','openSheet','connectionHelpSheet','refreshViewerSync','refreshViewerAnalytics',
    "let composerBusy=false,composerDataUrl='data:image/jpeg;base64,photo',composerOwner='signed-owner',composerNonce='nonce',selectedViewerStory=null;"+
    appPublish+';return publishComposerStory')(
    tg,state,{session:{connected:false}},id=>fields[id],()=>true,
    ()=>{},()=>{},async()=>answer,()=>{clears++},()=>{},()=>{},x=>x,
    x=>String(x),()=>{published++},()=>{},async()=>{},async()=>{}
  );
  return {controller,state,cleared:()=>clears,modal:()=>published};
}
test('missing Story ID cannot be replaced by an older stored Story ID',async()=>{
  const f=publishFixture({published:true});
  await assert.rejects(f.controller(),/не подтвердил ID новой Story/);
  assert.equal(f.cleared(),0);
  assert.equal(f.modal(),0);
  assert.equal(f.state.processing,false);
});
test('unconfirmed publish result cannot trigger Story success screen or discard image',async()=>{
  const f=publishFixture({published:false,storyId:'123'});
  await assert.rejects(f.controller(),/не подтвердил ID новой Story/);
  assert.equal(f.cleared(),0);assert.equal(f.modal(),0);
});
test('confirmed numeric Story ID is needed before clearing media or announcing success',async()=>{
  const f=publishFixture({published:true,storyId:'245',transport:'mtproto'});
  await f.controller();
  assert.equal(f.cleared(),1);assert.equal(f.modal(),1);
});
test('personal Story publisher validates real MTProto account before any upload',()=>{
  const personal=section(publisher,'export async function publishPhotoStoryUserSession({',
    'export async function ');
  assert.match(personal,/ownerId,/);
  assert.match(personal,/await verifyTelegramClientOwner\(client, String\(ownerId\)\)/);
  assert.ok(personal.indexOf('verifyTelegramClientOwner(client, String(ownerId))')<
    personal.indexOf("client.getInputEntity('me')"));
  assert.ok(personal.indexOf('verifyTelegramClientOwner(client, String(ownerId))')<
    personal.indexOf('client.uploadFile('));
  assert.match(server,/ownerId: String\(chatId\)/);
  assert.match(mtprotoOwner,/sameTelegramAccount\(ownerId, me\?\.id\)/);
  assert.match(send,/await verifyTelegramClientOwner\(client,userId\)/);
});
test('MTProto publisher never assumes newest existing Story ID belongs to a new send',()=>{
  const excerpt=section(publisher,'async function postPhotoStoryMtproto(',
    'function isTransientMtprotoError(');
  const personal=section(publisher,'export async function publishPhotoStoryUserSession({',
    'export async function ');
  for(const code of [excerpt,personal]){
    assert.doesNotMatch(code,/getPeerStories\(\{ peer \}\)/);
    assert.doesNotMatch(code,/const newest =/);
    assert.match(code,/STORY_PUBLISH_RESULT_UNCERTAIN/);
    assert.match(code,/if \(!Number\.isInteger\(Number\(storyId\)\)/);
  }
});
test('Telegram text sending still enforces real owner proof and nonce controls',()=>{
  assert.match(send,/validateTelegramMiniApp/);
  assert.match(send,/sameTelegramAccount\(userId,session\.telegram_account_user_id\)/);
  assert.match(send,/verifyTelegramClientOwner\(client,userId\)/);
  assert.match(compose,/function validateSendNonce\(value\)/);
  assert.match(compose,/function makeRandomId\(ownerId, chatId, nonce\)/);
  assert.match(privacy,/scopeConsent:/);
});
