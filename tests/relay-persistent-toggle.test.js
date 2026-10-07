import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Relay ON state persists across Mini App restarts', () => {
  const client = read('public/relay-module.js');

  assert.match(client, /veto-relay-ui-state-v4/);
  assert.match(client, /localStorage\.getItem\(UI_STATE_KEY\)/);
  assert.match(client, /localStorage\.setItem\(UI_STATE_KEY/);
  assert.match(client, /enabled:s\.enabled/);
  assert.match(client, /activatedAt:s\.activatedAt/);
  assert.match(client, /relay:s\.relay/);
});

test('Relay UI exposes a strong connected state and disable control', () => {
  const html = read('public/studio.html');
  const css = read('public/relay-module.css');
  const client = read('public/relay-module.js');

  assert.match(html, /relayGlobalBadge/);
  assert.match(html, /RELAY ON/);
  assert.match(html, /relayDisableButton/);
  assert.match(html, /ПОДКЛЮЧЕНО · VETO RELAY/);
  assert.match(html, /relaySuccessOverlay/);

  assert.match(css, /relay-home-primary\.relay-active/);
  assert.match(css, /relay-status-pill\.connected/);
  assert.match(css, /relay-success-overlay\.show/);

  assert.match(client, /title='ПОДКЛЮЧЕНО · VETO Relay'/);
  assert.match(client, /showSuccessEffect/);
  assert.match(client, /markEnabled/);
});

test('Disable flow opens Telegram official proxy Use Proxy settings and requires confirmation', () => {
  const client = read('public/relay-module.js');

  assert.match(client, /tg:\/\/settings\/data\/proxy\/use-proxy/);
  assert.match(client, /pendingDisable/);
  assert.match(client, /Да, выключен/);
  assert.match(client, /Оставить RELAY ON/);
  assert.match(client, /markDisabledLocal/);
});

test('Relay connected copy remains honest about Telegram being source of truth', () => {
  const html = read('public/studio.html');
  const client = read('public/relay-module.js');

  assert.match(html, /Фактический proxy-status показывает Telegram/);
  assert.match(client, /Telegram продолжает использовать сохранённый proxy после закрытия Mini App/);
});
