import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 cleanSearchQuery,planSearch,peerChatId,searchResultsFromTelegram,mergeSearchResults,
} from '../lib/veto-intelligence-search.js';
import {afterMonths,searchOwnerCloud} from '../api/telegram-intelligence-search.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('natural-language question turns into bounded Telegram concept queries without outside AI',()=>{
 const plan=planSearch('Найди, где мы обсуждали квартиру в Дубае');
 assert.equal(plan.mode,'lexical-concept');
 assert.ok(plan.terms.length>0&&plan.terms.length<=2);
 assert.ok(plan.terms.some(q=>/дуба|dubai/i.test(q)));
 assert.equal(plan.months,0);
 const promises=planSearch('Какие обещания давали за последние три месяца?');
 assert.equal(promises.months,3);
 assert.ok(promises.terms.length<=2);
 assert.throws(()=>cleanSearchQuery(' '),/от 3 до 180/);
 assert.throws(()=>cleanSearchQuery('x'.repeat(181)),/от 3 до 180/);
 assert.throws(()=>cleanSearchQuery(42),/Введи текст/);
});

test('source IDs preserve Telegram peer-specific numeric prefixes',()=>{
 assert.equal(peerChatId({userId:123n}),'123');
 assert.equal(peerChatId({chatId:345n}),'-345');
 assert.equal(peerChatId({channelId:789n}),'-100789');
 assert.equal(peerChatId(null),'');
});

test('real returned Telegram message retains date, source and verbatim snippet; duplicates removed',()=>{
 const source={users:[{id:123n,firstName:'Anna',lastName:'K'}],chats:[],messages:[
   {id:44,date:1760791200,peerId:{userId:123n},message:'Мы обсуждали квартиру в Дубае',out:true,className:'Message'},
   {id:0,date:1760791200,peerId:{userId:123n},message:'invalid',className:'Message'},
   {id:50,date:1760791200,peerId:{userId:123n},message:'',className:'Message'},
 ]};
 const rows=searchResultsFromTelegram(source,'Дубае');
 assert.equal(rows.length,1);
 assert.equal(rows[0].chatTitle,'Anna K');
 assert.equal(rows[0].chatId,'123');
 assert.equal(rows[0].messageId,44);
 assert.equal(rows[0].snippet,'Мы обсуждали квартиру в Дубае');
 const merged=mergeSearchResults([rows,rows],planSearch('квартира в Дубае'),30);
 assert.equal(merged.length,1);
 assert.ok(merged[0].score>0);
 assert.equal(merged[0].snippet,rows[0].snippet);
});

test('server performs only bounded Telegram-native search with no LLM/third-party upload',async()=>{
 const requests=[];
 const client={invoke:async args=>{
   requests.push(args);
   return {messages:[{id:100,date:1760791200,peerId:{userId:123n},message:'Обещал встретиться',className:'Message'}],
     users:[{id:123n,firstName:'Anna'}],chats:[]};
 }};
 const results=await searchOwnerCloud(client,planSearch('обещание за последние три месяца'));
 assert.ok(results.length);
 assert.ok(requests.length<=2);
 assert.ok(requests.every(r=>r.className==='messages.SearchGlobal'));
 assert.ok(requests.every(r=>r.limit<=25&&r.minDate>0));
 assert.ok(afterMonths(3,new Date('2026-10-18T00:00:00Z'))>0);
 const api=read('api/telegram-intelligence-search.js');
 assert.match(api,/validateTelegramMiniApp/);
 assert.match(api,/sameTelegramAccount\(userId,session.telegram_account_user_id\)/);
 assert.match(api,/verifyTelegramClientOwner\(client,userId\)/);
 assert.match(api,/Cache-Control','private, no-store/);
 assert.doesNotMatch(api,/fetch\(|OpenAI|Anthropic|Gemini|console\.log|localStorage/);
});

test('UI is explicit, memory-only, identity-isolated and cites original message ID',()=>{
 const ui=read('public/telegram-chats.js'),html=read('public/studio.html'),css=read('public/veto-global-ui.css');
 assert.match(ui,/function clearIntelSearch\(\{close=false\}/);
 assert.match(ui,/state\.intelEpoch\+\+/);
 assert.match(ui,/clearIntelSearch\(\{close:true\}\)/);
 assert.match(ui,/\/api\/telegram-intelligence-search/);
 assert.match(ui,/ownerKey!==state\.ownerInitData/);
 assert.match(ui,/safe\(result\.snippet\|\|''\)/);
 assert.match(ui,/data-veto-intel-open/);
 assert.match(ui,/void openThread\(chat\)/);
 assert.match(html,/id="vetoIntelSearchForm"/);
 assert.match(html,/id="vetoIntelSearchResults"/);
 assert.match(html,/type="checkbox" id="vetoIntelIncludeVault"/);
 assert.match(css,/veto-intelligence-hit/);
 assert.doesNotMatch(ui,/indexedDB|localStorage|sessionStorage/);
});
