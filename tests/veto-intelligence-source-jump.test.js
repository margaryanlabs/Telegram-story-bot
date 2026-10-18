import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSourceRequest,exactVaultMessage,preservedMessage,CONTEXT_MAX_VAULT_OFFSET} from '../api/telegram-message-context.js';
import {localSemanticScore,meaningfulTokens,conceptFamilies} from '../lib/veto-local-semantic.js';
import {archiveEvidenceScore,mergeEvidence} from '../lib/veto-evidence-timeline.js';
import {mergeSearchResults} from '../lib/veto-intelligence-search.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('jump parameters reject forged IDs, wrong source and incorrect archive offsets',()=>{
  assert.deepEqual(validateSourceRequest({chatId:'-100774',messageId:801,source:'telegram-cloud'}),
    {chatId:'-100774',messageId:801,source:'telegram-cloud',vaultOffset:undefined});
  assert.equal(validateSourceRequest({chatId:'123',messageId:2,source:'veto-vault',vaultOffset:0}).vaultOffset,0);
  assert.equal(CONTEXT_MAX_VAULT_OFFSET,5000);
  for(const payload of [
    {chatId:'999',messageId:2,source:'veto-vault'},
    {chatId:'999',messageId:2,source:'veto-vault',vaultOffset:-1},
    {chatId:'999',messageId:2,source:'veto-vault',vaultOffset:5001},
    {chatId:'999',messageId:2,source:'veto-vault',vaultOffset:'8'},
    {chatId:'999',messageId:0,source:'telegram-cloud'},
    {chatId:'x/100',messageId:5,source:'telegram-cloud'},
    {chatId:'999',messageId:5,source:'admin'},
  ])assert.throws(()=>validateSourceRequest(payload),/Некорректная|точного смещения/);
});
test('source excerpt from saved Vault uses exact message, never adjacent unrelated row',()=>{
 const row={message_id:12,text_content:'Я верну завтра',sent_at:'2026-10-18T08:00:00Z',
   direction:'incoming',sender_display_name:'Контакт',deleted_at:'2026-10-18'};
 const normalized=preservedMessage(row);
 assert.equal(normalized.id,12);
 assert.equal(normalized.text,'Я верну завтра');
 assert.equal(normalized.deleted,true);
 assert.equal(normalized.sourceIsolated,true);
 const api=read('api/telegram-message-context.js');
 assert.match(api,/listPrivacyMessages\(userId,chatId,3,offset\)/);
 assert.match(api,/rows.find\(row=>Number\(row.message_id\)===messageId\)/);
 assert.match(api,/return found\?preservedMessage\(found\):null/);
});
test('source is always owner-authorized again before direct reading of cloud or Vault',()=>{
 const api=read('api/telegram-message-context.js');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/getViewerSession\(userId\)/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/client.getMessages\(dialog.entity,\{ids:\[messageId\]\}\)/);
 assert.match(api,/if\(!dialog\)return null/);
 assert.match(api,/if\(!message\)return response\(res,404/);
 assert.match(api,/Cache-Control','private, no-store/);
 assert.doesNotMatch(api,/OpenAI|Gemini|Anthropic|publicUrl|localStorage|signedUrl/);
});
test('search retains precise position of archived original after dedupe',()=>{
 const source=read('api/telegram-intelligence-search.js');
 const timeline=read('lib/veto-evidence-timeline.js');
 const ui=read('public/telegram-chats.js');
 assert.match(source,/vaultOffset:task.offset\+index/);
 assert.match(timeline,/vaultOffset:Number.isSafeInteger\(item.vaultOffset\)/);
 assert.match(ui,/vaultOffset:Number.isSafeInteger\(item.vaultOffset\)/);
 assert.match(ui,/highlightIntelSource\(chatId,messageId\)/);
 assert.match(ui,/sourceIsolated:true/);
 assert.match(ui,/\/api\/telegram-message-context/);
 assert.match(ui,/ownerKey!==String\(tg\?\.initData\|\|''\)/);
 assert.match(ui,/generation!==state.threadGeneration/);
 assert.match(ui,/veto-intel-exact-source/);
});
test('local concept relevance matches paraphrases, does not create evidence',()=>{
 assert.deepEqual(meaningfulTokens('Когда?'),[]);
 assert.ok(conceptFamilies('погашение долга').includes('repayment'));
 const score=localSemanticScore('Он обещал вернуть долг','Завтра отдам деньги');
 assert.ok(score.score>0,'repayment cues are close concepts');
 assert.equal(localSemanticScore('квартира','Привет как дела').score,0);
 assert.equal(archiveEvidenceScore('Платёж уже оплачен','Чат',{query:'денежный перевод',terms:[]})>0,true);
 const result=mergeSearchResults([[{chatId:'1',messageId:2,snippet:'Сдаю квартиру',chatTitle:'Аренда',term:'квартира'}]],
   {query:'жильё',terms:['жильё']},20);
 assert.equal(result.length,1);
 assert.ok(result[0].score>0);
 const merged=mergeEvidence([{chatId:'10',messageId:4,snippet:'Переведу завтра',score:4}],
   [{chatId:'10',messageId:4,snippet:'Переведу завтра',score:3,source:'veto-vault',vaultOffset:410,deleted:true}],{},30);
 assert.equal(merged[0].vaultOffset,410);
});
