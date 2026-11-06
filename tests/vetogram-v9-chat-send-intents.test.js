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
