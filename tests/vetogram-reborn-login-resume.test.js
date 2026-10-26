import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/viewer-sync.js',import.meta.url),'utf8');

function errorFixture() {
  const inserted=[];
  const slot={
    textContent:'',hidden:true,
    insertAdjacentElement:(_where,element)=>inserted.push(element),
  };
  const elements={viewerAuthError:slot};
  const notices=[];
  const context=vm.createContext({
    $:id=>elements[id]||null,
    viewerState:{loginPending:null},
    notify:kind=>notices.push(kind),
    showToast:message=>notices.push(message),
    document:{
      createElement(tag){
        return {
          tagName:tag,dataset:{},children:[],
          append(...children){this.children.push(...children)},
        };
      },
    },
    Date,
  });
  const start=app.indexOf('  function showViewerAuthError(error) {');
  const end=app.indexOf('\n  async function runViewerAuthAction(',start);
  assert.ok(start>0&&end>start,'real error handler must be inspectable');
  const fn=vm.runInContext('('+app.slice(start,end).trim()+')',context);
  return {fn,slot,inserted,notices,context};
}

test('a valid existing Telegram challenge offers resume or explicit cancellation',()=>{
  const f=errorFixture();
  const expiresAt=new Date(Date.now()+120000).toISOString();
  f.fn(Object.assign(new Error('Уже есть незавершённый вход'),{
    viewerData:{loginPending:{stage:'code',expiresAt}},
  }));
  assert.equal(f.slot.hidden,false);
  assert.match(f.slot.textContent,/незавершённый вход/);
  assert.equal(f.inserted.length,1);
  const actions=f.inserted[0].children.map(x=>x.dataset.sheetAction);
  assert.deepEqual(Array.from(actions),['viewer-resume-login','viewer-cancel-login']);
  assert.equal(f.context.viewerState.loginPending.stage,'code');
  assert.equal(f.notices.at(-1),'error');
});
test('expired, malformed and absent challenges never offer a stale resume control',()=>{
  for(const pending of [null,{stage:'code',expiresAt:new Date(0).toISOString()},
    {stage:'invalid',expiresAt:new Date(Date.now()+120000).toISOString()}]){
    const f=errorFixture();
    const error=new Error('Не удалось войти');
    if(pending)error.viewerData={loginPending:pending};
    f.fn(error);
    assert.equal(f.inserted.length,0);
    assert.equal(f.context.viewerState.loginPending,null);
  }
});
test('OTP error recovery is never interpreted as code receipt',()=>{
  assert.match(app,/viewerData\?\.loginPending/);
  assert.match(app,/viewerAuthRecovery/);
  assert.match(app,/Продолжить начатый вход/);
  assert.match(app,/Отменить запрос и сменить номер/);
  assert.doesNotMatch(app,/viewerAuthRecovery[\s\S]{0,800}viewerApi\('send_code'/);
});
test('the success and password paths never automatically open Business permission requests',()=>{
  assert.doesNotMatch(app,/VetoTelegramOpenUnifiedOnboarding\?\.\(\{automatic:true\}\)/);
  assert.match(app,/viewerState\.loginPending = \{\s*stage:'code', delivery:data\.delivery/);
  assert.match(app,/stage:'password'/);
  assert.match(app,/viewerState\.loginPending = null/);
  assert.match(app,/data\.reused === true/);
});
test('server respects unfinished challenges and never silently sends another code',()=>{
  const send=api.split("if (action === 'send_code') {")[1]
    ?.split("if (action === 'send_login_email')")[0];
  assert.ok(send,'real send_code implementation must exist');
  assert.ok(send.indexOf('getAuthChallenge(userId)')<send.indexOf('beginUserAuth(requestedPhone)'));
  assert.match(send,/pending\?\.phone === requestedPhone/);
  assert.match(send,/reused: true/);
  assert.match(send,/loginPending: \{ stage: existing\.stage/);
  assert.match(send,/retryAfterSeconds/);
  assert.match(send,/config\.newConnectionsReady !== true/);
});

test('a resumed code challenge never invents Telegram-app delivery metadata',()=>{
  // A failed encrypted-state read does not reveal the original channel.
  assert.ok(api.includes("?.delivery || 'unknown' : null"));
  assert.ok(app.includes("let viewerCodeDelivery='unknown'"));
  assert.ok(app.includes("viewerCodeDelivery=delivery || 'unknown'"));
  assert.ok(app.includes("viewerCodeSheet(pending.delivery || 'unknown')"));
  assert.ok(app.includes("stage:'code', delivery:data.delivery || 'unknown'"));
  assert.doesNotMatch(app,/pending\.delivery \|\| 'telegram_app'/);
});


test('concurrent OTP sends on one API runtime call Telegram only once', async()=>{
  const start=api.indexOf("    if (action === 'send_code') {");
  const end=api.indexOf("    if (action === 'send_login_email') {",start);
  assert.ok(start>=0 && end>start);
  const sendBranch=api.slice(start,end);
  assert.match(sendBranch,/inFlightLoginCodeOwners\.has\(codeOwner\)/);
  assert.match(sendBranch,/finally\s*\{\s*inFlightLoginCodeOwners\.delete\(codeOwner\)/);
  let releaseTelegram;
  const telegramPending=new Promise(resolve=>{releaseTelegram=resolve});
  let sent=0, persisted=null;
  const ctx=vm.createContext({
    userId:'123456',body:{phone:'+37499123456'},
    config:{newConnectionsReady:true},AUTH_TTL_MS:600000,
    inFlightLoginCodeOwners:new Set(),
    normalizeTelegramPhone:value=>value,
    getAuthChallenge:async()=>persisted,
    getViewerSession:async()=>null,
    isOwnActiveViewerSession:()=>false,
    openJson:async ciphertext=>JSON.parse(ciphertext),
    sealJson:async data=>JSON.stringify(data),
    saveAuthChallenge:async row=>{persisted=row;return row},
    beginUserAuth:async phone=>{
      sent++;
      await telegramPending;
      return {phone,phoneCodeHash:'test-hash',session:'test-session',delivery:'telegram_app'};
    },
  });
  const send=vm.runInContext(
    '(async function(res){const action="send_code";'+sendBranch+'})',ctx
  );
  const response=()=>({
    headers:{},statusCode:0,body:null,
    setHeader(name,value){this.headers[name]=value},
    status(code){this.statusCode=code;return this},
    json(data){this.body=data;return this},
  });
  const firstResponse=response(),secondResponse=response();
  const first=send(firstResponse);
  await send(secondResponse);
  assert.equal(secondResponse.statusCode,429);
  assert.equal(secondResponse.body.retryAfterSeconds,3);
  assert.equal(secondResponse.headers['Retry-After'],'3');
  releaseTelegram();
  await first;
  assert.equal(firstResponse.statusCode,200);
  assert.equal(firstResponse.body.reused,false);
  assert.equal(sent,1);
  const laterResponse=response();
  await send(laterResponse);
  assert.equal(laterResponse.statusCode,200);
  assert.equal(laterResponse.body.reused,true);
  assert.equal(sent,1);
});
