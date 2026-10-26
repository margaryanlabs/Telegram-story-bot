import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { Api, errors } from 'teleproto';
import { normalizeTelegramPhone, classifyTelegramAuthError } from '../lib/telegram-auth-feedback.js';
import { beginUserAuth, resendUserAuthCode, telegramCodeMetadata, verifyUserCode, verifyUserPassword } from '../lib/viewer-sync-telegram.js';

const before={id:process.env.TELEGRAM_API_ID,hash:process.env.TELEGRAM_API_HASH};
process.env.TELEGRAM_API_ID='12345';process.env.TELEGRAM_API_HASH='fixture-only';
after(()=>{for(const [key,value] of [['TELEGRAM_API_ID',before.id],['TELEGRAM_API_HASH',before.hash]]){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
}});
const sent=(type=new Api.auth.SentCodeTypeApp({length:5}),extra={})=>new Api.auth.SentCode({type,phoneCodeHash:'fixture-hash',...extra});
function client(invoke){
  return {connect:async()=>{},disconnect:async()=>{},invoke,session:{save:()=> 'fixture-session'}};
}
test('raw auth.sendCode preserves actual medium, next medium, deadline and code format',async()=>{
  const start=Date.now();let requests=0;
  const result=await beginUserAuth('+374 (99) 123-456',{clientFactory:(session,options)=>{
    assert.equal(session,'');assert.equal(options.requestRetries,2);
    return client(async rpc=>{requests++;assert.ok(rpc instanceof Api.auth.SendCode);assert.equal(rpc.phoneNumber,'+37499123456');
      return sent(undefined,{nextType:new Api.auth.CodeTypeSms({}),timeout:37});});
  }});
  assert.equal(requests,1);assert.equal(result.delivery,'telegram_app');assert.equal(result.sentCodeType,'auth.SentCodeTypeApp');
  assert.equal(result.nextDelivery,'sms');assert.equal(result.canResend,true);assert.equal(result.codeLength,5);assert.equal(result.codeFormat,'digits');
  assert.ok(Date.parse(result.resendAvailableAt)>=start+37_000);assert.equal(result.code,undefined);
});
test('normalization rejects letters, invalid country prefixes and embedded plus signs',()=>{
  for(const phone of ['+37499abc123456','+00000000','+374+99123456']) assert.throws(()=>normalizeTelegramPhone(phone),/PHONE_NUMBER_INVALID/);
  assert.equal(normalizeTelegramPhone(' +374 (99) 123.456 '),'+37499123456');
});
test('real SDK FloodWait errors retain the exact server wait in safe feedback',()=>{
  for(const Type of [errors.FloodWaitError,errors.FloodTestPhoneWaitError]){
    const result=classifyTelegramAuthError(new Type({capture:3600}));
    assert.equal(result.status,429);assert.equal(result.retryAfterSeconds,3600);
  }
  assert.equal(classifyTelegramAuthError(new Error('API_ID_INVALID')).status,503);
});
test('absent timeout, unsupported type and absent next medium never grant resend',()=>{
  for(const extra of [{nextType:new Api.auth.CodeTypeSms({})},{timeout:0},{}]){
    const result=telegramCodeMetadata(sent(undefined,extra));assert.equal(result.canResend,false);assert.equal(result.resendAvailableAt,null);
  }
  const result=telegramCodeMetadata(sent({className:'auth.FutureUnrecognizedType'},{timeout:0}));
  assert.equal(result.delivery,'unknown');assert.equal(result.sentCodeType,'unknown');
});
test('all supported Telegram delivery types remain distinct',()=>{
  for(const [ctor,delivery] of [['SentCodeTypeSms','sms'],['SentCodeTypeCall','call'],['SentCodeTypeFlashCall','flash_call'],
    ['SentCodeTypeMissedCall','missed_call'],['SentCodeTypeEmailCode','email_code'],['SentCodeTypeSetUpEmailRequired','email_setup'],
    ['SentCodeTypeFragmentSms','fragment_sms'],['SentCodeTypeFirebaseSms','firebase_sms']]){
    assert.equal(telegramCodeMetadata(sent(new Api.auth[ctor]({length:5}))).delivery,delivery);
  }
});
test('a permitted resend uses durable session and latest hash without calling sendCode',async()=>{
  let calls=0;const state={phone:'+37499123456',session:'old-session',phoneCodeHash:'old-hash',nextDelivery:'sms',
    canResend:true,resendAvailableAt:new Date(Date.now()-1).toISOString()};
  const result=await resendUserAuthCode(state,{clientFactory:(session)=>{
    assert.equal(session,'old-session');return client(async rpc=>{
      calls++;assert.ok(rpc instanceof Api.auth.ResendCode);assert.equal(rpc.phoneCodeHash,'old-hash');
      return sent(new Api.auth.SentCodeTypeSms({length:6}),{phoneCodeHash:'replacement-hash'});
    });
  }});
  assert.equal(calls,1);assert.equal(result.phoneCodeHash,'replacement-hash');assert.equal(result.delivery,'sms');assert.equal(result.canResend,false);
});
test('too-early, missing or malformed resend permission never creates a Telegram client',async()=>{
  let clients=0;const clientFactory=()=>{clients++;throw Error('must-not-connect')};
  await assert.rejects(resendUserAuthCode({nextDelivery:'sms',canResend:true,resendAvailableAt:new Date(Date.now()+60_000).toISOString()},{clientFactory}),e=>e.status===429&&e.retryAfterSeconds>0);
  for(const state of [{},{nextDelivery:'sms',canResend:true,resendAvailableAt:'invalid'}])
    await assert.rejects(resendUserAuthCode(state,{clientFactory}),/TELEGRAM_RESEND_UNAVAILABLE/);
  assert.equal(clients,0);
});
test('AUTH_RESTART and FLOOD_WAIT never trigger recursive sendCode attempts',async()=>{
  for(const name of ['AUTH_RESTART','FLOOD_WAIT_3600']){
    let calls=0;const error=Object.assign(new Error(name),{errorMessage:name});
    await assert.rejects(beginUserAuth('+37499123456',{clientFactory:()=>client(async()=>{calls++;throw error})}),e=>e===error);
    assert.equal(calls,1);
  }
});
test('SentCodeSuccess and pre-code 2FA return explicit authorization states',async()=>{
  const user=new Api.User({id:111n,firstName:'Fixture'});
  const result=await beginUserAuth('+37499123456',{clientFactory:()=>client(async()=>new Api.auth.SentCodeSuccess({authorization:new Api.auth.Authorization({user})}))});
  assert.equal(result.connected,true);assert.equal(result.user.id,'111');assert.equal(result.delivery,undefined);
  const password=await beginUserAuth('+37499123456',{clientFactory:()=>client(async()=>{throw Object.assign(new Error('SESSION_PASSWORD_NEEDED'),{errorMessage:'SESSION_PASSWORD_NEEDED'})})});
  assert.equal(password.needsPassword,true);assert.equal(password.session,'fixture-session');assert.equal(password.delivery,undefined);
});
test('word and phrase codes preserve text and are not mistaken for numeric OTP',async()=>{
  for(const [ctor,format,code] of [['SentCodeTypeSmsWord','word','river'],['SentCodeTypeSmsPhrase','phrase','the blue river']]){
    const metadata=telegramCodeMetadata(sent(new Api.auth[ctor]({})));assert.equal(metadata.codeFormat,format);
    await verifyUserCode({phone:'+37499123456',session:'fixture-session',phoneCodeHash:'fixture-hash',...metadata},code,{clientFactory:()=>client(async rpc=>{
      assert.equal(rpc.phoneCode,code);return new Api.auth.Authorization({user:new Api.User({id:111n})});
    })});
  }
});
test('password errors preserve the actual RPC classification instead of AUTH_USER_CANCEL',async()=>{
  const error=Object.assign(new Error('PASSWORD_HASH_INVALID'),{errorMessage:'PASSWORD_HASH_INVALID'});
  const c=client(async()=>{});c.signInWithPassword=async(_credentials,options)=>options.onError(error);
  await assert.rejects(verifyUserPassword({session:'fixture-session'},'fixture-password',{clientFactory:()=>c}),e=>e===error);
});

