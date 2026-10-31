import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {shouldFetchLiveFirst} from '../api/telegram-chats.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('only initial, non-archived, owner-verified-request thread may defer archive',()=>{
 assert.equal(shouldFetchLiveFirst('thread',{fastLive:true},0,0),true);
 for(const [action,body,cursor,archive] of [
   ['list',{fastLive:true},0,0],
   ['thread',{fastLive:false},0,0],
   ['thread',{fastLive:true},35,0],
   ['thread',{fastLive:true},0,100],
   ['thread',{fastLive:true,archiveOnly:true},0,0],
   ['thread',{fastLive:true,liveExhausted:true},0,0],
   ['thread_archive',{fastLive:true},0,0],
 ]){
   assert.equal(shouldFetchLiveFirst(action,body,cursor,archive),false,
     'no first-paint bypass for '+action+'/'+JSON.stringify(body));
 }
});

test('server never disables saved-only fallback and keeps archive reads owner-scoped',()=>{
 const api=read('api/telegram-chats.js');
 assert.match(api,/\['list','thread','thread_archive'\]/);
 assert.match(api,/const owner=validateTelegramMiniApp/);
 assert.match(api,/if\(action==='thread_archive'\)/);
 const section=api.slice(api.indexOf("if(action==='thread_archive')"),api.indexOf("const permissionStatePromise"));
 assert.match(section,/archivedMessages\(userId,chatId,archiveOffset\)/);
 assert.doesNotMatch(section,/getDialogs|withBackupClient|client\.getMessages/);
 assert.match(api,/if\(!chat&&fastLive\)\{/);
 assert.match(api,/historyPromise=archiveThreads\(userId\)/);
 assert.match(api,/if\(creds\?\.session\)storedPromise=archivedMessages/);
 assert.match(api,/archiveDeferred:Boolean\(fastLive&&chat\)/);
 assert.match(api,/archivedMessageCount:fastLive&&chat\?null/);
 assert.match(api,/const \[stored,history\]=await Promise\.all/);
});

function makeArchiveHarness(requestImpl){
 const ui=read('public/telegram-chats.js');
 const start=ui.indexOf('async function mergeDeferredArchive(');
 const end=ui.indexOf('async function loadMessages(',start);
 assert.ok(start>=0&&end>start);
 const state={threadGeneration:4,ownerInitData:'owner-1',thread:{id:'7',savedCopy:true},
   messages:[{id:10,date:'2026-10-18T12:00:00Z',text:'Live',out:false},
             {id:11,date:'2026-10-18T12:01:00Z',text:'Only live'}],
   archiveOffset:0,archiveHasMore:false,liveHasMore:true,threadHasMore:true};
 const env={state,request:requestImpl,AbortController,
   tg:{initData:"owner-1"},
   resetOwner:()=>false,visibleMessageAnchor:()=>null,
   renderMessages:()=>{env.renders++},rememberHotThread:()=>{},
   threadNotice:message=>{env.notice=message},renders:0,notice:''};
 env.env=env;
 runInNewContext(`const {state,request,resetOwner,visibleMessageAnchor,renderMessages,rememberHotThread,threadNotice}=env;\n`+
   ui.slice(start,end)+'\nthis.mergeDeferredArchive=mergeDeferredArchive;',env);
 return env;
}

test('deferred archive merges saved/deleted evidence without erasing live history',async()=>{
 const env=makeArchiveHarness(async action=>{
   assert.equal(action,'thread_archive');
   return {messages:[
     {id:10,date:'2026-10-18T12:00:00Z',text:'Stored',deleted:true,saved:true,mediaAvailable:true},
     {id:8,date:'2026-10-18T11:59:00Z',text:'Old copy',deleted:true,saved:true}],
     archiveHasMore:true,archiveNextOffset:2};
 });
 await env.mergeDeferredArchive('7',4,'owner-1');
 assert.deepEqual([...env.state.messages.map(x=>x.id)],[8,10,11]);
 assert.equal(env.state.messages[1].text,'Live');
 assert.equal(env.state.messages[1].deleted,true);
 assert.equal(env.state.messages[1].saved,true);
 assert.equal(env.state.messages[0].preservedOnly,true);
 assert.equal(env.state.archiveHasMore,true);
 assert.equal(env.state.archiveOffset,2);
 assert.equal(env.renders,1);
});

test('late archive result cannot leak previous account or different thread',async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r});
 const env=makeArchiveHarness(()=>pending);
 const loading=env.mergeDeferredArchive('7',4,'owner-1');
 env.state.ownerInitData='owner-2';env.state.thread={id:'8'};env.state.threadGeneration=6;
 resolve({messages:[{id:12,text:'private previous owner'}],archiveNextOffset:1});
 await loading;
 assert.equal(env.state.messages.some(x=>x.text==='private previous owner'),false);
 assert.equal(env.renders,0);
});
