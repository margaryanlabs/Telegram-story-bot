import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Telegram protection state persists across Mini App restarts', () => {
  const client = read('public/relay-module.js');

  assert.match(client, /veto-connect-ui-state-v5/);
  assert.match(client, /veto-relay-ui-state-v4/);
  assert.match(client, /localStorage\.setItem\(UI_STATE_KEY/);
  assert.match(client, /enabled:s\.enabled/);
  assert.match(client, /activatedAt:s\.activatedAt/);
  assert.match(client, /relay:s\.relay/);
});

test('consumer UI exposes a strong protected state and disable control', () => {
  const html = read('public/studio.html');
  const css = read('public/relay-module.css');
  const client = read('public/relay-module.js');

  assert.match(html, /relayGlobalBadge/);
  assert.match(html, /TELEGRAM PROTECTED/);
  assert.match(html, /relayDisableButton/);
  assert.match(html, /relaySuccessOverlay/);

  assert.match(css, /relay-home-primary\.relay-active/);
  assert.match(css, /relay-status-pill\.connected/);
  assert.match(css, /relay-success-overlay\.show/);

  assert.match(client, /title='TELEGRAM PROTECTED'/);
  assert.match(client, /showSuccessEffect/);
  assert.match(client, /markEnabled/);
});

test('Disable flow uses manual Telegram steps with optional settings shortcut', () => {
  const client = read('public/relay-module.js');

  assert.match(client, /3 простых шага/);
  assert.match(client, /Настройки прокси/);
  assert.match(client, /Я выключил/);
  assert.match(client, /tg:\/\/settings\/data\/proxy/);
  assert.match(client, /markDisabledLocal/);
});

test('connected copy remains honest about Telegram being source of truth', () => {
  const html = read('public/studio.html');

  assert.match(html, /Реальный статус proxy показывает сам Telegram/);
  assert.match(html, /Защита сохранена на этом устройстве/);
});
