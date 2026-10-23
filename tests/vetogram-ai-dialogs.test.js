import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeSendableDialogs,shouldContinueDialogLookup,hasMoreDialogPages,
  MAX_DIALOG_PAGES,MAX_OWNER_DIALOGS} from '../public/vetogram-ai-dialogs-core.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const chat=(id,type='private')=>({id:String(id),title:'Dialog '+id,type});

test('Telegram AI recipient pages deduplicate and omit archived non-sendable copies',()=>{
  const rows=mergeSendableDialogs([chat('1'),chat('2')],[
    chat('2'),chat('3'),{...chat('4'),archiveOnly:true},
    {...chat('5'),serverCanSend:false},chat('6','channel'),
    {...chat('7'),type:'group'},chat('8','saved')
  ]);
  assert.deepEqual(rows.map(x=>x.id),['1','2','3','7','8']);
  assert.equal(mergeSendableDialogs([],null).length,0);
  assert.equal(mergeSendableDialogs([chat('1')],[chat('@username')]).length,1);
});
test('AI cannot scan all dialogs unless an owner-selected target is missing',()=>{
  assert.equal(shouldContinueDialogLookup(1,true,null,[chat('1')]),false);
  assert.equal(shouldContinueDialogLookup(1,true,'999',[chat('1')]),true);
  assert.equal(shouldContinueDialogLookup(2,true,'999',[chat('999')]),false);
  assert.equal(shouldContinueDialogLookup(2,false,'999',[]),false);
  assert.equal(shouldContinueDialogLookup(MAX_DIALOG_PAGES,true,'999',[]),false);
  assert.equal(hasMoreDialogPages(1,true),true);
  assert.equal(hasMoreDialogPages(MAX_DIALOG_PAGES,true),false);
  assert.equal(MAX_DIALOG_PAGES,11);
  assert.equal(MAX_OWNER_DIALOGS,500);
});
test('recipient loading respects backend 500-dialog cap and excludes invalid ids',()=>{
  const all=Array.from({length:600},(_,i)=>chat(i+1));
  const merged=mergeSendableDialogs([],all);
  assert.equal(merged.length,500);
  assert.equal(merged.at(-1).id,'500');
  assert.equal(shouldContinueDialogLookup(10,true,'599',merged),true);
  assert.equal(shouldContinueDialogLookup(11,true,'599',merged),false);
});
test('AI UI paginates only account-owned dialog metadata and not message content',()=>{
  const client=source('public/vetogram-ai.js'),html=source('public/studio.html');
  const server=source('api/telegram-chats.js');
  assert.match(client,/action:'list',page/);
  assert.match(client,/mergeSendableDialogs\(merged,result.chats\)/);
  assert.match(client,/shouldContinueDialogLookup\(page,hasMore,validTarget,merged\)/);
  assert.match(client,/loadChats\(\{seekChatId:item.chatId\}\)/);
  assert.match(client,/loadChats\(\{more:true\}\)/);
  for(const id of ['vtaiMoreChats','vtaiNegMoreChats'])
    assert.ok(html.includes('id="'+id+'"'));
  assert.match(server,/export function dialogPageBounds/);
  assert.doesNotMatch(client,/action:'thread'[^}]*page/);
});
