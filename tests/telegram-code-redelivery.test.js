import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  codeDeliveryChannel,
  codeStateFromSent,
  codeResendWindow,
  safeCodeStatus,
} from '../lib/telegram-code-delivery.js';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('MTProto metadata preserves Telegram-chosen app-to-SMS transition, not a delivery guarantee', () => {
  const sent = {
    type: { className: 'auth.SentCodeTypeApp' },
    nextType: { className: 'auth.CodeTypeSms' },
    phoneCodeHash: 'PRIVATE_HASH',
    timeout: 90,
  };
  const challenge = codeStateFromSent(sent, {}, 1_000_000);
  assert.equal(challenge.delivery, 'telegram_app');
  assert.equal(challenge.nextDelivery, 'sms');
  assert.equal(challenge.resendAt, new Date(1_090_000).toISOString());
  assert.equal(challenge.retryCount, 0);
  assert.deepEqual(codeResendWindow(challenge, 1_000_000), { allowed: false, retryAfterSeconds: 90 });
  assert.deepEqual(codeResendWindow(challenge, 1_090_000), { allowed: true, retryAfterSeconds: 0 });
  const safe = safeCodeStatus({ ...challenge, phone: '+37400000000', session: 'PRIVATE_SESSION' }, '2030-01-01T00:00:00.000Z');
  assert.equal(safe.delivery, 'telegram_app');
  assert.equal(safe.nextDelivery, 'sms');
  assert.ok(!('phone' in safe) && !('session' in safe) && !('phoneCodeHash' in safe));
  assert.ok(!JSON.stringify(safe).includes('PRIVATE'));
  assert.ok(!JSON.stringify(safe).includes('+374'));
});

test('Unknown channels never masquerade as SMS, and Telegram can prohibit retries', () => {
  assert.equal(codeDeliveryChannel({ className: 'auth.SentCodeTypeUnknown' }), null);
  assert.equal(codeStateFromSent({ phoneCodeHash: 'hash', type: {} }).delivery, 'other');
  assert.deepEqual(codeResendWindow({ nextDelivery: null }), { allowed: false, retryAfterSeconds: null });
  const locked = codeStateFromSent({
    phoneCodeHash: 'last',
    type: { className: 'auth.SentCodeTypeSms' },
    nextType: { className: 'auth.CodeTypeCall' },
    timeout: 30,
  }, { retryCount: 2 }, 1234);
  assert.equal(locked.nextDelivery, null);
  assert.equal(locked.resendAt, null);
  assert.equal(locked.retryCount, 2);
});

test('Production API uses authenticated encrypted challenge for ResendCode and never returns its raw state', () => {
  const api = source('api/viewer-sync.js');
  const transport = source('lib/viewer-sync-telegram.js');
  const qr = source('api/viewer-qr.js');
  assert.ok(api.includes("if (action === 'resend_code')"));
  assert.ok(api.includes('codeResendWindow(saved)'));
  assert.ok(api.includes('await sealJson(renewed'));
  assert.ok(api.includes('safeCodeStatus(renewed, nextExpiry)'));
  assert.ok(api.includes("if (loginPending?.stage === 'code')"));
  assert.ok(transport.includes('new Api.auth.SendCode({'));
  assert.ok(transport.includes('new Api.auth.ResendCode({'));
  assert.ok(transport.includes('newClient(authState.session)'));
  assert.ok(transport.includes('phoneCodeHash: authState.phoneCodeHash'));
  assert.ok(!qr.includes("await deleteAuthChallenge(userId).catch(() => {});\n\n  noStore(res);"));
  assert.ok(qr.includes("await deleteAuthChallenge(userId).catch(() => {});"));
});

test('Mini App has real channel labels, timer, retry and QR fallback, without showing secrets', () => {
  const app = source('public/app.js');
  for (const piece of [
    'rememberViewerCodeChallenge(data)',
    'refreshViewerCodeTimer()',
    'data-viewer-countdown',
    'viewerResendButton',
    "viewerApi('resend_code', {}, null)",
    "action === 'viewer-code-diagnostics'",
    'Реальная доставка',
    'Войти через QR',
  ]) assert.ok(app.includes(piece), 'Missing auth UI: ' + piece);
});

test('Phone numbers retain country code and digits; malformed regex regression is blocked', () => {
  const api = source('api/viewer-sync.js');
  assert.ok(api.includes(String.raw`replace(/[^+\d]/g, '')`));
  assert.ok(api.includes(String.raw`/^\+\d{7,15}$/.test(requestedPhone)`));
  const normalized = '+374 (91) 123-456'.replace(/[^+\d]/g, '');
  assert.equal(normalized, '+37491123456');
  assert.equal(/^\+\d{7,15}$/.test(normalized), true);
});
