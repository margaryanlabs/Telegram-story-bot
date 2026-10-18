import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planSearch} from '../lib/veto-intelligence-search.js';
import {
 archiveEvidenceScore,normalizeOwnerArchive,prioritizeArchiveThreads,
 isCommitmentQuestion,possibleCommitment,mergeEvidence,evidenceTimeline,
} from '../lib/veto-evidence-timeline.js';
import {VAULT_MAX_CHATS,VAULT_MESSAGES_PER_CHAT} from '../api/telegram-intelligence-search.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Vault retrieval only considers bounded newest owner-saved threads',()=>{
 const rows=Array.from({length:12},(_,i)=>({
   chatId:String(i+1),messageCount:100,
   lastAt:new Date(Date.UTC(2026,9,18-i)).toISOString(),title:'Чат '+i,
 }));
 const picked=prioritizeArchiveThreads(rows,6);
 assert.equal(picked.length,6);
 assert.equal(picked[0].chatId,'1');
 assert.equal(picked[5].chatId,'6');
 assert.equal(VAULT_MAX_CHATS,6);
 assert.equal(VAULT_MESSAGES_PER_CHAT,60);
 assert.deepEqual(prioritizeArchiveThreads([{chatId:'naughty',messageCount:90}],6),[]);
});

test('archive matches topical messages but never invents an earlier deleted copy',()=>{
 const plan=planSearch('квартира в Дубае');
 const thread={chatId:'12345',title:'Товарищ',messageCount:2};
 const row={message_id:98,text_content:'Разговор о квартире в Дубае, завтра уточню',
   sent_at:'2026-10-15T15:00:00Z',direction:'incoming',sender_display_name:'Друг',deleted_at:null};
 const found=normalizeOwnerArchive(row,thread,plan);
 assert.ok(found);
 assert.equal(found.source,'veto-vault');
 assert.equal(found.sender,'Друг');
 assert.equal(found.chatId,'12345');
 assert.equal(found.messageId,98);
 assert.equal(found.snippet,row.text_content);
 assert.equal(found.deleted,false);
 assert.equal(found.possibleCommitment,false);
 assert.equal(normalizeOwnerArchive({...row,text_content:'Другая история'},thread,plan),null);
 assert.equal(normalizeOwnerArchive(row,thread,plan,Date.parse('2026-10-16')),null);
 assert.equal(normalizeOwnerArchive({...row,message_id:'999999999999999999999'},thread,plan),null);
});

test('possible promises are labeled as leads, not legally proven obligations',()=>{
 const plan=planSearch('Какие обещания давали за последние три месяца?');
 const row={message_id:13,deleted_at:'2026-10-18T00:00:00Z',
   sent_at:'2026-10-01T19:00:00Z',direction:'incoming',sender_display_name:'Анна',
   text_content:'Я верну деньги в пятницу'};
 const saved=normalizeOwnerArchive(row,{chatId:'777',title:'Анна',messageCount:22},plan);
 assert.equal(saved?.deleted,true);
 assert.equal(saved?.possibleCommitment,true);
 assert.equal(isCommitmentQuestion(plan.query),true);
 assert.equal(possibleCommitment('Привет, как дела?'),false);
 const timeline=evidenceTimeline([saved],plan);
 assert.equal(timeline.length,1);
 assert.equal(timeline[0].sender,'Анна');
 assert.match(timeline[0].label,/Возможное обещание/);
 assert.equal(timeline[0].snippet,row.text_content);
 assert.ok(archiveEvidenceScore(row.text_content,'Анна',plan)>0);
 assert.deepEqual(evidenceTimeline([saved],planSearch('квартира в Дубае')),[]);
});

test('same cloud and Vault message merges once with reliable deletion provenance',()=>{
 const cloud=[{chatId:'777',messageId:13,snippet:'Я верну деньги в пятницу',
   source:'telegram-cloud',score:9,out:false,chatTitle:'Анна',date:'2026-10-01T19:00:00Z'}];
 const saved=[{...cloud[0],source:'veto-vault',deleted:true,saved:true,
   sender:'Анна',possibleCommitment:true,score:8}];
 const merged=mergeEvidence(cloud,saved,planSearch('Какие обещания давали?'));
 assert.equal(merged.length,1);
 assert.equal(merged[0].source,'telegram-cloud+veto-vault');
 assert.equal(merged[0].saved,true);
 assert.equal(merged[0].deleted,true);
 assert.equal(merged[0].snippet,cloud[0].snippet);
 assert.equal(evidenceTimeline(merged,planSearch('Какие обещания давали?')).length,1);
});

test('group evidence never attributes a promise to group title without sender evidence',async()=>{
 const {searchResultsFromTelegram}=await import('../lib/veto-intelligence-search.js');
 const group={chats:[{id:201n,title:'Команда'}],users:[{id:17n,firstName:'Мария'}],
   messages:[
    {id:4,peerId:{chatId:201n},fromId:{userId:17n},message:'Я оплачу завтра',date:1760791200,className:'Message'},
    {id:5,peerId:{chatId:201n},message:'Верну потом',date:1760791300,className:'Message'},
   ]};
 const evidence=searchResultsFromTelegram(group,'оплачу');
 assert.equal(evidence.length,2);
 assert.equal(evidence[0].sender,'Мария');
 assert.equal(evidence[1].sender,'Автор не определён');
 assert.equal(evidence[0].chatTitle,'Команда');
});
test('signed server uses opt-in Vault search, never silently indexes all chats or exports data',()=>{
 const api=read('api/telegram-intelligence-search.js');
 const ui=read('public/telegram-chats.js');
 const html=read('public/studio.html');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/const includeVault=body\?\.includeVault===true/);
 assert.match(api,/listPrivacyThreads\(userId\)/);
 assert.match(api,/listPrivacyMessages\(userId,String\(thread.chatId\),VAULT_MESSAGES_PER_CHAT,0\)/);
 assert.match(api,/Promise\.allSettled/);
 assert.match(api,/chatsScanned:vault\?\.scannedChats/);
 assert.match(api,/if\(!cloudOk&&\(!includeVault\|\|!vaultOk\)\)/);
 assert.match(api,/Cache-Control','private, no-store/);
 assert.doesNotMatch(api,/OpenAI|Anthropic|Gemini|vector|embedding|storeResults|localStorage/);
 assert.match(ui,/const includeVault=\$\('vetoIntelIncludeVault'\)\?\.checked===true/);
 assert.match(ui,/JSON\.stringify\(\{query,includeVault\}\)/);
 assert.match(ui,/clearIntelSearch\(\{close:true\}\)/);
 assert.match(ui,/renderIntelTimeline\(\)/);
 assert.match(ui,/type:result.source==='veto-vault'\?'copy'/);
 assert.match(html,/type="checkbox" id="vetoIntelIncludeVault"/);
 assert.match(html,/id="vetoIntelTimelineSection"/);
 assert.doesNotMatch(ui,/indexedDB|localStorage|sessionStorage/);
});
