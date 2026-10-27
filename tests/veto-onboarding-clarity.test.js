import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('first-run onboarding explains product, functions and two-step activation', () => {
  const html = read('public/studio.html');

  assert.match(html, /<h1 class="v5-welcome-title"><span class="v5-welcome-veto">VETO<\/span>/);
  assert.match(html, /class="veto-brand-reveal-wordmark" aria-label="VETOGRAM"/);
  assert.match(html, /id="vetoWelcomeExplore"/);
  assert.match(html, /id="vetoWelcomeNext"/);
  assert.match(html, /Семь функций/);
  assert.match(html, /Relay/);
  assert.match(html, /нужны 2 шага/);
  assert.match(html, /Подключи Telegram/);
  assert.match(html, /Опубликуй тестовую историю/);
  assert.match(html, /id="activationScore">0\/2/);
});

test('home feature cards explain value before opening advanced surfaces', () => {
  const html = read('public/studio.html');
  const app = read('public/app.js');
  const relay = read('public/relay-module.js');

  for (const key of ['stories','intelligence','privacy','studio','security','relay','automations']) {
    assert.match(html, new RegExp('data-feature-help="' + key + '"'));
  }
  assert.match(app, /function featureGuideSheet/);
  assert.match(app, /Зачем/);
  assert.match(app, /Что нужно/);
  assert.match(app, /function allFeaturesSheet/);
  assert.match(relay, /ЗАЩИТА TELEGRAM/);
  assert.match(relay, /VETO сам выбирает рабочий путь только для Telegram/);
});

test('connection wizard recommends phone plus code on the current phone', () => {
  const app = read('public/app.js');

  assert.match(app, /Я на этом телефоне/);
  assert.match(app, /номер \+ код/);
  assert.match(app, /У меня есть второй экран/);
  assert.match(app, /Telegram → Настройки → Устройства/);
  assert.match(app, /Код Telegram и 2FA‑пароль не сохраняются/);
});

test('Privacy is explicitly optional and separate from normal Story setup', () => {
  const html = read('public/studio.html');
  const app = read('public/app.js');

  assert.match(html, /Privacy/);
  assert.match(html, /Необязательно/);
  assert.match(app, /доступ к сообщениям не включается автоматически/);
  assert.match(app, /Живые чаты, Story Studio и AI без Telegram Business-бота/);
});
