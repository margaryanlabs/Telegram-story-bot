import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function alertHarness() {
  const webhook = readFileSync(new URL('../api/webhook-v7.js', import.meta.url), 'utf8');
  const start = webhook.indexOf('async function sendGhostDeleteAlert(');
  const end = webhook.indexOf('async function sendGhostEditAlert(', start);
  assert.ok(start >= 0 && end > start, 'delete alert function exists');
  const calls = [];
  const sandbox = {
    tg: async (_token, method, body) => { calls.push({ method, body }); return {}; },
    ghostAppUrl: (origin, options) => origin + '/studio.html?' + new URLSearchParams(options).toString(),
    URLSearchParams,
  };
  runInNewContext(webhook.slice(start, end) + '\nthis.sendAlert = sendGhostDeleteAlert;', sandbox);
  return { sendAlert: sandbox.sendAlert, calls };
}

test('saved outgoing audio deletion has a real Vault copy and a focus button', async () => {
  const { sendAlert, calls } = alertHarness();
  const ok = await sendAlert('token', 'owner', 'https://veto.example', [{
    chatId: 'chat-1',
    messageId: 123,
    direction: 'outgoing',
    sender: 'Owner',
    preview: '[audio]',
  }], { ghostFocus: true }, [], 1);

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  const alert = calls[0].body;
  assert.match(alert.text, /Вы: \[audio\]/);
  assert.match(alert.text, /Копия доступных сообщений сохранена в VETO Vault/);
  assert.doesNotMatch(alert.text, /нет ранее сохранённой копии/);
  assert.match(alert.reply_markup.inline_keyboard[0][0].web_app.url, /chat=chat-1/);
  assert.match(alert.reply_markup.inline_keyboard[0][0].web_app.url, /messageId=123|message=123/);
});

test('real missing archives still say copy unavailable and expose no fake focus', async () => {
  const { sendAlert, calls } = alertHarness();
  await sendAlert('token', 'owner', 'https://veto.example', [], { ghostFocus: true }, [], 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.text, /нет ранее сохранённой копии/);
  assert.equal(calls[0].body.reply_markup.inline_keyboard.length, 1);
  assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].text, '↶ Все удалённые');
});

test('mixed directions count archived copies correctly without hiding sent rows', async () => {
  const { sendAlert, calls } = alertHarness();
  await sendAlert('token', 'owner', 'https://veto.example', [
    { chatId: 'c', messageId: 1, direction: 'outgoing', preview: 'Sent' },
    { chatId: 'c', messageId: 2, direction: 'incoming', sender: 'A', preview: 'Received' },
  ], {}, [], 3);
  const message = calls[0].body.text;
  assert.match(message, /Вы: Sent/);
  assert.match(message, /A: Received/);
  assert.match(message, /Ещё 1 удалённых сообщений/);
  assert.match(message, /Копия доступных сообщений сохранена/);
});
