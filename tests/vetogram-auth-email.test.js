import test from 'node:test';
import assert from 'node:assert/strict';
import { Api } from 'teleproto';
import { beginUserAuth, beginUserQrAuth, verifyUserPassword, verifyUserCode, sendUserLoginEmail } from '../lib/viewer-sync-telegram.js';
import { normalizeTelegramPhone } from '../lib/telegram-auth-feedback.js';
const user = new Api.User({id:111n,firstName:'Test'});
const authorized = () => new Api.auth.Authorization({user});
function fakeClient(invoke=async()=>authorized(),sent={phoneCodeHash:'test-hash',isCodeViaApp:true}) {
  return {connect:async()=>{},disconnect:async()=>{},session:{save:()=> 'test-session'},sendCode:async()=>sent,invoke};
}
test('phone normalization keeps digits and rejects malformed international numbers',()=>{
  assert.equal(normalizeTelegramPhone('+374 (99) 123-456'),'+37499123456');
  assert.equal(normalizeTelegramPhone('+7 999 123 45 67'),'+79991234567');
  for(const phone of ['12345678','++37499123456','+123','+1234567890123456']) assert.throws(()=>normalizeTelegramPhone(phone));
});
test('sendCode preserves Telegram email/login delivery steps without email or code retention',async()=>{
  const beforeId=process.env.TELEGRAM_API_ID,beforeHash=process.env.TELEGRAM_API_HASH;
  process.env.TELEGRAM_API_ID='12345';process.env.TELEGRAM_API_HASH='fixture-hash';
  try {
    for(const [sent,delivery] of [[{emailRequired:true},'email_setup'],[{emailCodeSent:true},'email_code'],[{isCodeViaApp:true},'telegram_app'],[{},'sms_or_other']]) {
      const result=await beginUserAuth('+37499123456',{clientFactory:()=>fakeClient(undefined,{phoneCodeHash:'test-hash',...sent})});
      assert.equal(result.delivery,delivery);assert.equal(result.session,'test-session');assert.equal(result.email,undefined);assert.equal(result.code,undefined);
    }
  } finally {if(beforeId===undefined)delete process.env.TELEGRAM_API_ID;else process.env.TELEGRAM_API_ID=beforeId;if(beforeHash===undefined)delete process.env.TELEGRAM_API_HASH;else process.env.TELEGRAM_API_HASH=beforeHash;}
});
test('email login uses official auth.SignIn emailVerification; ordinary code retains phoneCode',async()=>{
  for(const delivery of ['email_code','telegram_app']) {
    let rpc;
    const result=await verifyUserCode({phone:'+37499123456',phoneCodeHash:'hash',session:'fixture',delivery},'12345',{
      clientFactory:()=>fakeClient(async request=>{rpc=request;return authorized()}),
    });
    assert.ok(rpc instanceof Api.auth.SignIn);
    if(delivery==='email_code') {assert.ok(rpc.emailVerification instanceof Api.EmailVerificationCode);assert.equal(rpc.phoneCode,undefined);}
    else {assert.equal(rpc.phoneCode,'12345');assert.equal(rpc.emailVerification,undefined);}
    assert.equal(result.user.id,'111');assert.equal(result.needsPassword,false);
  }
});
test('email setup verifies address through Telegram then preserves the new code hash',async()=>{
  const auth={phone:'+37499123456',phoneCodeHash:'old-hash',session:'fixture',delivery:'email_setup'};
  let setupRpc,verifyRpc;
  const next=await sendUserLoginEmail(auth,'consenting-test@example.com',{clientFactory:()=>fakeClient(async rpc=>{setupRpc=rpc;return {}})});
  assert.ok(setupRpc instanceof Api.account.SendVerifyEmailCode);
  assert.ok(setupRpc.purpose instanceof Api.EmailVerifyPurposeLoginSetup);
  assert.equal(next.delivery,'email_setup_code');assert.equal(next.email,undefined);
  const result=await verifyUserCode(next,'123456',{clientFactory:()=>fakeClient(async rpc=>{
    verifyRpc=rpc;return {sentCode:new Api.auth.SentCode({phoneCodeHash:'new-hash',type:new Api.auth.SentCodeTypeEmailCode({emailPattern:'t***@example.com',length:6})})};
  })});
  assert.ok(verifyRpc instanceof Api.account.VerifyEmail);
  assert.ok(verifyRpc.verification instanceof Api.EmailVerificationCode);
  assert.equal(result.nextCode,true);assert.equal(result.authState.phoneCodeHash,'new-hash');assert.equal(result.authState.delivery,'email_code');
  assert.equal(result.authState.code,undefined);
});
test('Telegram 2FA request retains the session without retaining verification code',async()=>{
  const result=await verifyUserCode({phone:'+37499123456',session:'fixture',phoneCodeHash:'hash'},'12345',{
    clientFactory:()=>fakeClient(async()=>{throw Object.assign(new Error('SESSION_PASSWORD_NEEDED'),{errorMessage:'SESSION_PASSWORD_NEEDED'})}),
  });
  assert.equal(result.needsPassword,true);assert.equal(result.session,'test-session');assert.equal(result.code,undefined);
});

test('email verification can finish authorization immediately via SentCodeSuccess',async()=>{
  const result=await verifyUserCode({phone:'+37499123456',phoneCodeHash:'hash',session:'fixture',delivery:'email_setup_code'},'123456',{
    clientFactory:()=>fakeClient(async()=>({sentCode:new Api.auth.SentCodeSuccess({authorization:authorized()})})),
  });
  assert.equal(result.needsPassword,false);assert.equal(result.user.id,'111');assert.equal(result.session,'test-session');
});
test('QR authorization and SRP password entry preserve the authorized owner session',async()=>{
  const beforeId=process.env.TELEGRAM_API_ID,beforeHash=process.env.TELEGRAM_API_HASH;
  process.env.TELEGRAM_API_ID='12345';process.env.TELEGRAM_API_HASH='fixture';
  try {
    let qr=0;
    const c=fakeClient();
    c.signInUserWithQrCode=async(_credentials,options)=>{await options.qrCode({token:Buffer.from('fixture'),expires:123});return user};
    const result=await beginUserQrAuth({onQr:async()=>{qr++},clientFactory:()=>c});
    assert.equal(qr,1);assert.equal(result.connected,true);assert.equal(result.user.id,'111');
    c.signInUserWithQrCode=async(_credentials,options)=>options.password('fixture hint');
    const password=await beginUserQrAuth({onQr:async()=>{},clientFactory:()=>c});
    assert.equal(password.needsPassword,true);assert.equal(password.session,'test-session');
    c.signInWithPassword=async(_credentials,options)=>{assert.equal(await options.password(),'fixture-secret');return user};
    const done=await verifyUserPassword({session:'fixture'},'fixture-secret',{clientFactory:()=>c});
    assert.equal(done.user.id,'111');assert.equal(done.password,undefined);
  } finally {if(beforeId===undefined)delete process.env.TELEGRAM_API_ID;else process.env.TELEGRAM_API_ID=beforeId;if(beforeHash===undefined)delete process.env.TELEGRAM_API_HASH;else process.env.TELEGRAM_API_HASH=beforeHash;}
});
