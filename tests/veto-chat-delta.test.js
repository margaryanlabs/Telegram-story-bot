import test from 'node:test';
import assert from 'node:assert/strict';
import {chatDelta,chatRowFingerprint} from '../api/telegram-chats.js';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const rows=[
  {id:'1',title:'First',type:'private',preview:'Hi',date:'2026-10-17T08:00:00Z',unreadCount:1},
  {id:'2',title:'Second',type:'group',preview:'Hello',date:'2026-10-17T07:00:00Z',unreadCount:2},
];
test('first verified list is complete with SHA-256 owner-only revision hints',()=>{
  const result=chatDelta(rows,[]);
  assert.equal(result.delta,null);
  assert.equal(result.chats.length,2);
  assert.match(result.chats[0].rowHash,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.chats[0].rowHash,chatRowFingerprint(rows[0]));
});
test('a repeat signed refresh returns zero rows when all known dialogs remain unchanged',()=>{
  const first=chatDelta(rows,[]).chats;
  const second=chatDelta(rows,first.map(({id,rowHash})=>({id,rowHash})));
  assert.equal(second.chats.length,0);
  assert.deepEqual(second.delta.orderedIds,['1','2']);
  assert.deepEqual(second.delta.removedIds,[]);
});
test('only modified rows traverse delta response; removed or newly inserted dialogs are reconciled',()=>{
  const prior=chatDelta(rows,[]).chats;
  const next=[
    {...rows[0],unreadCount:10},
    {id:'3',title:'New chat',type:'bot',date:'2026-10-17T09:00:00Z',unreadCount:0},
  ];
  const updated=chatDelta(next,prior.map(({id,rowHash})=>({id,rowHash})));
  assert.deepEqual(updated.chats.map(x=>x.id),['1','3']);
  assert.deepEqual(updated.delta.orderedIds,['1','3']);
  assert.deepEqual(updated.delta.removedIds,['2']);
});
test('hashes ignore invalid client data, include meaningful changes and never write preview into cache',()=>{
  assert.notEqual(chatRowFingerprint(rows[0]),chatRowFingerprint({...rows[0],preview:'Changed'}));
  assert.notEqual(chatRowFingerprint(rows[0]),chatRowFingerprint({...rows[0],nativeUrl:'https://t.me/someone'}));
  const rowsHashed=chatDelta(rows,[{id:'1',rowHash:'faked'},
    {id:'2',rowHash:'a'.repeat(43)},{id:'4',rowHash:'a'.repeat(43)}]);
  assert.equal(rowsHashed.chats.length,2);
  assert.deepEqual(rowsHashed.delta.removedIds,['4']);
  const api=read('api/telegram-chats.js'),ui=read('public/telegram-chats.js');
  assert.ok(api.includes('const update=chatDelta(rendered,page===0?body.known:[])'));
  assert.ok(ui.includes('data.delta?.orderedIds'));
  assert.ok(ui.includes('if(rebuilt.some(row=>!row))'));
  assert.ok(ui.includes("request('list',{page:state.page})"));
  assert.ok(ui.includes("state.chats.filter(row=>/^[A-Za-z0-9_-]{43}$/.test"));
  assert.ok(!read('public/chat-snapshot-cache.js').includes('rowHash:'));
});
