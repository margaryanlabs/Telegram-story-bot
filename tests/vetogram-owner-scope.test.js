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
  assert.match(js,/const requestOwner=signed\(\),requestOwnerId=owner\(\)/);
  assert.match(js,/signed\(\)!==requestOwner\|\|owner\(\)!==requestOwnerId/);
  assert.match(js,/if\(oldRequestCanReset\(state\.identity,requestOwner\)\)reset\(\)/);
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
  assert.match(js,/if\(oldRequestCanReset\(state\.identity,requestOwner\)\)reset\(\)/);
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
