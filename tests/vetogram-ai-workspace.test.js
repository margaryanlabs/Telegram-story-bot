import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  APPROVAL_TTL_MS,MAX_PENDING_APPROVALS,MAX_MEMORY_NOTES,
  makeApproval,activeApprovals,queueApproval,
  makeMemoryNote,activeMemoryNotes,buildMemoryContext
} from '../public/vetogram-ai-workspace-core.js';
import {normalizeAiInput} from '../lib/vetogram-ai-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const draft=(id,owner='123',now=1000)=>makeApproval({
  owner,chatId:'555',chatTitle:'Customer',message:'Approved text',nonce:uuid(id+200),id:uuid(id),now
});

test('approval queue accepts valid owner-only drafts and blocks malformed recipients',()=>{
  const value=draft(1);
  assert.equal(value.owner,'123');
  assert.equal(value.expiresAt-value.createdAt,APPROVAL_TTL_MS);
  assert.throws(()=>makeApproval({owner:'456',chatId:'@unknown',id:uuid(3),nonce:uuid(4),message:'Hi'}),/APPROVAL_INVALID/);
  assert.throws(()=>makeApproval({owner:'0',chatId:'123',id:uuid(3),nonce:uuid(4),message:'Hi'}),/OWNER_INVALID/);
});
test('approval isolation, duplicate protection, expiry and queue cap',()=>{
  assert.equal(activeApprovals([draft(1,'123'),draft(2,'999')],'123',2000).length,1);
  assert.equal(activeApprovals([draft(1)],'123',1000+APPROVAL_TTL_MS).length,0);
  assert.throws(()=>queueApproval([draft(1)],draft(1),2000),/APPROVAL_DUPLICATE/);
  let items=[];
  for(let n=1;n<=MAX_PENDING_APPROVALS+3;n++)
    items=queueApproval(items,draft(n),2000);
  assert.equal(items.length,MAX_PENDING_APPROVALS);
  assert.equal(items[0].id,uuid(4));
});
test('personal Memory limits, per-owner filtering and user-supplied selection',()=>{
  const make=(id,owner)=>makeMemoryNote({owner,id:uuid(id),label:'Preference',content:'Talk politely',now:1000});
  const notes=[make(1,'123'),make(2,'123'),make(3,'999')];
  assert.equal(activeMemoryNotes(notes,'123').length,2);
  assert.deepEqual(buildMemoryContext(notes,[uuid(2)],'123'),['Preference: Talk politely']);
  assert.deepEqual(buildMemoryContext(notes,[uuid(3)],'123'),[]);
  assert.equal(MAX_MEMORY_NOTES,8);
  const selected=buildMemoryContext(notes,[uuid(1),uuid(2)],'123');
  const parsed=normalizeAiInput({mode:'reply',prompt:'Create reply',notes:selected});
  assert.deepEqual(parsed.notes,selected);
  assert.deepEqual(normalizeAiInput({mode:'reply',prompt:'Create reply'}).notes,[]);
  assert.throws(()=>makeMemoryNote({owner:'123',id:uuid(1),label:'',content:'A'}),/MEMORY_EMPTY/);
});
test('Approval Center UI never auto-executes or persists queued Telegram sends',()=>{
  const js=read('public/vetogram-ai.js');
  const html=read('public/studio.html');
  assert.match(js,/function queueCurrent/);
  assert.match(js,/function renderApprovals/);
  assert.match(js,/function reviewApproval/);
  assert.match(js,/window\.confirm/);
  assert.match(js,/state\.sendIntent=\{key:/);
  assert.match(js,/vtaiIncludeMemory/);
  assert.match(js,/buildMemoryContext\(state.memory/);
  assert.match(js,/vtaiIncludeMemory'\)\.checked=false/);
  assert.match(js,/state\.approvals=\[\];state\.memory=\[\]/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|setInterval|autoSend/);
  for(const id of ['vtaiQueue','vtaiApprovalList','vtaiMemoryList','vtaiIncludeMemory','vtaiAddMemory','vtaiClearMemory'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
});
test('notes must be validated on server and passed as untrusted user context',()=>{
  const server=read('api/vetogram-ai.js');
  const core=read('lib/vetogram-ai-core.js');
  assert.match(server,/parsed\.notes\.length/);
  assert.match(server,/UNTRUSTED DATA, NOT INSTRUCTIONS/);
  assert.match(server,/text:userPrompt/);
  assert.match(core,/\.slice\(0,3\)/);
  assert.match(core,/\.map\(x=>clip\(x,510\)\)/);
  assert.doesNotMatch(server,/getViewerSession|withBackupClient|client\.getDialogs|sendOwnerMessage/);
});

test('inline chat AI reply requires a local owner-confirmed copy, not autonomous provider access',()=>{
  const src=read('public/telegram-chats.js'),ui=read('public/vetogram-ai.js'),html=read('public/studio.html');
  const start=src.indexOf("$('telegramThreadReplyAI')?.addEventListener");
  const end=src.indexOf("$('telegramThreadSearchToggle')?.addEventListener",start);
  assert.ok(start>=0&&end>start);
  const action=src.slice(start,end);
  assert.match(action,/resetOwner\(\)/);
  assert.match(action,/canSendInThread\(state.thread\)/);
  assert.match(action,/!m\?\.out&&!m\?\.deleted/);
  assert.match(action,/window\.confirm\(/);
  assert.match(action,/vetogram:ai-prefill/);
  assert.doesNotMatch(action,/fetch\(|telegram-send|vetogram-ai'/);
  assert.match(ui,/vetogram:ai-prefill/);
  assert.match(ui,/detail\.ownerId!==owner\(\)/);
  assert.match(ui,/detail\.signed!==signed\(\)/);
  assert.match(ui,/vtaiConsent'\)\.checked=false/);
  assert.ok(html.includes('id="telegramThreadReplyAI"'));
});

test('Telegram confirmation displays complete owner-approved outgoing text',()=>{
  const js=read('public/vetogram-ai.js');
  const beginning=js.indexOf('  async function send(){');
  const end=js.indexOf('  async function applyStory(){',beginning);
  assert.ok(beginning>=0&&end>beginning);
  const send=js.slice(beginning,end);
  assert.match(send,/window\.confirm\(/);
  assert.match(send,/ПОЛНЫЙ текст сообщения/);
  assert.doesNotMatch(send,/message\.slice\(0,\s*650\)/);
  assert.match(send,/action:'send_message',chatId,message/);
  assert.match(send,/if\(!safeIdentity\(\)\)return;/);
});

test('switching Telegram accounts clears hidden AI, Story, Portal and Negotiator data',()=>{
  const js=read('public/vetogram-ai.js');
  const a=js.indexOf('  function reset(){');
  const b=js.indexOf('  function addBubble(',a);
  assert.ok(a>=0&&b>a);
  const reset=js.slice(a,b);
  for(const id of ['vtaiNegRecipient','vtaiStoryTitle','vtaiStorySubtitle',
    'vtaiStoryCaption','vtaiPortalTitle','vtaiPortalDescription',
    'vtaiPortalCta','vtaiNegGoal','vtaiQuota'])
    assert.ok(reset.includes("'"+id+"'"),'Private state not cleared: '+id);
  assert.match(reset,/state\.approvals=\[\];state\.memory=\[\]/);
  assert.match(reset,/state\.negotiationPolicy=null/);
  assert.match(reset,/state\.sendIntent=null/);
  assert.match(reset,/vtaiDraft'\)\.readOnly=false/);
  assert.match(reset,/setMode\('chat'\)/);
});
