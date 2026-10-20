import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Bot /start immediately presents two different chat permissions paths', () => {
  const hook = read('api/webhook-v7.js');
  const menu = hook.split('function inlineMenu(')[1].split('function userPicker(')[0];
  const home = hook.split('function homeText(settings)')[1].split('function settingsText(')[0];
  assert.match(menu, /chatPathButtons/);
  assert.match(menu, /🚀 Открыть VETO/);
  assert.match(menu, /Мои чаты · подключить/);
  assert.match(menu, /Anti-Delete · настроить/);
  assert.match(menu, /screen:'telegram'/);
  assert.match(menu, /screen:'privacy'/);
  assert.match(home, /Подключи Telegram по номеру \+ коду/);
  assert.match(home, /Anti-Delete включается отдельно/);
  assert.match(home, /Удаления, произошедшие до подключения, вернуть нельзя/);
  assert.match(hook, /command === '\/start'/);
});

test('App welcome and home show chat vs Anti-Delete decision before Stories activation', () => {
  const html = read('public/studio.html');
  const introPos = html.indexOf('data-veto-start-action="live-chats"');
  const heroPos = html.indexOf('id="vetoChatEntry"');
  const storyActivation = html.indexOf('id="activationCard"');
  assert.ok(introPos > 0);
  assert.ok(heroPos > 0 && heroPos < storyActivation);
  assert.ok((html.match(/data-veto-start-action="live-chats"/g) || []).length >= 2);
  assert.ok((html.match(/data-veto-start-action="archive"/g) || []).length >= 2);
  assert.match(html, /Для выбранного чата доступна и отдельная резервная копия без Business/);
});

test('App first-run actions are navigational only and do not grant archive permission', () => {
  const app = read('public/app.js');
  const handlers = app.split("document.querySelectorAll('[data-veto-start-action]')")[1].split("  $('vetoWelcomeNext')")[0];
  assert.match(handlers, /destination = button.dataset.vetoStartAction === 'archive' \? 'privacy' : 'telegram'/);
  assert.match(handlers, /switchScreen\(destination\)/);
  assert.doesNotMatch(handlers, /update_settings|send_code|business_connection|api\('/);
});
