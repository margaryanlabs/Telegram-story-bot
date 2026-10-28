import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const chats=read('telegram-chats.js');
const css=read('vetogram-finish-2026.css');
const html=read('studio.html');

const start=chats.indexOf('    const savedPosition=state.inboxReturn;');
const end=chats.indexOf('    // Show cached chat list instantly',start);
assert.ok(start>0&&end>start,'Must test actual inbox return controller');
const actualController=chats.slice(start,end);

function fixture({owner='signed-1',savedOwner='signed-1',chatOpen=false,hidden=false,
  snapshot=true,withFrame=true}={}){
  const events=[],frames=[];
  const selected={dataset:{mirrorChat:'chat-42'},focus:opts=>events.push(['focus',opts.preventScroll])};
  const view={hidden,scrollTop:0};
  const list={scrollTop:0,querySelectorAll:selector=>{
    assert.equal(selector,'[data-mirror-chat]');
    return [selected,{dataset:{mirrorChat:'chat-1'},focus(){throw Error('wrong chat')}}];
  }};
  const state={
    inboxReturn:snapshot?{ownerKey:savedOwner,windowY:870,viewY:56,listY:113,chatId:'chat-42'}:null,
    ownerInitData:owner,thread:chatOpen?{id:'open-again'}:null
  };
  const window={
    scrollTo:opts=>events.push(['scroll',opts.top,opts.behavior]),
    ...(withFrame?{requestAnimationFrame:fn=>frames.push(fn)}:{})
  };
  runInNewContext(actualController,{state,window,tg:{initData:owner},
    $:id=>id==='telegramChatsView'?view:id==='telegramMirrorList'?list:null});
  return {events,frames,view,list};
}

test('Back returns to same position and focuses selected actual chat without shifting scroll',()=>{
  const f=fixture();
  assert.equal(f.frames.length,1);
  assert.equal(f.events.length,0,'scroll must happen after layout settles');
  f.frames[0]();
  assert.equal(f.view.scrollTop,56);
  assert.equal(f.list.scrollTop,113);
  assert.deepEqual(f.events,[['scroll',870,'instant'],['focus',true]]);
});
test('Back does not restore previous position after Telegram owner changes',()=>{
  const f=fixture({savedOwner:'different-account'});
  f.frames[0]();
  assert.deepEqual(f.events,[]);
  assert.equal(f.view.scrollTop,0);
  assert.equal(f.list.scrollTop,0);
  assert.match(chats,/state\.chats=\[\];state\.messages=\[\];state\.thread=null;[^\n]*state\.inboxReturn=null/);
});
test('queued Back frame cannot steal focus from reopened conversation',()=>{
  const f=fixture({chatOpen:true});
  f.frames[0]();
  assert.deepEqual(f.events,[]);
  const hidden=fixture({hidden:true});
  hidden.frames[0]();
  assert.deepEqual(hidden.events,[]);
});
test('Back safely handles no snapshot and browsers without animation frames',()=>{
  const noSnapshot=fixture({snapshot:false});
  noSnapshot.frames[0]();
  assert.deepEqual(noSnapshot.events,[]);
  const fallback=fixture({withFrame:false});
  assert.deepEqual(fallback.events,[['scroll',870,'instant'],['focus',true]]);
});
test('navigation motion runs on actual visibility transitions only and never message polling',()=>{
  assert.match(chats,/\$\('telegramChatsView'\)\?\.classList\.remove\('vg37-return'\)/);
  assert.match(chats,/\$\('telegramChatsView'\)\?\.classList\.add\('vg37-return'\)/);
  assert.match(chats,/if\(\$\('telegramChatsView'\)\?\.hidden===false\)/);
  assert.match(css,/#telegramMirror\.thread-mode\s+#telegramThreadView\.veto-mirror-thread:not\(\[hidden\]\)/);
  assert.match(css,/#telegramChatsView\.veto-mirror-list\.vg37-return:not\(\[hidden\]\)/);
  assert.match(css,/#telegramMirror \.veto-mirror-photo-dialog\[open\]/);
  assert.match(css,/#telegramMirror #telegramThreadMessages \.veto-mirror-bubble\{\s*animation:none!important/);
  for(const id of ['telegramChatsView','telegramThreadView','telegramThreadMessages','telegramThreadPhotoDialog'])
    assert.match(html,new RegExp('id="'+id+'"'));
});
test('finish CSS remains balanced with reduced-motion and mobile animation guard',()=>{
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
  const addition=css.slice(css.indexOf('VETOGRAM 3.7 · deliberate navigation motion'));
  assert.ok(addition.length>1700);
  assert.match(addition,/@media\(max-width:520px\)/);
  assert.match(addition,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(addition,/animation:none!important;transform:none!important/);
  assert.doesNotMatch(addition,/fetch\(|localStorage|sessionStorage|setTimeout\(/);
});
