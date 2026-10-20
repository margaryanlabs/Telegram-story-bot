import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedStorageProvider, neonStorageConfigured } from '../lib/storage-provider.js';
import { neonCipherReady, sealNeonJson, openNeonJson } from '../lib/neon-private-crypto.js';
import { neonStoreOperation } from '../lib/neon-store.js';

test('Supabase remains the default until an explicit switch',()=>{
 const old=process.env.VETO_STORAGE_PROVIDER;
 try {delete process.env.VETO_STORAGE_PROVIDER;assert.equal(selectedStorageProvider(),'supabase');
   process.env.VETO_STORAGE_PROVIDER='neon';assert.equal(selectedStorageProvider(),'neon');
   process.env.VETO_STORAGE_PROVIDER='unexpected';
   assert.throws(()=>selectedStorageProvider(),/INVALID_VETO_STORAGE_PROVIDER/);
 } finally {if(old===undefined)delete process.env.VETO_STORAGE_PROVIDER;else process.env.VETO_STORAGE_PROVIDER=old;}
});
test('Neon encrypts session payload using authenticated per-owner context',()=>{
 const old=process.env.VETO_NEON_SESSION_KEY;
 try {process.env.VETO_NEON_SESSION_KEY='a'.repeat(64);assert.ok(neonCipherReady());
  const secret={session:'confidential-test-session',owner:'123'};
  const ciphertext=sealNeonJson(secret,'session:123');
  assert.match(ciphertext,/^v4\./);assert.ok(!ciphertext.includes(secret.session));
  assert.deepEqual(openNeonJson(ciphertext,'session:123'),secret);
  assert.throws(()=>openNeonJson(ciphertext,'session:456'));
  const tampered=ciphertext.slice(0,-2)+'AA';
  assert.throws(()=>openNeonJson(tampered,'session:123'));
 }finally{if(old===undefined)delete process.env.VETO_NEON_SESSION_KEY;else process.env.VETO_NEON_SESSION_KEY=old;}
});
test('No private crypto claims while key is missing',()=>{
 const old=process.env.VETO_NEON_SESSION_KEY;
 try {delete process.env.VETO_NEON_SESSION_KEY;assert.equal(neonCipherReady(),false);
   assert.throws(()=>sealNeonJson({},'session:123'),/VETO_NEON_SESSION_KEY_NOT_CONFIGURED/);
 }finally{if(old!==undefined)process.env.VETO_NEON_SESSION_KEY=old;}
});
test('Unported private operations fail explicitly: never route to old Supabase',async()=>{
 await assert.rejects(neonStoreOperation('unknown_operation',{userId:'123'}),/NEON_OPERATION_NOT_MIGRATED/);
});
test('Storage readiness is explicit rather than cosmetic',()=>{
 const values=['VETO_STORAGE_PROVIDER','VETO_NEON_SESSION_KEY','VETO_NEON_DATABASE_URL'];
 const old=Object.fromEntries(values.map(k=>[k,process.env[k]]));
 try{process.env.VETO_STORAGE_PROVIDER='neon';
   delete process.env.VETO_NEON_DATABASE_URL;
   process.env.VETO_NEON_SESSION_KEY='b'.repeat(64);
   assert.equal(neonStorageConfigured(),false);
 }finally{for(const k of values){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
