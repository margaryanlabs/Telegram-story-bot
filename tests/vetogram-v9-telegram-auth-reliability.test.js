import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyTelegramAuthError,classifyTelegramQrFailure}
  from '../lib/telegram-auth-feedback.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('QR timeout/abort returns expired without disclosing an upstream token',()=>{
  const error=Object.assign(new Error('aborted tg://login?token=DO_NOT_LEAK'),{name:'AbortError'});
  assert.deepEqual(classifyTelegramQrFailure(error),{
    type:'expired',error:'QR-код истёк. Создай новый.'
  });
});

test('QR FLOOD_WAIT is safe and preserves retry metadata',()=>{
  const event=classifyTelegramQrFailure(new Error('FLOOD_WAIT_181 token=DO_NOT_LEAK'));
  assert.equal(event.type,'error');
  assert.equal(event.retryAfterSeconds,181);
  assert.match(event.error,/Telegram ограничил/);
  assert.doesNotMatch(JSON.stringify(event),/DO_NOT_LEAK|token=/);
});

test('QR API key and arbitrary RPC errors never leak raw descriptions',()=>{
  for(const upstream of [
    'API_ID_INVALID private_hash=DO_NOT_LEAK',
    'AUTH_KEY_UNREGISTERED session=DO_NOT_LEAK',
    'RPC_ERROR account=DO_NOT_LEAK',
    'ETIMEDOUT phone=DO_NOT_LEAK'
  ]){
    const event=classifyTelegramQrFailure(new Error(upstream));
    assert.equal(event.type,'error');
    assert.doesNotMatch(JSON.stringify(event),/DO_NOT_LEAK|private_hash|phone=|session=/);
  }
});

test('ambiguous phone-code outcome asks to wait rather than re-request immediately',()=>{
  const safe=classifyTelegramAuthError(new Error('AUTH_DELIVERY_UNCERTAIN'));
  assert.equal(safe.status,503);
  assert.equal(safe.retryAfterSeconds,180);
  assert.match(safe.message,/Не запрашивай второй код сразу/);
  assert.match(safe.message,/официальный чат Telegram/);
});

test('QR streaming handler uses only sanitized events and never logs raw RPC messages',()=>{
  const qr=read('api/viewer-qr.js');
  assert.match(qr,/const event=classifyTelegramQrFailure\(error\)/);
  assert.match(qr,/send\(event\)/);
  assert.doesNotMatch(qr,/error:\s*description/);
  assert.doesNotMatch(qr,/session\.created event skipped', error\?\.message/);
  assert.doesNotMatch(qr,/console\.(?:warn|error)\([^\n]*error\?\.message/);
});

test('send_code and resend_code retain lease and fail closed on unknown delivery',()=>{
  const api=read('api/viewer-sync.js');
  assert.equal(api.split('const deliveryUncertain=').length-1,2);
  assert.equal(api.split("throw new Error('AUTH_DELIVERY_UNCERTAIN')").length-1,2);
  assert.equal(api.split('await deferLoginCodeLease(userId,leaseToken,feedback.retryAfterSeconds || 180)').length-1,2);
  assert.equal(api.split('telegramSendMayHaveOccurred && feedback.status>=500').length-1,2);
  assert.match(api,/inFlightLoginCodeOwners\.has\(codeOwner\)/);
  assert.match(api,/if \(leaseToken && !telegramSendMayHaveOccurred\)/);
  assert.match(api,/if \(leaseToken && !telegramSendMayHaveOccurred\) await releaseLoginCodeLease/);
});

test('Business and account ownership still require explicit consent and exact owner',()=>{
  const business=read('api/business-wizard.js');
  const qr=read('api/viewer-qr.js');
  const login=read('api/viewer-sync.js');
  assert.match(business,/body\.consent !== true/);
  assert.match(business,/verifyConsentSnapshot/);
  assert.match(business,/withBusinessWriteLock/);
  assert.match(qr,/requireOwnTelegramAccount\(userId, result\.user\)/);
  assert.match(login,/requireOwnTelegramAccount\(userId, result\.user\)/);
});
