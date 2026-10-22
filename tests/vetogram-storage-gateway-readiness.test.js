import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const backend = read('api/viewer-sync.js');
const frontend = read('public/app.js');

function runtime(health, { credentials = true, storeConfigured = true } = {}) {
  const start = backend.indexOf('async function configState()');
  const end = backend.indexOf('\nfunction safeSession(', start);
  assert.ok(start >= 0 && end > start, 'configState must remain inspectable');
  const fn = runInNewContext(backend.slice(start, end) + '\nconfigState;', {
    viewerDbConfigured: () => storeConfigured,
    viewerCryptoHealth: async () => health(),
    selectedStorageProvider: () => 'supabase',
    process: {env:credentials ? {
      TELEGRAM_API_ID:'fixture-id',
      TELEGRAM_API_HASH:'fixture-hash',
      TELEGRAM_BOT_TOKEN:'fixture-token',
    }:{}},
  });
  return fn();
}

test('unavailable storage gateway never masquerades as expired or missing Telegram user session', async () => {
  const config = await runtime(() => {throw new Error('Supabase gateway unavailable')});
  assert.equal(config.storageStatus, 'unavailable');
  assert.equal(config.configured, true);
  assert.equal(config.backgroundReady, false);
  assert.equal(config.newConnectionsReady, false);
  assert.equal(config.secureSessionCrypto, false);
  assert.ok(config.missing.includes('STORAGE_GATEWAY_UNAVAILABLE'));
  assert.ok(!config.missing.includes('PRIVATE_SESSION_CRYPTO'));
  assert.match(backend, /Сохранённая Telegram-сессия не удалена/);
  assert.match(frontend, /Сервер архива и сессий не отвечает/);
  assert.match(frontend, /не запрашивай новый код/);
});

test('reachable storage with missing v3 crypto reports the actual key-readiness problem', async () => {
  const config = await runtime(() => ({ready:false,version:'v2'}));
  assert.equal(config.storageStatus, 'reachable');
  assert.equal(config.backgroundReady, true);
  assert.equal(config.newConnectionsReady, false);
  assert.ok(config.missing.includes('PRIVATE_SESSION_CRYPTO'));
  assert.ok(!config.missing.includes('STORAGE_GATEWAY_UNAVAILABLE'));
});

test('v3-ready storage allows safe connection and background readiness', async () => {
  const config = await runtime(() => ({ready:true,version:'v3'}));
  assert.equal(config.storageStatus, 'reachable');
  assert.equal(config.backgroundReady, true);
  assert.equal(config.newConnectionsReady, true);
  assert.deepEqual(Array.from(config.missing), []);
});

test('missing server credentials does not call a remote store and stays unconfigured', async () => {
  const config = await runtime(() => {throw new Error('should not be called')},{credentials:false});
  assert.equal(config.storageStatus, 'not-configured');
  assert.equal(config.configured, false);
  assert.equal(config.newConnectionsReady, false);
});
