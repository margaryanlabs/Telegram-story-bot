import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedStorageProvider } from '../lib/storage-provider.js';
import { neonStoreOperation } from '../lib/neon-store.js';
import { sealNeonJson, openNeonJson } from '../lib/neon-private-crypto.js';

// Vercel branch-scoped preview env exercises real Neon HTTP SQL during the build.
// It reads only; no real Telegram owner session or private content is created.
test('Neon staging environment is truly reachable and can seal sessions', {
  skip: selectedStorageProvider() !== 'neon' ? 'Supabase default, no Neon staging env' : false,
}, async () => {
  const health=await neonStoreOperation('health');
  assert.equal(health.storage,'ok');
  assert.equal(health.backend,'neon');
  assert.ok(health.schemaVersion >= 1);
  const crypto=await neonStoreOperation('viewer_crypto_health',{environment:'preview'});
  assert.equal(crypto.ready,true);
  assert.equal(crypto.cipherVersion,'v4');
  const probe={session:'no-real-telegram-data'};
  assert.deepEqual(openNeonJson(sealNeonJson(probe,'healthcheck:0'),'healthcheck:0'),probe);
  const record=await neonStoreOperation('get_session',{userId:'0'});
  assert.equal(record,null);
});
