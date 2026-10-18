import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planVaultPage,validVaultPage,VAULT_BATCH_READS,VAULT_ROWS_PER_READ,VAULT_MAX_PAGE,VAULT_MAX_CHAT_ROWS} from '../lib/veto-vault-pagination.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('manual scan progresses across full offsets in a single saved chat',()=>{
 const rows=[{chatId:'111',title:'A',messageCount:1120,lastAt:'2026-10-18T10:00:00Z'}];
 const first=planVaultPage(rows,0);
 assert.equal(first.tasks.length,VAULT_BATCH_READS);
 assert.deepEqual(first.tasks.map(t=>t.offset),[0,80,160,240,320,400]);
 assert.equal(first.nextPage,1);
 const second=planVaultPage(rows,1);
 assert.deepEqual(second.tasks.map(t=>t.offset),[480,560,640,720,800,880]);
 const last=planVaultPage(rows,2);
 assert.deepEqual(last.tasks.map(t=>t.offset),[960,1040]);
 assert.equal(last.nextPage,null);
 assert.equal(last.exhausted,true);
 assert.equal(first.totalSlices,14);
});
test('scan automatically continues into other owner-saved chats',()=>{
 const rows=Array.from({length:9},(_,i)=>({
   chatId:String(i+1),messageCount:80,title:'Chat '+i,
   lastAt:new Date(Date.UTC(2026,9,18-i)).toISOString()
 }));
 const a=planVaultPage(rows,0),b=planVaultPage(rows,1);
 assert.deepEqual(a.tasks.map(x=>x.thread.chatId),['1','2','3','4','5','6']);
 assert.deepEqual(b.tasks.map(x=>x.thread.chatId),['7','8','9']);
 assert.equal(a.nextPage,1);
 assert.equal(b.nextPage,null);
 assert.equal(a.availableChats,9);
});
test('exact final slice, invalid pagination, and bounded large archive',()=>{
 const a=planVaultPage([{chatId:'-10012',messageCount:95}],0);
 assert.deepEqual(a.tasks.map(t=>t.limit),[80,15]);
 for(const bad of [-1,VAULT_MAX_PAGE+1,'1',2.5,null,NaN]){
   assert.equal(validVaultPage(bad),false);
   assert.throws(()=>planVaultPage([],bad),/Неверная страница/);
 }
 const big=planVaultPage([{chatId:'22',messageCount:500000}],0);
 assert.ok(big.totalSlices<=Math.ceil(VAULT_MAX_CHAT_ROWS/VAULT_ROWS_PER_READ));
 assert.equal(big.truncated,true);
 const huge=Array.from({length:600},(_,i)=>({chatId:String(i+1),messageCount:1000}));
 assert.ok(planVaultPage(huge,0).truncated);
});
test('pagination never crosses accounts or writes a persistent message index',()=>{
 const api=read('api/telegram-intelligence-search.js'),ui=read('public/telegram-chats.js');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/listPrivacyMessages\(userId,String\(task.thread.chatId\),task.limit,task.offset\)/);
 assert.match(api,/const vaultPage=body\?\.vaultPage===undefined\?0:body.vaultPage/);
 assert.match(api,/if\(!validVaultPage\(vaultPage\)/);
 assert.match(api,/vaultPage===0\?searchOwnerCloud\(client,plan\):Promise.resolve\(\[\]\)/);
 assert.match(ui,/query!==state.intelQuery/);
 assert.match(ui,/state.intelNextPage=null/);
 assert.match(ui,/JSON.stringify\(\{query,includeVault,vaultPage\}\)/);
 assert.match(ui,/vetoIntelLoadMore/);
 assert.doesNotMatch(api,/localStorage|indexedDB|storeResults|console.log/);
});
