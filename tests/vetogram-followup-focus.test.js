import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {followupCandidates,FOLLOWUP_FOCUS_LIMIT} from '../public/vetogram-followup-core.js';
import {dialogInfo,decorateRemote,archivedDialog} from '../api/telegram-chats.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const row=(id,extra={})=>({
  id:String(id),title:'Chat '+id,type:'private',date:'2026-10-23T10:00:00Z',
  preview:'Можешь подтвердить встречу завтра?',unreadCount:2,
  lastMessageOut:false,previewFromArchive:false,
  inbox:{needsAttention:true,question:true,action:true,score:70},...extra
});
test('Follow-up Focus recommends only live inbound unread previews',()=>{
  const good=row(1),others=[
    row(2,{lastMessageOut:true}),row(3,{lastMessageOut:null}),
    row(4,{previewFromArchive:true}),row(5,{archiveOnly:true}),
    row(6,{unreadCount:0}),row(7,{type:'channel'}),
    row(8,{serverCanSend:false}),row(9,{inbox:{needsAttention:false,question:true,action:true,score:70}}),
    row(10,{inbox:{needsAttention:true,question:false,action:false,score:70}}),
    row(11,{preview:''}),row('@wrong')
  ];
  const result=followupCandidates([good,...others]);
  assert.deepEqual(result.map(x=>x.id),['1']);
  assert.equal(result[0].reason,'Возможны вопрос и действие');
});
test('Ranking is stable and does not contain auto-send or AI commands',()=>{
  const first=row(12,{inbox:{needsAttention:true,question:true,action:false,score:40}});
  const next=row(13,{inbox:{needsAttention:true,question:false,action:true,score:80}});
  const result=followupCandidates([first,next,next]);
  assert.deepEqual(result.map(x=>x.id),['13','12']);
  assert.deepEqual(Object.keys(result[0]),['id','title','preview','unread','flags','score','timestamp','reason']);
  assert.ok(!('send' in result[0]));
  assert.equal(followupCandidates([next],{hiddenIds:['13']}).length,0);
  assert.equal(followupCandidates([next],{limit:0}).length,1); // zero falls back to safe default
});
test('Loaded list is capped at eight, and not treated as conversation history',()=>{
  const items=Array.from({length:40},(_,i)=>row(i+1));
  const result=followupCandidates(items);
  assert.equal(result.length,FOLLOWUP_FOCUS_LIMIT);
  assert.ok(result.every(x=>x.preview.length<=180));
  assert.deepEqual(followupCandidates([],{}),[]);
});
test('Telegram API marks true message direction and distinguishes archive previews',()=>{
  const api=read('api/telegram-chats.js');
  assert.match(api,/lastMessageOut:typeof d\?\.message\?\.out==='boolean'/);
  assert.match(api,/previewFromArchive:false/);
  assert.match(api,/previewFromArchive:preservedIsNewer/);
  assert.match(api,/lastMessageOut:preservedIsNewer\?null:chat.lastMessageOut/);
  const archived=archivedDialog({chatId:'123',preview:'Удалённая копия',messageCount:1});
  assert.equal(archived.archiveOnly,true);
  assert.equal(archived.previewFromArchive,true);
});
test('Focus user actions stay local until separate provider consent',()=>{
  const js=read('public/vetogram-ai.js'),html=read('public/studio.html');
  for(const id of ['vtaiFocusPanel','vtaiFocusRefresh','vtaiFocusCount',
    'vtaiFocusStatus','vtaiFocusList','vtaiFocusMore','vtaiFocusRestore'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(js,/followupCandidates\(state\.dialogs/);
  assert.match(js,/vtaiFocusRefresh'\)\.addEventListener\('click',\(\)=>void loadChats\(\)\)/);
  assert.match(js,/vtaiFocusMore'\)\.addEventListener\('click',\(\)=>void loadChats\(\{more:true\}\)\)/);
  assert.match(js,/window\.confirm\('Скопировать только последний предпросмотр/);
  assert.match(js,/vtaiConsent'\)\.checked=false/);
  assert.match(js,/analyze\.textContent='Найти договорённости'/);
  assert.match(js,/setMode\('brief'\)/);
  assert.match(js,/state\.brief=null;state\.last=null;state\.sendIntent=null/);

  assert.match(js,/state\.focusHidden\.clear\(\)/);
  assert.match(js,/state\.last=null;state\.sendIntent=null;state\.reviewedApprovalId=null/);
  assert.doesNotMatch(js,/autoReply|autoRead|automaticFollowup|sendBackground/);
});
