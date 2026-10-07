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
  assert.match(client,/Telegram заработал\?/);
  assert.match(client,/Да, Telegram работает/);
  assert.match(client,/Нет, всё ещё крутится/);
});

test('failed client route is excluded before automatic retry',()=>{
  const client=read('public/relay-module.js');
  assert.match(client,/failedIds/);
  assert.match(client,/rejectPendingRelay/);
  assert.match(client,/exclude:excluded/);
  assert.match(client,/Переключаю на запасной/);
});
