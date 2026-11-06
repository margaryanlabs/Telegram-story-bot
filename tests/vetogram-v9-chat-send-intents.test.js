import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=source.indexOf('  function uncertainTextKey(');
const end=source.indexOf('  async function sendOutgoing(){',start);
assert.ok(start>=0&&end>start,'real chat intent helpers exist');

// Execute the exact production helper implementations against an isolated
// in-memory state. No Telegram API, auth tokens or network are touched.
function harness(){
  const state={lastSendFailures:new Map(),lastSendFailure:null};
  const body=source.slice(start,end);
  const funcs=new Function('state',body+
    '\nreturn {uncertainTextKey,findUncertainTextSend,rememberUncertainTextSend,clearConfirmedTextSend};')(state);
  return {state,...funcs};
}
const failure=(chatId,message,nonce,replyTo=null)=>({chatId,message,nonce,replyTo});

test('a changed draft never destroys a prior uncertain nonce',()=>{
  const h=harness(),a=failure('101','hello','nonce-A');
  h.rememberUncertainTextSend(a);
  assert.equal(h.findUncertainTextSend('101','different',null),null);
  assert.equal(h.findUncertainTextSend('101','hello',null)?.nonce,'nonce-A');
  const input=source.slice(source.indexOf("  $('telegramThreadCompose')?.addEventListener('input'"),
    source.indexOf("  $('telegramThreadCompose')?.addEventListener('keydown'"));
  assert.doesNotMatch(input,/lastSendFailures\.delete\(/);
  assert.match(input,/findUncertainTextSend/);
});

test('two uncertain messages in the same chat retain independent random_id values',()=>{
  const h=harness();
  h.rememberUncertainTextSend(failure('101','first','nonce-A'));
  h.rememberUncertainTextSend(failure('101','second','nonce-B'));
  assert.equal(h.findUncertainTextSend('101','first',null)?.nonce,'nonce-A');
  assert.equal(h.findUncertainTextSend('101','second',null)?.nonce,'nonce-B');
  assert.equal(h.state.lastSendFailures.size,2);
});

test('identical text to a different peer or reply target never reuses a nonce',()=>{
  const h=harness();
  h.rememberUncertainTextSend(failure('101','hello','nonce-A',3));
  h.rememberUncertainTextSend(failure('102','hello','nonce-B',3));
  assert.equal(h.findUncertainTextSend('101','hello',3)?.nonce,'nonce-A');
  assert.equal(h.findUncertainTextSend('102','hello',3)?.nonce,'nonce-B');
  assert.equal(h.findUncertainTextSend('101','hello',4),null);
  assert.equal(h.findUncertainTextSend('101','hello',null),null);
});

test('confirmed ACK clears only its matching intent, not another uncertain send',()=>{
  const h=harness();
  h.rememberUncertainTextSend(failure('101','first','nonce-A'));
  h.rememberUncertainTextSend(failure('101','second','nonce-B'));
  h.clearConfirmedTextSend('101','second',null,'nonce-B');
  assert.equal(h.findUncertainTextSend('101','first',null)?.nonce,'nonce-A');
  assert.equal(h.findUncertainTextSend('101','second',null),null);
});

test('a stale or mismatched ACK cannot erase a pending nonce',()=>{
  const h=harness();
  h.rememberUncertainTextSend(failure('101','hello','nonce-A'));
  h.clearConfirmedTextSend('101','hello',null,'nonce-OLD');
  assert.equal(h.findUncertainTextSend('101','hello',null)?.nonce,'nonce-A');
});

test('navigation restores the most recent exact text and original reply only',()=>{
  const h=harness();
  h.rememberUncertainTextSend(failure('101','hello','nonce-A',2));
  h.rememberUncertainTextSend(failure('101','hello','nonce-B',3));
  assert.equal(h.findUncertainTextSend('101','hello')?.replyTo,3);
  assert.equal(h.findUncertainTextSend('101','other'),null);
  assert.match(source,/const failedSend=findUncertainTextSend\(String\(chat\.id\)/);
  assert.match(source,/const unresolved=findUncertainTextSend\(String\(chat\.id\)/);
});

test('memory is bounded to 16 entries, never persisted, and reset on owner change',()=>{
  const h=harness();
  for(let i=0;i<19;i++)h.rememberUncertainTextSend(failure('101','message-'+i,'nonce-'+i));
  assert.equal(h.state.lastSendFailures.size,16);
  assert.equal(h.findUncertainTextSend('101','message-0',null),null);
  assert.equal(h.findUncertainTextSend('101','message-18',null)?.nonce,'nonce-18');
  const owner=source.slice(source.indexOf('  function resetOwner(){'),
    source.indexOf('  function resetOwner(){')+2700);
  assert.match(owner,/lastSendFailures\.clear\(\)/);
  assert.doesNotMatch(source.slice(start,end),/localStorage|sessionStorage|indexedDB|fetch\(/);
});

test('sending reuses nonce only for exact intent and never auto-retries',()=>{
  const send=source.slice(source.indexOf('  async function sendOutgoing(){'),
    source.indexOf('  function settleCachedTextSend(',source.indexOf('  async function sendOutgoing(){')));
  assert.match(send,/const savedRetry=findUncertainTextSend\(chatId,message,replyToId\)/);
  assert.match(send,/const nonce=retry\?savedRetry\.nonce:window\.crypto\?\.randomUUID/);
  assert.match(send,/clearConfirmedTextSend\(chatId,message,replyToId,nonce\)/);
  assert.match(send,/rememberUncertainTextSend\(failure\)/);
  assert.doesNotMatch(send,/setTimeout\([^)]*sendOutgoing\(/);
});

function requestHarness(response){
  const start=source.indexOf('  async function sendChatRequest(');
  const end=source.indexOf('  function canSendInThread(',start);
  assert.ok(start>=0&&end>start);
  let calls=0;
  const fetch=async()=>{calls++;return response;};
  const tg={initData:'signed-owner-test-only'};
  const send=new Function('tg','resetOwner','fetch','AbortController','setTimeout','clearTimeout',
    source.slice(start,end)+'\nreturn sendChatRequest;')(
    tg,()=>false,fetch,AbortController,()=>1,()=>{});
  return {send,getCalls:()=>calls};
}
function mockResponse(status,body){
  return {ok:status>=200&&status<300,status,
    json:async()=>{if(body===null)throw new SyntaxError('bad JSON');return body;}};
}
const validMessageId=924;

test('valid owner-confirmed Telegram message ID is accepted exactly once',async()=>{
  const h=requestHarness(mockResponse(200,{ok:true,sent:true,messageId:validMessageId}));
  const data=await h.send('101','Hello','nonce-A');
  assert.equal(data.messageId,validMessageId);
  assert.equal(h.getCalls(),1);
});

test('HTTP 200 with malformed JSON or missing message ID remains uncertain',async()=>{
  for(const body of [null,{}, {ok:true,sent:true},{ok:true,sent:true,messageId:0},
    {ok:true,sent:false,messageId:924}]){
    const h=requestHarness(mockResponse(200,body));
    await assert.rejects(()=>h.send('101','Hello','nonce-A'),
      error=>error.uncertain===true);
    assert.equal(h.getCalls(),1);
  }
});

test('definitive HTTP 400 is not marked uncertain; HTTP 503 is',async()=>{
  const bad=requestHarness(mockResponse(400,{ok:false,error:'Некорректный чат'}));
  await assert.rejects(()=>bad.send('101','Hello','nonce-A'),
    error=>error.uncertain!==true);
  const outage=requestHarness(mockResponse(503,null));
  await assert.rejects(()=>outage.send('101','Hello','nonce-A'),
    error=>error.uncertain===true);
});
