import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyTelegramAuthError } from '../lib/telegram-auth-feedback.js';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Privacy shortcuts navigate to actual Chats secondary screen', () => {
  const app = read('public/app.js');
  const privacy = read('public/privacy.js');
  const html = read('public/studio.html');
  assert.match(app, /window\.VetoTelegramNavigate = switchScreen/);
  assert.match(app, /chats:'privacy'/);
  assert.match(html, /data-screen="chats"/);
  assert.match(privacy, /VetoTelegramNavigate\?\.\('chats'\)/);
  assert.doesNotMatch(privacy, /\[data-nav="chats"\]/);
});

test('Account Link becomes Story-ready without Telegram Business rights', () => {
  const api = read('api/miniapp.js');
  assert.match(api, /refreshed\.rights \|\| refreshed\.settings\.userSessionConnected/);
  assert.match(read('public/app.js'), /Telegram успешно подключён/);
});

test('Telegram authorization errors are safe and actionable', () => {
  assert.deepEqual(classifyTelegramAuthError(new Error('PHONE_CODE_INVALID')), {
    status: 400, message: 'Код неверный. Введи последний код из официального Telegram.',
  });
  assert.equal(classifyTelegramAuthError(new Error('FLOOD_WAIT_181')).status, 429);
  assert.equal(classifyTelegramAuthError(new Error('FLOOD_WAIT_181')).retryAfterSeconds, 181);
  assert.equal(classifyTelegramAuthError(new Error('PHONE_CODE_EXPIRED')).status, 410);
  assert.equal(classifyTelegramAuthError(new Error('PASSWORD_HASH_INVALID')).status, 400);
  assert.equal(classifyTelegramAuthError(new Error('internal: sensitive bearer secrets')).message.includes('secrets'), false);
});

test('Mini App provides inline recovery from phone, code, and 2FA errors', () => {
  const app = read('public/app.js');
  assert.match(app, /function runViewerAuthAction/);
  assert.match(app, /id="viewerAuthError"/);
  assert.match(app, /data-sheet-action="viewer-code-help">Код не пришёл/);
  assert.match(app, /data-sheet-action="viewer-cancel-login">Отменить запрос и сменить номер/);
  assert.match(app, /await viewerApi\('cancel_login', \{\}, null\)/);
  assert.match(app, /const uri = actionTarget\?\.dataset\?\.qrUri/);
});
