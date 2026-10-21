import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTelegramPhone } from '../lib/telegram-phone.js';

const file = relative => readFileSync(new URL('../'+relative, import.meta.url),'utf8');

test('valid international numbers are accepted, including phone input separators', () => {
  assert.equal(normalizeTelegramPhone('+37499123456'), '+37499123456');
  assert.equal(normalizeTelegramPhone('+1 (415) 555-2671'), '+14155552671');
  assert.equal(normalizeTelegramPhone(' +44 20 7946 0958 '), '+442079460958');
});
test('unsafe or malformed Telegram phone strings are rejected', () => {
  for (const invalid of ['37499123456','++37499123456','+1 2','+0123456789','+374 99 abc 123','+1;DROP','+374\u200d99123456','','  ']) {
    assert.equal(normalizeTelegramPhone(invalid), null, invalid);
  }
});
test('Telegram send_code uses the validated normalized phone, not a double escaped regex', () => {
  const source=file('api/viewer-sync.js');
  assert.match(source,/normalizeTelegramPhone\(body\.phone\)/);
  assert.match(source,/beginUserAuth\(requestedPhone\)/);
  assert.doesNotMatch(source,/requestedPhone = String\(body\.phone/);
});
test('customer instructions no longer refer to legacy Storypilotlab bot', () => {
  for(const name of ['public/studio.html','public/app.js','public/privacy.js','api/webhook-v7.js']){
    assert.equal(file(name).includes('@Storypilotlab_bot'),false,name);
  }
  const bot=file('api/webhook-v7.js');
  assert.match(bot, /🚀 Открыть VETO/);
  assert.match(bot, /@vetotg_bot/);
});
test('Stories read handler uses no explicit read/view increment RPC, UI does not guarantee anonymity', () => {
  const server=file('api/telegram-stories.js');
  const ui=file('public/telegram-stories.js');
  assert.match(server,/GetAllStories/);
  assert.match(server,/GetStoriesByID/);
  assert.doesNotMatch(server,/new Api\.stories\.(?:ReadStories|IncrementStoryViews)/);
  assert.match(ui,/анонимность не гарантирована/);
});
