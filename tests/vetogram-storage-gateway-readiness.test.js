import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const backend = read('api/viewer-sync.js');
const frontend = read('public/app.js');

function runtime(health, { credentials = true, storeConfigured = true, provider = 'supabase' } = {}) {
  const start = backend.indexOf('async function configState()');
  const end = backend.indexOf('\nfunction safeSession(', start);
  assert.ok(start >= 0 && end > start, 'configState must remain inspectable');
  const fn = runInNewContext(backend.slice(start, end) + '\nconfigState;', {
    viewerDbConfigured: () => storeConfigured,
    viewerCryptoHealth: async () => health(),
    selectedStorageProvider: () => provider,
    expectedCipherVersion: () => provider === 'neon' ? 'v4' : 'v3',
    sessionCryptoReady: detail => detail?.ready === true
      && (detail?.cipherVersion || detail?.version) === (provider === 'neon' ? 'v4' : 'v3'),
    neonCronConfigured: () => false,
    loginCodeLeaseReady: async () => true,
    process: {env:credentials ? {
      TELEGRAM_API_ID:'fixture-id',
      TELEGRAM_API_HASH:'fixture-hash',
      TELEGRAM_BOT_TOKEN:'fixture-token',
      ...(provider === 'neon' && storeConfigured ? {
        VETO_NEON_DATABASE_URL:'fixture-only-never-contacted',
        VETO_NEON_SESSION_KEY:'fixture-only-never-contacted',
      } : {}),
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

test('existing Neon v4 encryption is recognized only when v4 crypto is actually verified', async () => {
  const valid=await runtime(()=>({ready:true,version:'v4',cipherVersion:'v4'}),{provider:'neon'});
  assert.equal(valid.configured,true);
  assert.equal(valid.secureSessionCrypto,true);
  assert.equal(valid.newConnectionsReady,true);
  assert.equal(valid.backgroundReady,false,'Neon cron must remain gated off until reviewed');
  assert.equal(valid.cipherVersion,'v4');
  const wrong=await runtime(()=>({ready:true,version:'v3'}),{provider:'neon'});
  assert.equal(wrong.newConnectionsReady,false);
});
test('unverified Neon v4 key prevents owner session activation without modifying ciphertext', async () => {
  const config=await runtime(()=>({ready:false,version:'v4',cipherVersion:'v4',reason:'NEON_SESSION_KEY_MISMATCH'}),{provider:'neon'});
  assert.equal(config.storageStatus,'reachable');
  assert.equal(config.newConnectionsReady,false);
  assert.ok(config.missing.includes('PRIVATE_SESSION_CRYPTO'));
});

test('QR and phone share the exact v4/v3 readiness requirement', async () => {
  const provider = await import('../lib/storage-provider.js');
  assert.equal(provider.sessionCryptoReady({ready:true,version:'v4',cipherVersion:'v4'},'neon'),true);
  assert.equal(provider.sessionCryptoReady({ready:true,version:'v3'},'neon'),false);
  assert.equal(provider.sessionCryptoReady({ready:true,version:'v3'},'supabase'),true);
  assert.equal(provider.sessionCryptoReady({ready:false,version:'v4'},'neon'),false);
  assert.match(read('api/viewer-qr.js'),/sessionCryptoReady\(cryptoHealth\)/);
});
test('new phone-code and 2FA events use the sealed session cipher not literal v3',()=>{
  assert.match(backend,/crypto: sealedSession\.split\('\.'\)\[0\]/);
  assert.match(backend,/crypto: sealed2faSession\.split\('\.'\)\[0\]/);
});

test('Neon missing encryption key is separate from SQL outage', async () => {
  const config=await runtime(()=>{
    throw new Error('PRIVATE_SESSION_CRYPTO_UNAVAILABLE');
  }, {provider:'neon'});
  assert.equal(config.storageStatus,'reachable');
  assert.equal(config.secureSessionCrypto,false);
  assert.equal(config.newConnectionsReady,false);
  assert.ok(config.missing.includes('PRIVATE_SESSION_CRYPTO'));
  assert.ok(!config.missing.includes('STORAGE_GATEWAY_UNAVAILABLE'));
});
test('Neon unreachable SQL still reports server outage without prompting session deletion', async () => {
  const config=await runtime(()=>{
    throw new Error('fetch failed');
  }, {provider:'neon'});
  assert.equal(config.storageStatus,'unavailable');
  assert.ok(config.missing.includes('STORAGE_GATEWAY_UNAVAILABLE'));
  assert.ok(!config.missing.includes('PRIVATE_SESSION_CRYPTO'));
});

test('Neon cron configured flag is reflected in both health routes without claiming live delivery',()=>{
  assert.match(read('api/health.js'),/sessionCryptoReady\(secureCrypto\)/);
  assert.doesNotMatch(read('api/health.js'),/secureCrypto\?\.version\s*===\s*'v3'/);
  assert.match(read('api/health.js'),/neon-configured-not-live-verified/);
  assert.match(backend,/neonCronConfigured\(\)/);
});

test('Neon preview missing credentials reports the exact server settings and never forces Telegram re-login', async () => {
  const config=await runtime(()=>{throw Error('must not call storage')},{provider:'neon',storeConfigured:false});
  assert.equal(config.storageStatus,'not-configured');
  assert.equal(config.newConnectionsReady,false);
  assert.ok(config.missing.includes('VETO_NEON_DATABASE_URL'));
  assert.ok(config.missing.includes('VETO_NEON_SESSION_KEY'));
  assert.ok(!config.missing.includes('TELEGRAM_API_ID'));
});
