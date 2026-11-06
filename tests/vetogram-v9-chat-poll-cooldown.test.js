/* V9: real Telegram polling flood waits, owner fence and safe retry semantics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {classifyTelegramPollRateLimit} from '../lib/telegram-chat-poll-rate-limit.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('public/telegram-chats.js');
const api=read('api/telegram-chat-updates.js');
const html=read('public/studio.html');

test('real MTProto FLOOD_WAIT and SLOWMODE durations become bounded retry delays',()=>{
  assert.deepEqual(classifyTelegramPollRateLimit(new Error('FLOOD_WAIT_83')),{
    retryAfterSeconds:83,
    error:'Telegram ограничил частоту обновления. Подождём перед следующим запросом.',
  });
  assert.equal(classifyTelegramPollRateLimit(new Error('FLOOD_WAIT_2')).retryAfterSeconds,30);
  assert.equal(classifyTelegramPollRateLimit(new Error('SLOWMODE_WAIT_90')).retryAfterSeconds,90);
  assert.equal(classifyTelegramPollRateLimit(new Error('FLOOD_PREMIUM_WAIT_999999')).retryAfterSeconds,86400);
  assert.equal(classifyTelegramPollRateLimit(new Error('TOO_MANY_REQUESTS')).retryAfterSeconds,120);
  assert.equal(classifyTelegramPollRateLimit(new Error('HTTP 429')).retryAfterSeconds,120);
  assert.equal(classifyTelegramPollRateLimit(new Error('SESSION_REVOKED')),null);
});

test('poll classifier never includes upstream exception secrets in public response',()=>{
  const secret='tg://login?token=SECRET_PHONE_123';
  const result=classifyTelegramPollRateLimit(new Error('FLOOD_WAIT_44 '+secret));
  assert.equal(result.retryAfterSeconds,44);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes('FLOOD_WAIT'));
});

test('owner-verified API returns structured 429 with Retry-After, not raw RPC trace',()=>{
  assert.match(api,/classifyTelegramPollRateLimit\(error\)/);
  assert.match(api,/res\.setHeader\('Retry-After',String\(rateLimit\.retryAfterSeconds\)\)/);
  assert.match(api,/return reply\(res,429,rateLimit\)/);
  assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
  assert.match(api,/sameTelegramAccount\(userId,session\.telegram_account_user_id\)/);
  assert.doesNotMatch(api,/console\.log\([^\n]*error/);
});

test('actual scheduleThreadSync function honors a longer owner-bound cooldown',()=>{
  const start=ui.indexOf('  function scheduleThreadSync(');
  const end=ui.indexOf('  function rememberHotThread(',start);
  assert.ok(start>=0&&end>start);
  const state={syncCooldownUntil:91000,syncTimer:null,threadLoadError:'',threadLoading:false};
  const waits=[],ctx={
    state,Date:{now:()=>1000},
    stopThreadSync(){state.syncTimer=null;},
    maySyncThread(){return true;},
    setTimeout(fn,delay){waits.push({fn,delay});return 123;},
    loadMessages(){throw new Error('not expected');},
    pollThread(){return true;},
  };
  const schedule=runInNewContext(ui.slice(start,end)+'\n scheduleThreadSync',ctx);
  schedule(15000);
  assert.equal(waits[0].delay,90000);
  schedule(110000);
  assert.equal(waits[1].delay,110000);
  state.syncCooldownUntil=0;
  schedule(26000);
  assert.equal(waits[2].delay,26000);
});

test('manual poll during flood cooldown never calls Telegram network',async()=>{
  const start=ui.indexOf('  async function pollThread(');
  const end=ui.indexOf('  // No personal payload:',start);
  assert.ok(start>=0&&end>start);
  const calls=[];
  const ctx={
    state:{thread:{id:'123'},syncBusy:false,threadLoading:false,sendInFlight:false,syncCooldownUntil:51000},
    Date:{now:()=>1000},
    resetOwner(){return false;},
    maySyncThread(){return true;},
    syncLabel(label){calls.push(['label',label]);},
    scheduleThreadSync(delay){calls.push(['timer',delay]);},
    fetch(){throw new Error('Telegram network called despite flood cooldown');},
  };
  const poll=runInNewContext(ui.slice(start,end)+'\n pollThread',ctx);
  await poll({manual:true});
  assert.equal(calls[1][0],'timer');
  assert.equal(calls[1][1],50000);
  assert.match(calls[0][1],/50 сек/);
});

test('429 cooldown remains across thread changes but is cleared on owner change',()=>{
  assert.match(ui,/syncCooldownUntil:0/);
  assert.match(ui,/state\.syncCooldownUntil=Math\.max\(state\.syncCooldownUntil,Date\.now\(\)\+wait\*1000\)/);
  assert.match(ui,/state\.syncFailures=0;state\.syncCooldownUntil=0;state\.syncBusy=false/);
  const open=ui.slice(ui.indexOf('function openThread('),ui.indexOf('function openThread(')+1800);
  assert.doesNotMatch(open,/syncCooldownUntil\s*=\s*0/);
  assert.match(ui,/issue\.retryAfterSeconds=/);
  assert.match(html,/telegram-chats\.js\?v=20261106-v9-chat-poll-01/);
});
