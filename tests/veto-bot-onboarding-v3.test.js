import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('bot offers separate consent journeys, with non-invasive status verification', () => {
  const code = source('api/webhook-v7.js');
  assert.match(code, /🚀 Открыть VETO/);
  assert.match(code, /Мои чаты · подключить/);
  assert.match(code, /Anti-Delete · настроить/);
  assert.match(code, /✅ Проверить Anti-Delete/);
  assert.match(code, /callback_data: 'connect:check'/);
  assert.match(code, /Разрешение «Управление историями» для архива не требуется/);
  assert.match(code, /Чат-боты \/ Автоматизация чатов/);
  assert.doesNotMatch(code,/выключи «Управление историями»/);
});

test('Mini App Business wizard copies correct bot and does not collect Telegram OTP', () => {
  const app = source('public/app.js');
  const wizard = app.split('function businessConnectionHelpSheet()')[1].split('function viewerSetupSheet()')[0];
  assert.match(wizard, /data-sheet-action="business-copy-name"/);
  assert.match(wizard, /@vetotg_bot/);
  assert.match(wizard, /Только выбранные|только те чаты|только нужные личные чаты/);
  assert.doesNotMatch(wizard, /введи код|send_code|verify_code/);
  assert.match(app, /if \(action === 'business-copy-name'\)/);
  assert.match(app, /navigator\.clipboard\.writeText\(botName\)/);
});

test('read-only Stories and phone login do not imply automatic Business permissions', () => {
  const app = source('public/app.js');
  const personal = app.split('function connectionHelpSheet()')[1].split('function businessConnectionHelpSheet()')[0];
  assert.match(personal,/Business отдельно|Business не нужен/);
  assert.match(personal,/номер|QR/);
});
