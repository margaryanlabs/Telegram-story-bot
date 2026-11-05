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

test('QR FLOOD_WAIT disables retry until its server-provided countdown expires',()=>{
  const app=read('public/app.js');
  const start=app.indexOf('  function updateViewerQr(event) {');
  const end=app.indexOf('  async function startViewerQrLogin()',start);
  assert.ok(start>=0&&end>start);
  const source=app.slice(start,end);
  const elements=new Map([
    ['sheet',{hidden:false}],['viewerQrStatus',{textContent:''}],
    ['viewerQrMeta',{textContent:''}],
    ['viewerQrOpenButton',{disabled:false,textContent:'',dataset:{qrUri:'secret'}}],
  ]);
  let now=1000,interval=null;
  const fakeDate={now:()=>now};
  const factory=new Function('$','tg','setInterval','clearInterval','Date','haptic',
    'let viewerQrRetryTimer=null;let viewerOwnerEpoch=1;'+source+'return updateViewerQr;');
  const update=factory(id=>elements.get(id),{initData:'signed-owner'},
    fn=>{interval=fn;return 1;},()=>{},fakeDate,()=>{});
  update({type:'error',error:'Подожди',retryAfterSeconds:3});
  const button=elements.get('viewerQrOpenButton');
  assert.equal(button.disabled,true);
  assert.match(button.textContent,/Повтор через 3 с/);
  assert.equal(button.dataset.qrUri,undefined);
  now+=3000;interval();
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Повторить QR');
});

test('QR cooldown cannot re-enable an old owner button after a Telegram account switch',()=>{
  const app=read('public/app.js');
  const start=app.indexOf('  function updateViewerQr(event) {');
  const end=app.indexOf('  async function startViewerQrLogin()',start);
  const source=app.slice(start,end);
  const tg={initData:'owner-A'};
  const elements=new Map([
    ['sheet',{hidden:false}],['viewerQrStatus',{}],
    ['viewerQrMeta',{}],['viewerQrOpenButton',{disabled:false,dataset:{}}],
  ]);
  let now=1000,interval=null;
  const update=new Function('$','tg','setInterval','clearInterval','Date','haptic',
    'let viewerQrRetryTimer=null;let viewerOwnerEpoch=1;'+source+'return updateViewerQr;')(
    id=>elements.get(id),tg,fn=>{interval=fn;return 1;},()=>{}, {now:()=>now},()=>{});
  update({type:'error',retryAfterSeconds:3});
  const button=elements.get('viewerQrOpenButton');
  assert.equal(button.disabled,true);
  tg.initData='owner-B';now+=5000;interval();
  assert.equal(button.disabled,true,'old account cooldown must not touch new owner UI');
  assert.match(app,/clearInterval\(viewerQrRetryTimer\);viewerQrRetryTimer=null;/);
});

test('QR connection never reports success or offers Business until owner session is verified',()=>{
  const app=read('public/app.js');
  const start=app.indexOf("          if (event.type === 'connected') {");
  const end=app.indexOf("          if (event.type === 'password_required')",start);
  assert.ok(start>=0&&end>start);
  const connected=app.slice(start,end);
  const verify=connected.indexOf("await refreshViewerSync({ silent: true })");
  const guard=connected.indexOf("viewerState.session?.connected!==true");
  const success=connected.indexOf("showToast('Telegram успешно подключён через QR')");
  const business=connected.indexOf('offerBusinessConsentAfterLogin()');
  assert.ok(verify>=0&&guard>verify&&success>guard&&business>success);
  assert.match(connected,/viewerState\.session\?\.identityMismatch===true/);
  assert.match(connected,/viewerState\.degraded===true/);
  assert.match(connected,/if\(!sameOwner\(\)\)return/);
  assert.match(connected,/не запрашивай новый QR сразу/);
});
