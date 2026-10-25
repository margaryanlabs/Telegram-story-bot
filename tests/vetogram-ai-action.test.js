import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAiInput,normalizeAiOutput,systemInstruction} from '../lib/vetogram-ai-core.js';
import {estimateAiUnits} from '../lib/vetogram-ai-budgets.js';
import {actionRecipientCandidates,actionDraftValid,isExplicitActionCommand} from '../public/vetogram-ai-action-core.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const chat=(id,title,username=null)=>({id:String(id),title,username,type:'private'});

test('natural-language command generates a DRAFT only and never a send tool',()=>{
  const draft=normalizeAiOutput('action',JSON.stringify({
    intent:'draft_message',recipientQuery:'Артур',message:'Артур, созвонимся завтра в 15:00?'
  }));
  assert.equal(draft.action.intent,'draft_message');
  assert.equal(draft.action.recipientQuery,'Артур');
  assert.equal(draft.action.message,'Артур, созвонимся завтра в 15:00?');
  assert.ok(actionDraftValid(draft.action));
  assert.match(draft.text,/Черновик/);
  assert.equal(draft.sent,undefined);
  assert.equal(normalizeAiInput({mode:'action',prompt:'Напиши Артуру'}).mode,'action');
  assert.match(systemInstruction('action'),/DRAFT-ONLY/);
});
test('action validation fails closed on unsupported action, arbitrary tool calls and missing recipient',()=>{
  for(const data of [
    {intent:'send_message',recipientQuery:'Артур',message:'Hello'},
    {intent:'delete_all_chats',recipientQuery:'Артур',message:'Hello'},
    {intent:'publish_story',recipientQuery:'Артур',message:'Hello'}
  ])assert.throws(()=>normalizeAiOutput('action',JSON.stringify(data)),/AI_ACTION_UNSUPPORTED/);
  assert.throws(()=>normalizeAiOutput('action',JSON.stringify({
    intent:'draft_message',recipientQuery:'',message:'Hello'})),/AI_ACTION_FORMAT_INVALID/);
  assert.throws(()=>normalizeAiOutput('action',JSON.stringify({
    intent:'draft_message',recipientQuery:'Артур',message:'x'.repeat(4097)})),/AI_ACTION_FORMAT_INVALID/);
  assert.throws(()=>normalizeAiOutput('action','non JSON'),/AI_ACTION_FORMAT_INVALID/);
  assert.throws(()=>normalizeAiOutput('action',JSON.stringify({
    intent:'clarify',question:''})),/AI_ACTION_FORMAT_INVALID/);
});
test('missing target becomes a question without actionable draft',()=>{
  const answer=normalizeAiOutput('action',JSON.stringify({
    intent:'clarify',question:'Кому написать?'
  }));
  assert.equal(answer.action,null);
  assert.equal(answer.text,'Кому написать?');
});
test('recipient name matching stays local, explicit and never auto-selects',()=>{
  const dialogs=[
    chat('100','Артур Карапетян','artur_dev'),
    chat('101','Артур','artur_photo'),
    chat('102','Артём'),
    chat('103','Группа Артур и друзья'),
    {...chat('104','Артур'),archiveOnly:true},
    {...chat('105','Артур'),serverCanSend:false},
    {...chat('106','Артур'),type:'channel'}
  ];
  const matches=actionRecipientCandidates(dialogs,'Артур');
  assert.deepEqual(matches.map(row=>row.id),['101','100','103']);
  assert.ok(matches.every(row=>!('confirmed' in row)&&!('send' in row)));
  assert.deepEqual(actionRecipientCandidates(dialogs,'@artur_dev').map(x=>x.id),['100']);
  assert.deepEqual(actionRecipientCandidates(dialogs,'Несуществующее имя'),[]);
});
test('UI requires manual candidate selection, owner confirmation, existing send API',()=>{
  const client=source('public/vetogram-ai.js'),html=source('public/studio.html');
  const core=source('lib/vetogram-ai-core.js'),server=source('api/vetogram-ai.js');
  for(const id of ['vtaiActionPanel','vtaiActionStatus','vtaiActionFind',
    'vtaiActionMore','vtaiActionMatches','vtaiActionChoose'])
    assert.ok(html.includes('id="'+id+'"'),'missing '+id);
  assert.match(client,/state\.actionRecipientConfirmed=id/);
  assert.match(client,/if\(!actionRecipientReady\(chatId\)\)return notice/);
  assert.match(client,/if\(mode==='action'\)/);
  assert.match(client,/actionRecipientCandidates\(state\.dialogs/);
  assert.match(client,/vtaiActionChoose'\)\.addEventListener\('click',chooseActionRecipient\)/);
  assert.match(client,/vtaiRecipients'\)\.addEventListener\('change'/);
  assert.match(client,/window\.confirm\(/);
  assert.match(client,/action:'send_message',chatId,message,nonce/);
  assert.match(server,/requiresOwnerApproval:true/);
  assert.doesNotMatch(server,/getViewerSession|sendOwnerMessage|withBackupClient/);
  assert.match(core,/You are a DRAFT-ONLY Telegram message preparation assistant/);
});
test('AI Action is included in real quota estimates',()=>{
  const input=normalizeAiInput({mode:'action',prompt:'Напиши Артуру, что встречаемся завтра'});
  const units=estimateAiUnits(input,systemInstruction('action'));
  assert.ok(Number.isFinite(units)&&units>input.prompt.length);
});

test('explicit chat commands enter reviewed AI Action without hijacking writing requests',()=>{
  for(const prompt of [
    'Напиши Артуру, что завтра позвоню',
    'Отправь Марине, что встреча перенесена',
    'Сообщи Петру, чтобы он проверил документ',
    '/msg Артур: созвонимся завтра',
    '/message Maria: hello'
  ])assert.equal(isExplicitActionCommand(prompt),true,prompt);
  for(const prompt of [
    'Напиши мне, что ты думаешь',
    'Напиши код, что делает эта функция',
    'Напиши историю, что случилось дальше',
    'Расскажи про Telegram',
    'Отправь мне список советов',
    'Напиши Артуру'
  ])assert.equal(isExplicitActionCommand(prompt),false,prompt);
  const ui=source('public/vetogram-ai.js');
  assert.match(ui,/state\.mode==='chat'&&isExplicitActionCommand\(original\)/);
  assert.match(ui,/setMode\('action'\)/);
});
