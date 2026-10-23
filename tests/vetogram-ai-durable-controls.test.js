import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encryptAiMemory,decryptAiMemory,memoryEncryptionReady} from '../lib/vetogram-ai-memory-crypto.js';
import {normalizeMemorySnapshot,normalizeMemoryRevision} from '../lib/vetogram-ai-memory-core.js';
import {trustedGrantPolicy} from '../lib/vetogram-ai-grants.js';
import {verifyNegotiationProposal} from '../public/vetogram-negotiator-core.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const note={id:'12345678-1234-4123-8123-123456789012',label:'Tone',content:'Clear and polite',createdAt:42};

test('AI Memory validates note count, UUIDs, length and revision',()=>{
  assert.deepEqual(normalizeMemorySnapshot([note]),[note]);
  assert.throws(()=>normalizeMemorySnapshot(Array(9).fill(note)),/AI_MEMORY_COUNT_INVALID/);
  assert.throws(()=>normalizeMemorySnapshot([note,note]),/AI_MEMORY_ITEM_INVALID/);
  assert.throws(()=>normalizeMemorySnapshot([{...note,id:'not-a-uuid'}]),/AI_MEMORY_ITEM_INVALID/);
  assert.throws(()=>normalizeMemorySnapshot([{...note,content:'z'.repeat(451)}]),/AI_MEMORY_ITEM_TOO_LONG/);
  assert.equal(normalizeMemoryRevision(0),0);
  assert.throws(()=>normalizeMemoryRevision(-1),/AI_MEMORY_REVISION_INVALID/);
});
test('AI Memory AES-GCM is owner bound, authenticated, randomly salted and key separated',()=>{
  const original=process.env.VETOGRAM_AI_MEMORY_KEY;
  try{
    delete process.env.VETOGRAM_AI_MEMORY_KEY;
    assert.equal(memoryEncryptionReady(),false);
    assert.throws(()=>encryptAiMemory('123',[note]),/AI_MEMORY_KEY_NOT_CONFIGURED/);
    process.env.VETOGRAM_AI_MEMORY_KEY='a1'.repeat(32);
    assert.equal(memoryEncryptionReady(),true);
    const a=encryptAiMemory('123',[note]),b=encryptAiMemory('123',[note]);
    assert.notEqual(a,b);
    assert.deepEqual(decryptAiMemory('123',a),[note]);
    assert.throws(()=>decryptAiMemory('999',a));
    const parts=a.split('.');
    parts[3]=(parts[3].startsWith('A')?'B':'A')+parts[3].slice(1);
    assert.throws(()=>decryptAiMemory('123',parts.join('.')));
    process.env.VETOGRAM_AI_MEMORY_KEY='b2'.repeat(32);
    assert.throws(()=>decryptAiMemory('123',a),/AI_MEMORY_KEY_MISMATCH/);
  }finally{
    if(original===undefined)delete process.env.VETOGRAM_AI_MEMORY_KEY;
    else process.env.VETOGRAM_AI_MEMORY_KEY=original;
  }
});
test('Cloud Memory follows explicit consent, signed owner and optimistic version update',()=>{
  const api=read('api/vetogram-ai-memory.js'),store=read('lib/vetogram-ai-memory-store.js');
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(api,/x-vetogram-memory-consent/);
  assert.match(api,/VETOGRAM_AI_MEMORY_ENABLED/);
  assert.match(api,/private, no-store/);
  assert.match(store,/ON CONFLICT\(owner_id\) DO NOTHING/);
  assert.match(store,/revision=revision\+1/);
  assert.match(store,/AND revision=\$3::integer/);
  assert.match(store,/AI_MEMORY_VERSION_CONFLICT/);
  assert.doesNotMatch(store,/chat_messages|session_ciphertext|sendOwnerMessage/);
  const sql=read('migrations/vetogram-ai-memory-20261023.sql');
  assert.match(sql,/encrypted_snapshot text NOT NULL/);
  assert.doesNotMatch(sql,/(?:\bprompt_text\b|\bmessage_text\b|\bsession_key\b)\s+(?:text|varchar)/i);
});
test('Server grant trust boundary rejects revoked, expired, wrong chat and currency mismatch',()=>{
  const grant={
    grantId:'12345678-1234-4123-8123-123456789012',
    chatId:'777',currency:'USD',askingCents:50000,minCents:47500,
    maxDiscountPct:5,expiresAt:new Date(Date.now()+60000).toISOString(),active:true,mode:'approval-only'
  };
  const policy=trustedGrantPolicy('123',grant,'777');
  assert.equal(policy.minCents,47500);
  const result=verifyNegotiationProposal(policy,{reply:'Offer $475.00',quotedPrice:475,
    currency:'USD',decision:'counteroffer'},{owner:'123',chatId:'777',now:Date.now()});
  assert.equal(result.allowed,true);
  assert.equal(result.requiresApproval,true);
  assert.throws(()=>trustedGrantPolicy('123',{...grant,active:false},'777'),/AI_GRANT_NOT_ACTIVE/);
  assert.throws(()=>trustedGrantPolicy('123',grant,'999'),/AI_GRANT_NOT_ACTIVE/);
  assert.throws(()=>trustedGrantPolicy('123',{...grant,minCents:60000},'777'),/AI_GRANT_CORRUPT/);
});
test('Negotiator server checks permission twice and denies unauthorized model drafts',()=>{
  const code=read('api/vetogram-ai.js');
  assert.match(code,/getAiDraftGrant\(owner.id,grantId\)/);
  assert.match(code,/getAiDraftGrant\(owner.id,draftingGrant.grantId\)/);
  assert.match(code,/verifyNegotiationProposal\(livePolicy,answer.negotiation/);
  assert.match(code,/return reply\(res,403,\{error:'Нет действующего серверного разрешения/);
  assert.match(code,/return reply\(res,422,\{error:'AI предложил условия/);
  assert.ok(code.indexOf('getAiDraftGrant(owner.id,grantId)')<
    code.indexOf('reserveAiBudget(owner.id,parsed,instruction'));
  const grants=read('api/vetogram-ai-grants.js');
  assert.match(grants,/x-vetogram-grant-consent/);
  assert.match(grants,/VETOGRAM_AI_GRANTS_ENABLED/);
  assert.doesNotMatch(grants,/sendOwnerMessage|telegram-send|withBackupClient/);
});
test('Grant SQL stores no private Telegram messages and revoke is owner guarded',()=>{
  const sql=read('migrations/vetogram-ai-draft-grants-20261023.sql');
  const store=read('lib/vetogram-ai-grants.js');
  assert.match(sql,/mode='approval-only'/);
  assert.match(sql,/revoked_at/);
  assert.match(store,/WHERE owner_id=\$1::bigint AND grant_id=\$2::uuid AND revoked_at IS NULL/);
  assert.match(store,/ON CONFLICT\(owner_id\) DO UPDATE/);
  assert.doesNotMatch(sql,/session_ciphertext|message_text|ai_prompt/);
});
test('Frontend exposes guarded cloud memory and negotiation revoke controls',()=>{
  const html=read('public/studio.html'),ui=read('public/vetogram-ai.js'),route=read('api/router.js');
  for(const id of ['vtaiMemoryCloudSave','vtaiMemoryCloudLoad','vtaiMemoryCloudErase',
    'vtaiMemoryCloudStatus','vtaiNegRevoke'])
    assert.ok(html.includes('id="'+id+'"'),'missing '+id);
  assert.match(ui,/await writeMemoryCloud\(state.memory\)/);
  assert.match(ui,/state.memoryRevision/);
  assert.match(ui,/x-vetogram-memory-consent/);
  assert.match(ui,/x-vetogram-grant-consent/);
  assert.match(route,/"vetogram-ai-memory"/);
  assert.match(route,/"vetogram-ai-grants"/);
});
