import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('One Telegram code challenge is reused until expiry instead of sending another code', () => {
  const api = read('api/viewer-sync.js');
  const send = api.split("if (action === 'send_code')")[1].split("if (action === 'verify_code')")[0];
  assert.match(send, /existing && Number\.isFinite\(expiresAt\) && expiresAt > Date\.now\(\)/);
  assert.match(send, /pending\?\.phone === requestedPhone/);
  assert.match(send, /reused: true/);
  assert.ok(send.indexOf('reused: true') < send.indexOf('beginUserAuth(requestedPhone)'));
  assert.ok(send.indexOf('config.newConnectionsReady !== true') < send.indexOf('beginUserAuth(requestedPhone)'));
  assert.ok(send.indexOf('getViewerSession(userId)') < send.indexOf('beginUserAuth(requestedPhone)'));
  assert.ok(api.includes("action === 'cancel_login'"), 'Only explicit cancellation invalidates pending login');
  assert.ok(!send.includes('await deleteAuthChallenge(userId)'));
});

test('Login UX points to official Telegram chat, provides recovery and does not auto-resend', () => {
  const app = read('public/app.js');
  assert.match(app, /официальном чате «Telegram»/);
  assert.ok(app.includes("viewerCodeSheet(data.delivery, data.reused === true)"));
  for (const action of ["viewer-code-help", "viewer-back-code", "viewer-cancel-login", "viewer-start-qr"]) {
    assert.ok(app.includes('data-sheet-action="' + action + '"'), 'Missing login recovery action: ' + action);
  }
  assert.ok(app.includes("viewerApi('cancel_login', {}, null)"));
});

test('Private message archive keeps deleted-at tombstones on retry and writes event vault via fallback', () => {
  const store = read('supabase/functions/story-pilot-store/index.ts');
  const capture = store.split('async function opCaptureBusinessMessage')[1].split('async function opMarkBusinessMessagesDeleted')[0];
  assert.ok(!capture.includes('deleted_at: null,'));
  assert.match(capture, /on conflict \(telegram_user_id, chat_id, message_id\) do update set/);
  assert.ok(!capture.split('on conflict (telegram_user_id, chat_id, message_id) do update set')[1].split('if (settings.editHistory)')[0].includes('deleted_at ='));
  const eventWrite = store.split('async function recordEvent')[1].split('function eventRetention')[0];
  assert.ok(eventWrite.includes('if (useDirectSql())'));
  assert.ok(eventWrite.includes('openDirectSqlCircuit(error)'));
  assert.ok(eventWrite.includes('.from("story_pilot_events")'));
  assert.ok(eventWrite.includes('onConflict: "telegram_user_id,dedupe_key"'));
});

test('Webhook refuses to acknowledge missing saved or deleted messages so Telegram can retry', () => {
  const webhook = read('api/webhook-v7.js');
  assert.match(webhook, /res\.status\(503\)\.json\(\{ ok: false, error: 'privacy_message_archive_unavailable'/);
  assert.match(webhook, /res\.status\(503\)\.json\(\{ ok: false, error: 'privacy_delete_archive_unavailable'/);
});
