import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AI_MODES,normalizeAiInput,normalizeAiOutput,systemInstruction} from '../lib/vetogram-ai-core.js';
import {estimateAiUnits} from '../lib/vetogram-ai-budgets.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source='Артём: Пришлю проект в пятницу. Мария: Подтверждаю встречу в 15:00 завтра.';
const item={title:'Получить проект от Артёма',kind:'task',
  sourceQuote:'Пришлю проект в пятницу',deadlineText:'в пятницу',certainty:'explicit'};
const asJson=body=>JSON.stringify(body);

test('Second Brain is bounded and evidence-backed with literal source quotes',()=>{
  assert.ok(AI_MODES.includes('brief'));
  const result=normalizeAiOutput('brief',asJson({summary:'Есть задача и встреча',items:[item]}),source);
  assert.equal(result.brief.items.length,1);
  assert.equal(result.brief.items[0].deadlineText,'в пятницу');
  assert.match(systemInstruction('brief'),/Extract a factual Second Brain/);
  assert.equal(normalizeAiInput({mode:'brief',prompt:source}).mode,'brief');
});
test('rejects fabricated quotes and invented deadlines at the API parsing boundary',()=>{
  const cases=[
    {...item,sourceQuote:'Обязательно отправлю 100000 долларов'},
    {...item,deadlineText:'сегодня в 18:00'},
    {...item,deadlineText:'Friday'},
    {...item,sourceQuote:'Проект завтра в 19:00'},
    {...item,kind:'pay_now'},
    {...item,certainty:'verified'}
  ];
  for(const fake of cases)
    assert.throws(()=>normalizeAiOutput('brief',asJson({summary:'Задача',items:[fake]}),source),
      /AI_BRIEF_UNVERIFIED_SOURCE/,JSON.stringify(fake));
});
test('empty briefs are allowed but cannot claim active reminders',()=>{
  const answer=normalizeAiOutput('brief',asJson({summary:'Нет явных задач',items:[]}),source);
  assert.deepEqual(answer.brief.items,[]);
  assert.equal(answer.sent,undefined);
  assert.equal(answer.reminders,undefined);
  assert.throws(()=>normalizeAiOutput('brief',asJson({
    summary:'Found tasks',items:Array(6).fill(item)}),source),/AI_BRIEF_FORMAT_INVALID/);
});
test('Second Brain is included in quota and cannot auto-send or read Telegram chats',()=>{
  const input=normalizeAiInput({mode:'brief',prompt:source});
  assert.ok(estimateAiUnits(input,systemInstruction('brief'))>source.length);
  const api=read('api/vetogram-ai.js'),ui=read('public/vetogram-ai.js'),html=read('public/studio.html');
  assert.match(api,/normalizeAiOutput\(parsed.mode,output,parsed.prompt\)/);
  assert.doesNotMatch(api,/sendOwnerMessage|withBackupClient|client\.getDialogs/);
  for(const id of ['vtaiBriefPanel','vtaiBriefList','vtaiBriefStatus'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(ui,/state\.brief=answer.brief\|\|null/);
  assert.match(ui,/renderBrief\(\)/);
  assert.match(ui,/makeMemoryNote/);
  assert.match(ui,/window\.confirm\('Добавить эту AI-гипотезу/);
});
