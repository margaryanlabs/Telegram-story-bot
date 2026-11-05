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
const stories=read('public/telegram-stories.js');
const media=read('public/vetogram-universe.js');
const messageActions=read('public/vetogram-chat-experience-v4.js');
const begin=app.indexOf('  function nativeBackTarget(){');
const end=app.indexOf('  // Pages without a bottom-tab button',begin);
assert.ok(begin>0&&end>begin,'native Back handler is present');
const source=app.slice(begin,end);

function fixture({screen='telegram',sheetOpen=false,threadOpen=false,
    storyOpen=false,playerOpen=false,photoOpen=false,actionsOpen=false}={}){
  const calls=[],listeners=new Map();
  const sheet={hidden:!sheetOpen},thread={hidden:!threadOpen},
    story={hidden:!storyOpen},player={hidden:!playerOpen},
    photo={open:photoOpen},actions={open:actionsOpen};
  const emit=type=>listeners.get(type)?.();
  actions.close=()=>{actions.open=false;calls.push('close-actions');emit('vetogram:message-actions-view-changed')};
  const tg={BackButton:{
    show:()=>calls.push('show'),
    hide:()=>calls.push('hide'),
  }};
  const context=vm.createContext({
    tg,currentScreen:screen,
    $:id=>({
      sheet,telegramThreadView:thread,vetoContactStoryViewer:story,
      v61Player:player,telegramThreadPhotoDialog:photo,v4MessageActions:actions,
    })[id]||null,
    window:{
      addEventListener:(type,fn)=>listeners.set(type,fn),
      VetoTelegramChatBack:()=>{calls.push('chat-back');thread.hidden=true;emit('vetogram:chat-view-changed')},
      VetoTelegramStoryBack:()=>{calls.push('story-back');story.hidden=true;emit('vetogram:story-view-changed')},
      VetoTelegramMediaBack:()=>{calls.push('media-back');player.hidden=true;emit('vetogram:media-player-view-changed')},
      VetoTelegramPhotoBack:()=>{calls.push('photo-back');photo.open=false;emit('vetogram:photo-view-changed')},
    },
    closeSheet:()=>{calls.push('close-sheet');sheet.hidden=true;emit('vetogram:chat-view-changed')},
    switchScreen:target=>{calls.push('screen:'+target);context.currentScreen=target;emit('vetogram:chat-view-changed')},
  });
  vm.runInContext(source,context,{timeout:1000});
  return {
    calls,sheet,thread,story,player,photo,actions,context,
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

test('a contact Story viewer closes before returning from the underlying chat',()=>{
  const f=fixture({threadOpen:true,storyOpen:true});
  assert.equal(f.target(),'story');
  f.sync();f.back();
  assert.equal(f.story.hidden,true);
  assert.equal(f.thread.hidden,false);
  assert.deepEqual(f.calls,['show','story-back','show']);
  assert.equal(f.target(),'thread');
});

test('full-screen Media player closes without navigating or changing audio',()=>{
  const f=fixture({screen:'media',playerOpen:true});
  assert.equal(f.target(),'media-player');
  f.sync();f.back();
  assert.equal(f.player.hidden,true);
  assert.deepEqual(f.calls,['show','media-back','hide']);
  assert.equal(f.target(),null);
});

test('photo and contextual action dialogs are higher priority than a conversation',()=>{
  const f=fixture({threadOpen:true,photoOpen:true,actionsOpen:true});
  assert.equal(f.target(),'message-actions');
  f.sync();f.back();
  assert.equal(f.actions.open,false);
  assert.equal(f.target(),'photo');
  f.back();
  assert.equal(f.photo.open,false);
  assert.equal(f.target(),'thread');
  f.back();
  assert.equal(f.thread.hidden,true);
  assert.equal(f.target(),null);
});

test('story, photo and Media modules notify Back state without sharing personal payload',()=>{
  assert.match(stories,/window\.VetoTelegramStoryBack=closeViewer/);
  assert.match(stories,/new CustomEvent\('vetogram:story-view-changed'\)/);
  assert.match(stories,/notifyStoryViewChanged\(\)/);
  assert.match(media,/window\.VetoTelegramMediaBack=closePlayer/);
  assert.match(media,/new CustomEvent\('vetogram:media-player-view-changed'\)/);
  assert.match(chats,/window\.VetoTelegramPhotoBack=closePhotoViewer/);
  assert.match(chats,/new CustomEvent\('vetogram:photo-view-changed'\)/);
  assert.match(messageActions,/new CustomEvent\('vetogram:message-actions-view-changed'\)/);
  assert.match(messageActions,/notifyMessageActionsChanged\(\)/);
});

test('native Back never opens another account, sends a code or mutates Telegram API',()=>{
  assert.doesNotMatch(source,/viewerApi\(|send_code|loginPending|window\.location/);
  assert.match(app,/BackButton\?\.onClick\(handleNativeBackButton\)/);
  assert.doesNotMatch(app,/BackButton\?\.onClick\(closeSheet\)/);
  assert.match(app,/'vetogram:chat-view-changed'/);
  assert.match(app,/'vetogram:story-view-changed'/);
  assert.match(app,/'vetogram:media-player-view-changed'/);
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


test('story viewer restores focus only for a still-active, same-screen user close',()=>{
  const start=stories.indexOf('  function notifyStoryViewChanged(){');
  const end=stories.indexOf('  function resetOwner() {',start);
  assert.ok(start>0&&end>start);
  const src=stories.slice(start,end);
  function run({restore=true,active=true,background=false}={}){
    const calls=[];
    const previous={
      isConnected:true,
      closest:()=>({classList:{contains:name=>name==='active'&&active}}),
      focus:()=>calls.push('focus'),
    };
    const state={epoch:2,mediaBusy:true,activePeer:1,activeStory:2,priorFocus:previous};
    const viewer={hidden:false,replaceChildren:()=>calls.push('clear')};
    const context=vm.createContext({
      state,viewer,hideMedia:()=>calls.push('stop-media'),
      window:{dispatchEvent:ev=>calls.push(ev.type)},
      document:{hidden:background,body:{classList:{remove:()=>calls.push('close-css')}}},
      CustomEvent:class {constructor(type){this.type=type;}},
    });
    vm.runInContext(src,context,{timeout:1000});
    vm.runInContext(restore?'closeViewer()':'closeViewer({restoreFocus:false})',context);
    return {calls,state,viewer};
  }
  const user=run();
  assert.equal(user.calls.includes('focus'),true);
  assert.equal(user.viewer.hidden,true);
  assert.equal(user.state.priorFocus,null);
  assert.equal(user.calls.includes('vetogram:story-view-changed'),true);
  for(const options of [
    {restore:false,active:true},{restore:true,active:false},
    {restore:true,active:true,background:true},
  ]){
    const f=run(options);
    assert.equal(f.calls.includes('focus'),false,JSON.stringify(options));
    assert.equal(f.calls.includes('stop-media'),true);
    assert.equal(f.calls.includes('vetogram:story-view-changed'),true);
  }
});

test('switching from Chats to publishing Stories always dismisses contact Story overlay',()=>{
  const handler=stories.slice(
    stories.indexOf("  window.addEventListener('veto:screen-changed'"),
    stories.indexOf("  window.addEventListener('pageshow'",stories.indexOf("  window.addEventListener('veto:screen-changed'")),
  );
  assert.match(handler,/destination!=='telegram'&&!viewer\.hidden/);
  assert.match(handler,/closeViewer\(\{restoreFocus:false\}\)/);
  assert.match(handler,/\['telegram','publish'\]\.includes\(destination\)/);
  assert.match(stories,/if \(document\.hidden\) \{[\s\S]*?closeViewer\(\{restoreFocus:false\}\)/);
  assert.match(stories,/closeViewer\(\{restoreFocus:false\}\);\s*state\.owner = current/);
});