const api=readFileSync(new URL('../api/viewer-sync.js',import.meta.url),'utf8');
const statusSource=api.slice(api.indexOf('function codeStatus('),api.indexOf('\nasync function completePhoneAuthorization('));
const resendSource=api.slice(api.indexOf("    if (action === 'resend_code') {"),api.indexOf("    if (action === 'send_login_email') {"));
function response(){return {statusCode:0,data:null,headers:{},setHeader(k,v){this.headers[k]=v},status(v){this.statusCode=v;return this},json(v){this.data=v;return this}}}
function runtime(shared,{deadline=-1000,canResend=true,failSave=false,sendPending=null,floodWait=0}={}){
  const state={phone:'+37499123456',phoneCodeHash:'fixture-hash',session:'fixture-session',delivery:'telegram_app',sentCodeType:'auth.SentCodeTypeApp',
    nextDelivery:'sms',canResend,resendAvailableAt:new Date(Date.now()+deadline).toISOString()};
  const scope=vm.createContext({
    userId:'111',config:{newConnectionsReady:true},AUTH_TTL_MS:600000,
    classifyTelegramAuthError,
    inFlightLoginCodeOwners:new Set(),selectedStorageProvider:()=> 'neon',randomUUID:()=>String(++shared.sequence),
    claimLoginCodeLease:async(_owner,token)=>{if(shared.lease)return {acquired:false};shared.lease=token;return {acquired:true}},
    releaseLoginCodeLease:async(_owner,token)=>{if(shared.lease===token)shared.lease=null},
    deferLoginCodeLease:async(_owner,token,seconds)=>{assert.equal(token,shared.lease);shared.wait=seconds;return {deferred:true}},
    getAuthChallenge:async()=>shared.challenge||{stage:'code',expires_at:new Date(Date.now()+600000).toISOString(),challenge_ciphertext:JSON.stringify(state)},
    openJson:async value=>JSON.parse(value),sealJson:async value=>JSON.stringify(value),
    saveAuthChallenge:async value=>{if(failSave)return null;shared.challenge=value;return value},
    resendUserAuthCode:async()=>{shared.calls++;if(floodWait)throw new errors.FloodWaitError({capture:floodWait});if(sendPending)await sendPending;return {phone:'+37499123456',session:'new-fixture-session',phoneCodeHash:'new-fixture-hash',delivery:'sms',canResend:false}},
  });
  return vm.runInContext('(function(){'+statusSource+';return async function(res){const action="resend_code";'+resendSource+'}})()',scope);
}
test('real resend handler refuses unsupported or early retries without contacting Telegram',async()=>{
  for(const [options,expected] of [[{deadline:60_000},429],[{canResend:false},409]]){
    const shared={sequence:0,calls:0,lease:null};const res=response();await runtime(shared,options)(res);
    assert.equal(res.statusCode,expected);assert.equal(shared.calls,0);assert.equal(shared.lease,null);
  }
});
test('real resend handler persists replacement state and exposes no auth secrets',async()=>{
  const shared={sequence:0,calls:0,lease:null};const res=response();await runtime(shared)(res);
  assert.equal(res.statusCode,200);assert.equal(shared.calls,1);assert.equal(res.data.delivery,'sms');assert.equal(shared.lease,null);
  assert.ok(shared.challenge.challenge_ciphertext.includes('new-fixture-hash'));
  assert.doesNotMatch(JSON.stringify(res.data),/fixture-hash|fixture-session|phoneCodeHash/);
});
test('two independent resend runtimes serialize through the durable owner lease',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve});const shared={sequence:0,calls:0,lease:null};
  const a=response(),b=response();const first=runtime(shared,{sendPending:pending})(a);
  await new Promise(resolve=>setImmediate(resolve));await runtime(shared)(b);
  assert.equal(b.statusCode,429);assert.equal(shared.calls,1);release();await first;
  assert.equal(a.statusCode,200);assert.equal(shared.lease,null);
});
test('unconfirmed replacement challenge retains the resend lease and returns no success',async()=>{
  const shared={sequence:0,calls:0,lease:null};const res=response();
  await assert.rejects(runtime(shared,{failSave:true})(res),/AUTH_CHALLENGE_PERSISTENCE_UNCONFIRMED/);
  assert.equal(shared.calls,1);assert.notEqual(shared.lease,null);assert.equal(res.statusCode,0);
});
test('actual resend handler persists a real SDK FLOOD_WAIT on its token-bound lease',async()=>{
  const shared={sequence:0,calls:0,lease:null};const res=response();
  await assert.rejects(runtime(shared,{floodWait:3600})(res),e=>e instanceof errors.FloodWaitError);
  assert.equal(shared.wait,3600);assert.notEqual(shared.lease,null);assert.equal(res.statusCode,0);
});
test('Neon cooldown SQL extends only the owner and token lease using bound parameters',async()=>{
  const source=readFileSync(new URL('../lib/neon-store.js',import.meta.url),'utf8');
  const branch=source.slice(source.indexOf(" case 'defer_login_code_lease': {"),source.indexOf(" case 'release_login_code_lease': {"));
  let statement,params;
  const fn=vm.runInNewContext('(async function(a,user){const op="defer_login_code_lease";switch(op){'+branch+'}})',{
    owner:String,int:(value,low,high)=>Math.max(low,Math.min(high,Math.floor(Number(value)||low))),
    query:async(sql,args)=>{statement=sql;params=args;return [{telegram_user_id:'111'}]},
  });
  const token='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';const result=await fn({leaseToken:token,retryAfterSeconds:3600},'111');
  assert.equal(result.deferred,true);assert.deepEqual(Array.from(params),['111',token,3600]);
  assert.match(statement,/expires_at=GREATEST\(expires_at,now\(\)\+/);
  assert.match(statement,/WHERE telegram_user_id=\$1::bigint AND lease_token=\$2::uuid/);
  await assert.rejects(fn({leaseToken:'invalid',retryAfterSeconds:3600},'111'),/INVALID_LOGIN_CODE_LEASE_TOKEN/);
});
test('a rejected Neon login lease reports the durable remaining cooldown',async()=>{
  const source=readFileSync(new URL('../lib/neon-store.js',import.meta.url),'utf8');
  const branch=source.slice(source.indexOf(" case 'claim_login_code_lease': {"),source.indexOf(" case 'release_login_code_lease': {"));
  const queries=[];const fn=vm.runInNewContext('(async function(a,user){const op="claim_login_code_lease";switch(op){'+branch+'}})',{
    owner:String,int:(value,low,high)=>Math.max(low,Math.min(high,Math.floor(Number(value)||low))),
    one:async(sql,args)=>{queries.push({sql,args});return queries.length===1?null:{retry_after_seconds:3599}},
  });
  const result=await fn({leaseToken:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',ttlSeconds:180},'111');
  assert.equal(result.acquired,false);assert.equal(result.retryAfterSeconds,3599);
  assert.match(queries[1].sql,/FROM public\.veto_login_code_leases WHERE telegram_user_id=\$1::bigint/);
  const business=source.slice(source.indexOf(" case 'claim_business_write_lease':"),source.indexOf(" case 'defer_login_code_lease':"));
  assert.doesNotMatch(business,/SELECT[\s\S]*veto_login_code_leases/);
});
