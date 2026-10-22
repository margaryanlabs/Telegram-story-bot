import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Enforce operation names and fail-closed routing against original Supabase Edge contract.
const read=p=>readFileSync(p,'utf8');
const old=read('supabase/functions/story-pilot-store/index.ts');
const neon=['lib/neon-store.js','lib/neon-archive-store.js','lib/neon-story-store.js',
  'lib/neon-worker-store.js','lib/neon-media-store.js'].map(read).join('\n');
test('All original Telegram storage operation names have a Neon handler',()=>{
 const operations=[...old.matchAll(/case "([a-z_]+)":/g)].map(match=>match[1]);
 const missing=operations.filter(name=>!neon.includes("'"+name+"'"));
 assert.deepEqual(missing,[]);
 assert.equal(operations.length,56);
});
test('Neon media remains private and each attachment gets an owner-scoped path',()=>{
 const src=read('lib/neon-media-store.js');
 assert.match(src,/BUCKET='veto-private-media'/);
 assert.match(src,/assertPath\(/);
 assert.match(src,/new HeadObjectCommand/);
 assert.match(src,/getSignedUrl\(/);
});
test('Neon scheduled jobs stay disabled until launch gates pass',()=>{
 const src=read('functions/vetoneoncron/index.mjs');
 assert.match(src,/VETO_NEON_CRON_ENABLED/);
 assert.match(src,/x-neon-trigger-invocation-id/);
 assert.match(src,/VETO_NEON_CRON_SECRET/);
});
test('No implicit switch back to a different private database on an error',()=>{
 const src=read('lib/viewer-sync-store.js');
 assert.match(src,/selectedStorageProvider\(\) === 'neon'/);
 assert.match(src,/return neonStoreOperation\(op, args\)/);
 assert.match(src,/NEON_PRIVATE_STORAGE_NOT_CONFIGURED/);
});
