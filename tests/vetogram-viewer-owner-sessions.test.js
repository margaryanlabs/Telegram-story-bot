import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {isOwnActiveViewerSession,sameTelegramAccount} from '../lib/telegram-session-owner.js';

const apiSource=readFileSync(new URL('../api/viewer-sync.js',import.meta.url),'utf8');
const qrSource=readFileSync(new URL('../api/viewer-qr.js',import.meta.url),'utf8');
const activeRow=(id='111',cipher='v4.ciphertext')=>({
  status:'active',telegram_account_user_id:id,session_ciphertext:cipher,
  telegram_account_username:'private_owner',telegram_account_first_name:'Sensitive name'
});
function sessionView(row,ownerId='111'){
  const i=apiSource.indexOf('function safeSession(');
  const end=apiSource.indexOf('\n}\n',i);
  assert.ok(i>0&&end>i);
  const fun=vm.runInNewContext('('+apiSource.slice(i,end+2)+')',
    vm.createContext({isOwnActiveViewerSession,sameTelegramAccount}));
  return fun(row,ownerId);
}
function handlerFixture(row){
  const calls=[];
  const scope={
    process:{env:{TELEGRAM_BOT_TOKEN:'fixture-token'}},
    setNoStore:()=>{},
    configState:async()=>({configured:true}),
    validateTelegramMiniApp:()=>({id:111}),
    getViewerSession:async()=>row,
    isOwnActiveViewerSession,
    sameTelegramAccount,
    safeSession:sessionView,
    getAuthChallenge:async()=>null,
    getViewerStoryData:async()=>null,
    getViewerAnalytics:async()=>{calls.push('analytics');return {}},
    getViewerExportData:async()=>{calls.push('export');return {}},
    sendTestViewerAlert:async()=>{calls.push('send-alert');return {message_id:999}},
    sendEvidenceCsv:async()=>{calls.push('send-export');return {}},
    registerRecentStories:async()=>{calls.push('register-stories');return []},
    upsertViewerSession:async row=>{calls.push('update-preferences');return row},
    classifyTelegramAuthError:()=>({status:500,message:'Failed'}),
    console:{warn:()=>{},error:()=>{}}
  };
  const start=apiSource.indexOf('export default async function handler(');
  assert.ok(start>0);
  const source=apiSource.slice(start).replace(/^export default /,'')+'\nhandler;';
  const handler=vm.runInNewContext(source,vm.createContext(scope));
  const call=async(action,method='POST',query={})=>{
    const res={setHeader(){return this},status(code){this.statusCode=code;return this},
      json(data){this.payload=data;return this}};
    await handler({method,headers:{'x-telegram-init-data':'fixture'},
      body:action?{action}:undefined,query},res);
    return res;
  };
  return {call,calls};
}
test('owner session readiness requires signed account, active status, and encrypted data',()=>{
  assert.equal(isOwnActiveViewerSession('111',activeRow()),true);
  assert.equal(isOwnActiveViewerSession(111,activeRow()),true);
  assert.equal(isOwnActiveViewerSession('222',activeRow()),false);
  assert.equal(isOwnActiveViewerSession('111',activeRow('111','')),false);
  assert.equal(isOwnActiveViewerSession('111',{...activeRow(),status:'revoked'}),false);
  assert.equal(isOwnActiveViewerSession('111',null),false);
});
test('viewer status redacts private profile fields of a mismatched stored account',()=>{
  const result=sessionView(activeRow('222'),'111');
  assert.equal(result.connected,false);
  assert.equal(result.identityMismatch,true);
  assert.equal(result.account,null);
  const sensitive=sessionView({...activeRow('222'),
    last_error:'private remote error',last_poll_at:'2030-01-01'},'111');
  assert.equal(sensitive.lastError,null);
  assert.equal(sensitive.lastPollAt,null);
  const valid=sessionView(activeRow(),'111');
  assert.equal(valid.connected,true);
  assert.equal(valid.account.username,'private_owner');
  assert.equal(sessionView(activeRow('111',''),'111').connected,false);
});
test('mismatched active session cannot send alerts, export, register Stories or change preferences',async()=>{
  const f=handlerFixture(activeRow('222'));
  for(const action of ['test_alert','export_csv','register_stories','preferences']){
    const res=await f.call(action);
    assert.equal(res.statusCode,409,action);
    assert.equal(res.payload.ok,false);
  }
  assert.deepEqual(f.calls,[]);
});
test('missing or unusable ciphertext also blocks sensitive viewer actions',async()=>{
  const f=handlerFixture(activeRow('111',''));
  for(const action of ['test_alert','export_csv','register_stories','preferences']){
    assert.equal((await f.call(action)).statusCode,409);
  }
  assert.deepEqual(f.calls,[]);
});
test('fully matching session can perform explicit test alert and change preferences',async()=>{
  const f=handlerFixture(activeRow('111'));
  const alert=await f.call('test_alert');
  assert.equal(alert.statusCode,200);
  assert.equal(alert.payload.sent,true);
  const change=await f.call('preferences');
  assert.equal(change.statusCode,200);
  assert.deepEqual(f.calls,['send-alert','update-preferences']);
});
test('QR never replaces an already active unverified session',()=>{
  assert.match(qrSource,/if \(existing\?\.status === 'active'\)/);
  assert.match(qrSource,/isOwnActiveViewerSession\(userId,existing\)/);
  assert.match(qrSource,/QR-вход остановлен/);
  assert.match(qrSource,/requireOwnTelegramAccount\(userId, result\.user\)/);
});
test('phone code stage blocks overwrite of a mismatched active session and retains challenge',()=>{
  const i=apiSource.indexOf("if (action === 'send_code')");
  const e=apiSource.indexOf("if (action === 'send_login_email')",i);
  const stage=apiSource.slice(i,e);
  assert.match(stage,/if \(linked\?\.status === 'active'\)/);
  assert.match(stage,/isOwnActiveViewerSession\(userId,linked\)/);
  assert.ok(stage.indexOf('getAuthChallenge(userId)')<stage.indexOf('beginUserAuth(requestedPhone)'));
  assert.ok(stage.indexOf('reused: true')<stage.indexOf('beginUserAuth(requestedPhone)'));
});
