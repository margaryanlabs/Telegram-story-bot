import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Evaluate actual source from the Mini App, without network/Telegram/session.
const core=readFileSync(new URL('../public/vetogram-inbox-pulse-core.js',import.meta.url),'utf8');
const chats=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-experience-2026.css',import.meta.url),'utf8');
const win={};
vm.runInNewContext(core,{window:win});
const {summarize}=win.VetogramInboxPulse;

test('Pulse counts only distinct loaded chats without pretending to have all Telegram history',()=>{
  const value=summarize([
    {id:'a',unreadCount:7,inbox:{needsAttention:true},savedCopy:true,deletedCount:3},
    {id:'a',unreadCount:7,inbox:{needsAttention:true},savedCopy:true,deletedCount:3},
    {id:'b',unreadCount:0,inbox:{needsAttention:false},savedCopy:true,deletedCount:2},
    {id:'c',unreadCount:1,inbox:{needsAttention:true},savedCopy:false,deletedCount:44},
    {id:'d',unreadCount:0,savedCopy:false}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(value)),{
    loaded:4,unreadChats:2,attentionChats:2,savedChats:2,deletedMessages:5
  });
});
test('invalid/negative/overflow unread and deleted counts cannot pollute totals',()=>{
  const result=summarize([
    {id:'a',unreadCount:-30,savedCopy:true,deletedCount:-1},
    {id:'b',unreadCount:'not-a-number',savedCopy:true,deletedCount:Infinity},
    {id:'c',unreadCount:'2',savedCopy:true,deletedCount:1.7},
    null,{unreadCount:5},{id:null}
  ]);
  assert.equal(result.loaded,3);
  assert.equal(result.unreadChats,1);
  assert.equal(result.savedChats,3);
  assert.equal(result.deletedMessages,1);
  assert.deepEqual(JSON.parse(JSON.stringify(summarize(null))),{
    loaded:0,unreadChats:0,attentionChats:0,savedChats:0,deletedMessages:0
  });
});
function fixture(){
  const node=new Map();
  const tiles=['unread','focus','copies'].map(filter=>({
    dataset:{vgxPulseFilter:filter},attributes:{},classList:{active:false,
      toggle(name,value){if(name==='active')this.active=value}},
    setAttribute(name,value){this.attributes[name]=value}
  }));
  const get=id=>{
    if(!node.has(id))node.set(id,{hidden:true,textContent:'',
      querySelectorAll:()=>tiles});
    return node.get(id);
  };
  const state={filter:'all',chats:[]};
  const start=chats.indexOf('function renderInboxPulse(');
  const end=chats.indexOf('function renderChats(',start);
  assert.ok(start>0&&end>start);
  const fn=vm.runInNewContext('('+chats.slice(start,end).trim()+')',
    {window:win,state,$:get});
  return {state,get,tiles,fn};
}
test('UI renders real counters, marks selected filter and wipes old owner counts',()=>{
  const f=fixture();
  f.state.filter='focus';
  f.state.chats=[
    {id:'1',unreadCount:1,inbox:{needsAttention:true},savedCopy:true,deletedCount:4},
    {id:'2',unreadCount:0,savedCopy:false}
  ];
  f.fn();
  assert.equal(f.get('vgxInboxPulse').hidden,false);
  assert.equal(f.get('vgxPulseUnread').textContent,'1');
  assert.equal(f.get('vgxPulseFocus').textContent,'1');
  assert.equal(f.get('vgxPulseDeleted').textContent,'4');
  assert.equal(f.tiles[1].attributes['aria-pressed'],'true');
  f.state.chats=[]; // Signed identity switched: resetOwner clears all chat data.
  f.fn();
  assert.equal(f.get('vgxInboxPulse').hidden,true);
  assert.equal(f.get('vgxPulseDeleted').textContent,'0');
  assert.equal(f.get('vgxPulseFocus').textContent,'0');
  assert.equal(f.get('vgxPulseUnread').textContent,'0');
});
test('all Pulse actions reuse existing chat filters, not synthetic requests',()=>{
  for(const kind of ['unread','focus','copies']){
    assert.match(html,new RegExp('data-vgx-pulse-filter="'+kind+'"'));
    assert.match(html,new RegExp('data-mirror-filter="'+kind+'"'));
  }
  assert.ok(html.indexOf('/vetogram-inbox-pulse-core.js')<
    html.indexOf('/telegram-chats.js'));
  assert.match(chats,/\$\('vgxInboxPulse'\)\?\.addEventListener\('click',event=>\{/);
  assert.match(chats,/if\(!button\|\|resetOwner\(\)\)return/);
  assert.match(chats,/\['unread','focus','copies'\]\.includes\(filter\)/);
  assert.match(chats,/\[data-mirror-filter="'\+filter\+'"\]'\)\?\.click\(\)/);
});
test('premium Pulse is accessible, compact, responsive and not exposed when hidden',()=>{
  assert.match(html,/id="vgxInboxPulse"[^>]*hidden/);
  assert.match(html,/Только загруженные чаты/);
  assert.match(css,/#telegramMirror \.vgx-inbox-pulse\[hidden\]\{display:none!important\}/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:365px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
