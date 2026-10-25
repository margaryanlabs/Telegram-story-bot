import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerScopeMatches,oldRequestCanReset} from '../public/vetogram-owner-scope-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const alice='signed-telegram-init-data-a';
const bob='signed-telegram-init-data-b';
const scope={identity:alice,ownerId:'11111',epoch:1};
test('owner response is accepted only for original signed identity and account',()=>{
  assert.equal(ownerScopeMatches(scope,{...scope},alice),true);
  assert.equal(ownerScopeMatches(scope,{...scope,identity:bob},bob),false);
  assert.equal(ownerScopeMatches(scope,{...scope,ownerId:'22222'},alice),false);
  assert.equal(ownerScopeMatches(scope,{...scope,epoch:2},alice),false);
  assert.equal(ownerScopeMatches(scope,{...scope},bob),false);
  assert.equal(ownerScopeMatches({...scope,ownerId:''},scope,alice),false);
  assert.equal(ownerScopeMatches({...scope,ownerId:'001xyz'},scope,alice),false);
  assert.equal(ownerScopeMatches({...scope,epoch:-1},scope,alice),false);
  assert.equal(ownerScopeMatches(null,scope,alice),false);
});
test('A → B → A rotation cannot revive an old request after reset epoch',()=>{
  const fresh={identity:alice,ownerId:'11111',epoch:3};
  assert.equal(ownerScopeMatches(scope,fresh,alice),false);
  assert.equal(ownerScopeMatches(fresh,fresh,alice),true);
});
test('stale A request can never reset an active B account',()=>{
  assert.equal(oldRequestCanReset(alice,alice),true);
  assert.equal(oldRequestCanReset(bob,alice),false);
  assert.equal(oldRequestCanReset(null,alice),false);
  assert.equal(oldRequestCanReset(alice,''),false);
});
test('all Task Cloud and Reminders async callbacks are fenced to the signed original owner',()=>{
  const js=read('public/vetogram-ai.js');
  const signatures=[
    'async function loadTasksCloud()','async function saveTasksCloud()',
    'async function eraseTasksCloud()','async function loadReminders()',
    'async function scheduleReminder(','async function cancelAllReminders()',
    'async function cancelReminder('
  ];
  assert.match(js,/state\.requestEpoch\+=1/);
  assert.match(js,/const ownerRequestScope=\(\)=>\(\{identity:state\.identity,ownerId:owner\(\),epoch:state\.requestEpoch\}\)/);
  for(const name of signatures){
    const start=js.indexOf(name);
    assert.ok(start>=0,'Missing owner request '+name);
    const end=js.indexOf('\n  }\n',start);
    assert.ok(end>start,'Unterminated '+name);
    const body=js.slice(start,end);
    assert.match(body,/const scope=ownerRequestScope\(\)/,name);
    assert.match(body,/if\(!isOwnerRequestCurrent\(scope\)\)return/,name);
    assert.match(body,/catch\(error\)\{if\(isOwnerRequestCurrent\(scope\)\)/,name);
    assert.match(body,/finally\{if\(isOwnerRequestCurrent\(scope\)\)/,name);
  }
  assert.match(js,/const requestScope=ownerRequestScope\(\)/);
  assert.match(js,/const requestOwner=requestScope\.identity,requestOwnerId=requestScope\.ownerId/);
  assert.match(js,/signed\(\)!==requestOwner\|\|owner\(\)!==requestOwnerId/);
  assert.match(js,/oldRequestCanReset\(state\.identity,requestOwner\)\)reset\(\)/);
  assert.match(js,/state\.requestEpoch===requestScope\.epoch/);
  assert.doesNotMatch(js,/\!owner\(\)\)\{reset\(\);throw Error/);
});

test('AI Memory, AI generation and manual Telegram send never mutate a switched owner',()=>{
  const js=read('public/vetogram-ai.js');
  for(const name of ['async function loadMemoryCloud()',
    'async function writeMemoryCloud(','async function eraseMemoryCloud()',
    'async function generate()','async function send()']){
    const start=js.indexOf(name);
    assert.ok(start>=0,name);
    const end=js.indexOf('\n  }\n',start);
    assert.ok(end>start,'Missing method end: '+name);
    const part=js.slice(start,end);
    assert.match(part,/const scope=ownerRequestScope\(\)/,name);
    assert.match(part,/if\(!isOwnerRequestCurrent\(scope\)\)return/,name);
    assert.match(part,/catch\(error\)\{if\(isOwnerRequestCurrent\(scope\)\)/,name);
    assert.match(part,/finally\{if\(isOwnerRequestCurrent\(scope\)\)/,name);
  }
  assert.match(js,/oldRequestCanReset\(state\.identity,requestOwner\)\)reset\(\)/);
  assert.match(js,/state\.requestEpoch===requestScope\.epoch/);
});
test('Second Brain and AI Action consume a response only after the AI provider returns',()=>{
  const js=read('public/vetogram-ai.js');
  const start=js.indexOf('async function generate()');
  const end=js.indexOf('async function send()',start);
  const body=js.slice(start,end);
  const answer=body.indexOf("const answer=await request('/api/vetogram-ai'");
  const grant=body.indexOf("const issued=await request('/api/vetogram-ai-grants'");
  const brief=body.indexOf('state.brief=answer.brief');
  const action=body.indexOf('actionDraftValid(answer.action)');
  assert.ok(answer>grant,'Provider request must follow explicit Negotiator grant');
  assert.ok(brief>answer,'Second Brain cannot use answer before provider response');
  assert.ok(action>answer,'AI Action cannot use answer before provider response');
  assert.match(body,/if\(!isOwnerRequestCurrent\(scope\)\)return;\n      if\(state\.mode!==mode\)/);
});
test('manual send ignores a stale network result before modifying draft or state',()=>{
  const js=read('public/vetogram-ai.js');
  const start=js.indexOf('async function send()');
  const end=js.indexOf('\n  }\n',start);
  const body=js.slice(start,end);
  const response=body.indexOf("const result=await request('/api/telegram-send'");
  const guard=body.indexOf('if(!isOwnerRequestCurrent(scope))return;',response);
  const clearDraft=body.indexOf("$('vtaiDraft').value=''",response);
  assert.ok(response>=0&&guard>response&&clearDraft>guard);
});


test('explicit action confirmation cannot be carried from Telegram owner A to B',()=>{
  const js=read('public/vetogram-ai.js');
  const actions=['async function loadTasksCloud()','async function saveTasksCloud()',
    'async function eraseTasksCloud()','async function scheduleReminder(',
    'async function cancelAllReminders()','async function cancelReminder(',
    'async function loadMemoryCloud()','async function eraseMemoryCloud()',
    'async function send()'];
  for(const name of actions){
    const at=js.indexOf(name),end=js.indexOf('\n  }\n',at);
    assert.ok(at>=0&&end>at,name);
    const body=js.slice(at,end);
    const scope=body.indexOf('const scope=ownerRequestScope()');
    const confirm=body.indexOf('window.confirm(');
    const resume=body.indexOf('if(!isOwnerRequestCurrent(scope))return;',confirm);
    const firstRequest=body.indexOf('await request(',confirm);
    assert.ok(scope>=0&&confirm>scope&&resume>confirm&&firstRequest>resume,
      'Confirmation must revalidate original owner before network: '+name);
  }
  const start=js.indexOf('async function generate()'),end=js.indexOf('async function send()',start);
  const ai=js.slice(start,end);
  const scope=ai.indexOf('const scope=ownerRequestScope()');
  const confirm=ai.indexOf("window.confirm('Разрешить VETOGRAM AI готовить");
  const guard=ai.indexOf('if(!isOwnerRequestCurrent(scope))return;',confirm);
  const grant=ai.indexOf("await request('/api/vetogram-ai-grants'",confirm);
  assert.ok(scope>=0&&confirm>scope&&guard>confirm&&grant>guard);
});


test('chat pagination and Agent Control discard stale owner results and errors',()=>{
  const js=read('public/vetogram-ai.js');
  for(const name of ['async function loadChats(','async function agentStatus()',
    'async function changeAgentPause(','async function agentHistory(']){
    const start=js.indexOf(name),end=js.indexOf('\n  }\n',start);
    assert.ok(start>=0&&end>start,name);
    const body=js.slice(start,end);
    assert.match(body,/const scope=ownerRequestScope\(\)/,name);
    assert.match(body,/if\(!isOwnerRequestCurrent\(scope\)\)return/,name);
  }
  const chats=js.slice(js.indexOf('async function loadChats('),
    js.indexOf('function validNegotiatorSend('));
  assert.match(chats,/if\(!isOwnerRequestCurrent\(scope\)\)return;\n      state\.dialogs=merged/);
  assert.match(chats,/catch\(error\)\{\n      if\(isOwnerRequestCurrent\(scope\)\)/);
  assert.match(chats,/finally\{\n      if\(isOwnerRequestCurrent\(scope\)\)/);
  const agent=js.slice(js.indexOf('async function changeAgentPause('),
    js.indexOf('async function agentHistory('));
  assert.match(agent,/if\(!isOwnerRequestCurrent\(scope\)\)return;\n      notice/);
  assert.match(agent,/finally\{if\(isOwnerRequestCurrent\(scope\)\)state\.agentBusy=false/);
});
test('mode switching invalidates stale draft, nonce, send eligibility and approval context',()=>{
  const js=read('public/vetogram-ai.js');
  const switchMode=js.slice(js.indexOf('function setMode('),
    js.indexOf('function actionRecipientReady(',js.indexOf('function setMode(')));
  assert.match(switchMode,/if\(state\.mode!==mode\)\{/);
  assert.match(switchMode,/state\.last=null;state\.reviewedApprovalId=null;state\.sendIntent=null/);
  assert.match(switchMode,/\$\('vtaiDraft'\)\.value='';\$\('vtaiSend'\)\.disabled=true/);
  const send=js.slice(js.indexOf('async function send()'),
    js.indexOf('function applyStory(',js.indexOf('async function send()')));
  assert.match(send,/if\(!canSendDraft\(\)\|\|\$\('vtaiReview'\)\.hidden\)/);
  const queue=js.slice(js.indexOf('function queueCurrent()'),
    js.indexOf('async function reviewApproval('));
  assert.match(queue,/if\(!canSendDraft\(\)\|\|\$\('vtaiReview'\)\.hidden\)/);
});
test('Approval Center waits for chat lookup then rechecks signed account and saved approval',()=>{
  const js=read('public/vetogram-ai.js');
  const start=js.indexOf('async function reviewApproval(');
  const end=js.indexOf('function renderMemory(',start);
  const body=js.slice(start,end);
  const lookup=body.indexOf('await loadChats({seekChatId:item.chatId})');
  const guard=body.indexOf('if(!isOwnerRequestCurrent(scope))return;',lookup);
  const live=body.indexOf('activeApprovals(state.approvals,owner()).some(entry=>entry.id===id)',guard);
  const apply=body.indexOf("setMode('reply')",live);
  assert.ok(lookup>=0&&guard>lookup&&live>guard&&apply>live);
  assert.match(body,/const scope=ownerRequestScope\(\)/);
});
test('Negotiator revoke and Follow-up previews cannot cross owner during confirmation',()=>{
  const js=read('public/vetogram-ai.js');
  const revoke=js.slice(js.indexOf("$('vtaiNegRevoke').addEventListener"),
    js.indexOf("$('vtaiSend').addEventListener",js.indexOf("$('vtaiNegRevoke').addEventListener")));
  const scope=revoke.indexOf('const scope=ownerRequestScope()');
  const confirm=revoke.indexOf('window.confirm(',scope);
  const before=revoke.indexOf('if(!isOwnerRequestCurrent(scope))return;',confirm);
  const fetch=revoke.indexOf("await request('/api/vetogram-ai-grants',{action:'status'})",before);
  const beforeRevoke=revoke.indexOf('if(!isOwnerRequestCurrent(scope))return;',fetch);
  const revokeCall=revoke.indexOf("await request('/api/vetogram-ai-grants',{action:'revoke'",beforeRevoke);
  assert.ok(scope>=0&&confirm>scope&&before>confirm&&fetch>before&&beforeRevoke>fetch&&revokeCall>beforeRevoke);
  const followups=js.slice(js.indexOf('function renderFollowups()'),js.indexOf('async function loadChats('));
  assert.equal((followups.match(/const scope=ownerRequestScope\(\)/g)||[]).length,2);
  assert.equal((followups.match(/if\(!isOwnerRequestCurrent\(scope\)\)return;/g)||[]).length,2);
  assert.equal((followups.match(/window\.confirm\(/g)||[]).length,2);
});
