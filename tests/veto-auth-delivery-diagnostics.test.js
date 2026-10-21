import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = p => readFileSync(new URL('../' + p, import.meta.url),'utf8');

test('phone auth records owner-scoped, secret-free receipt before Neon health preflight', () => {
  const api = load('api/viewer-sync.js');
  const receipt = api.indexOf("'auth.request_received'");
  const config = api.indexOf('const config = await configState()');
  const send = api.indexOf("if (action === 'send_code')");
  assert.ok(receipt > 0 && config > receipt && send > config);
  assert.match(api, /auth\.preflight_blocked/);
  assert.match(api, /errorCode:'STORAGE'/);
  assert.match(api, /auth\.delivery_selected/);
  assert.match(api, /auth\.send_code_failed/);
  assert.match(api, /if \(isPhoneLoginRequest\)/);
});

test('client waits for Telegram MTProto response without automatically resending OTP', () => {
  const app = load('public/app.js');
  assert.match(app, /'send_code','setup_email','verify_email_code'\]\.includes\(action\) \? 45000/);
  const apiStart = app.indexOf('async function viewerApi(');
  const apiEnd = app.indexOf('async function automationsApi(',apiStart);
  const api = app.slice(apiStart,apiEnd);
  assert.match(api,/retry: !action/);
  assert.match(api,/timeoutMs:/);
});

test('login error events contain no phone number or raw Telegram secret', () => {
  const api=load('api/viewer-sync.js');
  const receipt=api.slice(api.indexOf("'auth.request_received'"),api.indexOf('const config = await configState()'));
  assert.doesNotMatch(receipt,/body\.phone|phoneCodeHash|phone_number|password|session_ciphertext|body\.code/);
});
