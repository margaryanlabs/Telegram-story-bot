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
  assert.equal(health.mediaVault,true,'Neon private media bucket must be reachable');
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
  const readOnly=[
    ['get_privacy_settings',{}],['list_privacy_threads',{}],['list_deleted_feed',{}],
    ['get_automation_settings',{}],['list_automation_jobs',{}],['list_backup_jobs',{}],
    ['get_analytics',{}],['get_export',{}],['list_story_archive',{}],['list_stories',{}],
    ['get_business_connection_state',{}],
  ];
  for (const [operation,extra] of readOnly) {
    const response=await neonStoreOperation(operation,{userId:'0',...extra});
    assert.notEqual(response,undefined,'Neon '+operation+' must return a real response');
  }
});
