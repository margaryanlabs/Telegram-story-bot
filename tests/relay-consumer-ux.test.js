import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function read(path){return readFileSync(new URL('../'+path,import.meta.url),'utf8');}

test('consumer Relay hides technical jargon behind advanced settings',()=>{
  const html=read('public/studio.html');
  assert.match(html,/Защитить Telegram/);
  assert.match(html,/TELEGRAM PROTECTED/);
  assert.match(html,/Расширенные настройки/);
  assert.match(html,/Аварийный доступ/);
  assert.match(html,/Отключить защиту/);
  const hero=html.slice(html.indexOf('relay-consumer-hero'),html.indexOf('relay-advanced'));
  assert.doesNotMatch(hero,/MTProxy|Route Intelligence|secret|port/i);
});

test('consumer disable flow uses simple manual steps',()=>{
  const client=read('public/relay-module.js');
  assert.match(client,/3 простых шага/);
  assert.match(client,/Данные и память/);
  assert.match(client,/Настройки прокси/);
  assert.match(client,/Я выключил/);
  assert.match(client,/Попробовать открыть настройки Telegram/);
});

test('active Relay health can trigger automatic fallback',()=>{
  const api=read('api/relay.js');
  const client=read('public/relay-module.js');
  assert.match(api,/action === 'health'/);
  assert.match(api,/shouldFailover/);
  assert.match(client,/healthCheck/);
  assert.match(client,/Связь ухудшилась\. Переключаю на запасной путь/);
  assert.match(client,/connect\(true,\{failover:true\}\)/);
});

test('consumer Relay persists protected state',()=>{
  const client=read('public/relay-module.js');
  assert.match(client,/veto-connect-ui-state-v5/);
  assert.match(client,/localStorage\.setItem/);
  assert.match(client,/TELEGRAM PROTECTED/);
});

test('Relay never claims protected before client confirms Telegram works',()=>{
  const client=read('public/relay-module.js');
  const openRoute=client.slice(client.indexOf('function openRoute'),client.indexOf('async function connect'));
  assert.match(openRoute,/markPending/);
  assert.doesNotMatch(openRoute,/markEnabled/);
  assert.match(client,/pendingRelay/);
  const html=read('public/studio.html');
  assert.match(html,/Telegram заработал\?/);
  assert.match(html,/Да, работает/);
  assert.match(html,/Нет, не работает/);
});

test('failed client route is excluded before automatic retry',()=>{
  const client=read('public/relay-module.js');
  assert.match(client,/failedIds/);
  assert.match(client,/rejectPendingRelay/);
  assert.match(client,/exclude:excluded/);
  assert.match(client,/Переключаю на запасной/);
});


test('Relay activation never auto-opens a confirmation popup',()=>{
  const html=read('public/studio.html');
  const client=read('public/relay-module.js');

  assert.match(html,/relayPendingConfirm/);
  assert.match(html,/Telegram заработал\?/);
  assert.match(html,/Да, работает/);
  assert.match(html,/Нет, не работает/);

  assert.doesNotMatch(client,/function openRelayConfirmation/);
  assert.doesNotMatch(client,/setTimeout\(openRelayConfirmation/);
  assert.doesNotMatch(client,/pendingRelay\?openRelayConfirmation/);
});

test('disable confirmation is only attached to explicit disable flow',()=>{
  const client=read('public/relay-module.js');
  assert.match(client,/function openDisableGuide/);
  assert.match(client,/relayDisableButton'\)\?\.addEventListener\('click',openDisableGuide\)/);
  assert.match(client,/Я выключил/);
});


test('Relay handoff prefers official t.me proxy link over raw tg scheme',()=>{
  const client=read('public/relay-module.js');
  const openRoute=client.slice(client.indexOf('function openRoute'),client.indexOf('async function connect'));
  assert.match(openRoute,/const httpsUrl=data\?\.connectUrl/);
  assert.match(openRoute,/const tgUrl=data\?\.tgUrl/);
  assert.match(openRoute,/openTelegramLink\(httpsUrl,tgUrl\)/);
  assert.match(client,/\^https:\\\/\\\/t\\\.me\\\//);
});

test('pending Relay state can retry Telegram handoff instead of trapping the user',()=>{
  const client=read('public/relay-module.js');
  const click=client.slice(client.indexOf("$('relayPowerButton')?.addEventListener"),client.indexOf("$('relayPendingYes')?.addEventListener"));
  assert.match(click,/if\(s\.pendingRelay\)/);
  assert.match(click,/s\.pendingRelay=null/);
  assert.match(click,/return connect\(false\)/);
  assert.match(client,/Открыть Telegram ещё раз/);
});
