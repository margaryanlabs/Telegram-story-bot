/* RB7: real native Back routing, no account data or Telegram traffic.
 * A single BackButton.onClick handles a modal, then chat, then secondary
 * workspaces. No duplicate callbacks or orphaned Back buttons.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('public/app.js');
const chats=read('public/telegram-chats.js');
const begin=app.indexOf('  function nativeBackTarget(){');
const end=app.indexOf('  // Pages without a bottom-tab button',begin);
assert.ok(begin>0&&end>begin,'native Back handler is present');
const source=app.slice(begin,end);

function fixture({screen='telegram',sheetOpen=false,threadOpen=false}={}){
  const calls=[],listeners=new Map();
  const sheet={hidden:!sheetOpen},thread={hidden:!threadOpen};
  const tg={BackButton:{
    show:()=>calls.push('show'),
    hide:()=>calls.push('hide'),
  }};
  const context=vm.createContext({
    tg,currentScreen:screen,
    $:id=>id==='sheet'?sheet:id==='telegramThreadView'?thread:null,
    window:{
      addEventListener:(type,fn)=>listeners.set(type,fn),
      VetoTelegramChatBack:()=>{calls.push('chat-back');thread.hidden=true;listeners.get('vetogram:chat-view-changed')?.();},
    },
    closeSheet:()=>{calls.push('close-sheet');sheet.hidden=true;listeners.get('vetogram:chat-view-changed')?.();},
    switchScreen:target=>{calls.push('screen:'+target);context.currentScreen=target;listeners.get('vetogram:chat-view-changed')?.();},
  });
  vm.runInContext(source,context,{timeout:1000});
  return {
    calls,sheet,thread,context,
    target:()=>vm.runInContext('nativeBackTarget()',context),
    sync:()=>vm.runInContext('syncNativeBackButton()',context),
    back:()=>vm.runInContext('handleNativeBackButton()',context),
  };
}

test('modal wins over an already open conversation',()=>{
  const f=fixture({sheetOpen:true,threadOpen:true});
  assert.equal(f.target(),'sheet');
  f.sync();
  f.back();
  assert.equal(f.sheet.hidden,true);
  assert.equal(f.thread.hidden,false);
  assert.deepEqual(f.calls,['show','close-sheet','show']);
  assert.equal(f.target(),'thread');
});

test('native Back from a visible chat returns to inbox, not close the app',()=>{
  const f=fixture({threadOpen:true});
  assert.equal(f.target(),'thread');
  f.sync();f.back();
  assert.equal(f.thread.hidden,true);
  assert.deepEqual(f.calls,['show','chat-back','hide']);
  assert.equal(f.target(),null);
});

test('primary Stories, Media, Privacy and inbox never display a fake Back target',()=>{
  for(const name of ['home','telegram','publish','media','privacy']){
    const f=fixture({screen:name});
    assert.equal(f.target(),null,name);
    f.sync();f.back();
    assert.deepEqual(f.calls,['hide'],name);
  }
});

test('secondary workspaces return to Chats instead of stale Profile or AI routes',()=>{
  for(const name of ['profile','voice','ai','story-engine','viewers','analytics','archive','play']){
    const f=fixture({screen:name});
    assert.equal(f.target(),'secondary');
    f.sync();f.back();
    assert.deepEqual(f.calls,['show','screen:telegram','hide'],name);
  }
});

test('native Back never opens another account, sends a code or mutates Telegram API',()=>{
  assert.doesNotMatch(source,/viewerApi\(|send_code|loginPending|window\.location/);
  assert.match(app,/BackButton\?\.onClick\(handleNativeBackButton\)/);
  assert.doesNotMatch(app,/BackButton\?\.onClick\(closeSheet\)/);
  assert.match(app,/window\.addEventListener\('vetogram:chat-view-changed',syncNativeBackButton\)/);
});

test('all real conversation exit paths refresh the native Back state',()=>{
  assert.match(chats,/function notifyThreadViewChanged\(\)\{[\s\S]*?new CustomEvent\('vetogram:chat-view-changed'\)/);
  const begin=chats.indexOf('  function setThread(chat){');
  const open=chats.indexOf('  async function openThread(chat){',begin);
  assert.ok(begin>0&&open>begin);
  assert.match(chats.slice(begin,open),/notifyThreadViewChanged\(\)/);
  const back=chats.slice(chats.indexOf('  function back(){'),
    chats.indexOf('  function closeVetoMessengerTools(){'));
  assert.match(back,/notifyThreadViewChanged\(\)/);
  const revoke=chats.slice(
    chats.indexOf("  window.addEventListener('vetogram:telegram-session-disconnected'"),
    chats.indexOf("  $('telegramThreadBack')?.addEventListener"));
  assert.match(revoke,/notifyThreadViewChanged\(\)/);
  assert.match(chats,/window\.VetoTelegramChatBack=back/);
});
