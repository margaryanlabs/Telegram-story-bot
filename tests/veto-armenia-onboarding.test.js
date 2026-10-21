import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyTelegramAuthError } from '../lib/telegram-auth-feedback.js';
import { normalizeTelegramPhone } from '../lib/telegram-phone.js';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Armenian +374 mobile numbers pass E.164 validation without false rejects',()=>{
  assert.equal(normalizeTelegramPhone('+374 99 123 456'),'+37499123456');
  assert.equal(normalizeTelegramPhone('+37499123456'),'+37499123456');
});

test('Telegram throttling and third party SMS failures are meaningful and do not imply SMS must arrive',()=>{
  const flood=classifyTelegramAuthError({message:'PHONE_NUMBER_FLOOD'});
  assert.equal(flood.status,429);
  const sms=classifyTelegramAuthError({message:'SMS_CODE_CREATE_FAILED'});
  assert.equal(sms.status,503);
  assert.match(sms.message,/SMS|QR/);
  const update=classifyTelegramAuthError({message:'UPDATE_APP_TO_LOGIN'});
  assert.equal(update.status,409);
});

test('Mini App explains same-account ownership, official Telegram delivery and email possibility',()=>{
 const code=read('public/app.js');
 assert.match(code,/подключение чужих аккаунтов запрещено/);
 assert.match(code,/почту, привязанную к входу/);
 assert.match(code,/Код не приходит/);
 assert.match(code,/Подключить через QR/);
});
test('Business Stories permission is explicit but not required for chat Anti-Delete',()=>{
 const privacy=read('public/privacy.js');
 const app=read('public/app.js');
 const bot=read('api/webhook-v7.js');
 assert.match(privacy,/Управление историями/);
 assert.match(app,/Управление историями/);
 assert.match(bot,/Управление историями/);
 assert.match(bot,/Для Anti-Delete и чтения Stories это необязательно/);
});
