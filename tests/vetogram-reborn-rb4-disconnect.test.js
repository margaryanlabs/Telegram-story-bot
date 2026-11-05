/* RB4 — disconnect must fail closed even when Mini App initData stays the same.
 * Exercises actual browser controller excerpts with fake DOM/session state.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const chat=read('public/telegram-chats.js');
const app=read('public/app.js');
const slice=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing actual source anchors: '+start);
  return source.slice(a,b);
};
const invalidate=slice(chat,'  function invalidateThreadAuthorization(){','  async function pollThread(');
const disconnect=slice(chat,
  "  window.addEventListener('vetogram:telegram-session-disconnected',()=>{",
  "  $('telegramThreadBack')?.addEventListener('click',back);");

function fixture({changedOwner=false}={}){
  const events=new Map(),calls=[];
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{
      id,hidden:false,textContent:'sensitive',
      value:id==='telegramThreadCompose'?'private draft':'local media',
      dataset:{mirrorOwnerId:'123',mirrorThreadId:'55',
        mirrorThreadGeneration:'4',activeChat:'55'},
      removed:[],replaced:0,
      classList:{remove:()=>calls.push('class-removed:'+id)},
      removeAttribute(key){this.removed.push(key);},
      replaceChildren(){this.replaced++;this.textContent='';},
    });
    return nodes.get(id);
  };
  const state={
    ownerInitData:'signed',thread:{id:'55',serverCanSend:true},
    threadGeneration:4,syncRunId:8,sessionEpoch:5,generation:3,
    sessionDisconnected:false,
    inboxOverlayEpoch:3,pendingLoginRefresh:true,loading:true,
    inboxReturn:{ownerKey:'signed'},lastListFetchedAt:250,
    threadLoading:true,syncBusy:true,sendInFlight:true,sendInFlightChatId:'55',
    messages:[{id:1,text:'private'}],chats:[{id:'55',title:'Private'}],
    threadCache:new Map([['55',{messages:[{text:'private'}]}]]),
    connectionProof:{verified:true},page:1,hasMore:true,threadAuthRejected:false,
    avatarEpoch:1,avatarQueue:[],avatarRequested:new Set(['55']),
    avatarRetryAt:new Map(),avatarMissing:new Set(),avatarRetryTimer:null,
    avatarBlockedUntil:0,avatarActive:0,
    avatarUrls:new Map([['55','blob:private-avatar']]),
    drafts:new Map([['55','private draft']]),draftVersions:new Map([['55',1]]),
    lastSendFailure:{message:'private'},lastSendFailures:new Map([['55',{nonce:'private'}]]),
    lastRichFailure:{intent:'private'},lastRichFailures:new Map([['55',{intent:'private'}]]),
    replyTo:{id:12},pendingAttachment:{file:'private'}
  };
  const context=vm.createContext({
    state,$:node,
    resetOwner:()=>changedOwner,
    window:{
      addEventListener:(name,handler)=>events.set(name,handler),
      VetoThemeDock:area=>calls.push('theme:'+area)
    },
    URL:{revokeObjectURL:url=>calls.push('revoked:'+url)},
    clearTimeout:()=>{},
    stopThreadSync:()=>calls.push('stop-sync'),
    cancelActivePoll:()=>calls.push('abort-poll'),
    cancelThreadRequest:()=>calls.push('abort-history'),
    renderDeliveryStatus:()=>{},
    renderReplyPreview:()=>{},
    renderAttachmentChip:()=>{},
    cancelVoiceCapture:()=>calls.push('cancel-voice'),
    dropVoiceDraft:()=>{},
    revokeMediaUrls:()=>calls.push('revoke-media'),
    renderSendComposer:()=>{},
    renderChats:()=>calls.push('render-chats'),
    showNotice:message=>calls.push('notice:'+message),
  });
  vm.runInContext(invalidate+'\n'+disconnect,context,{timeout:1000});
  return {state,node,calls,run:()=>events.get('vetogram:telegram-session-disconnected')?.()};
}

test('confirmed logout clears volatile inbox, drafts, owner proof and visible DOM immediately',()=>{
  const f=fixture();
  const before={generation:f.state.generation,sessionEpoch:f.state.sessionEpoch};
  f.run();
  assert.equal(f.state.connectionProof,null);
  assert.equal(f.state.sessionDisconnected,true);
  assert.equal(f.state.thread,null);
  assert.equal(f.state.threadLoading,false);
  assert.equal(f.state.sendInFlight,false);
  assert.equal(f.state.sendInFlightChatId,null);
  assert.equal(f.state.messages.length,0);
  assert.equal(f.state.chats.length,0);
  assert.equal(f.state.threadCache.size,0);
  assert.equal(f.state.drafts.size,0);
  assert.equal(f.state.lastSendFailures.size,0);
  assert.equal(f.state.lastRichFailures.size,0);
  assert.equal(f.state.sessionEpoch,before.sessionEpoch+1);
  assert.equal(f.state.generation,before.generation+1);
  assert.equal(f.node('telegramThreadCompose').value,'');
  assert.equal(f.node('telegramThreadMessages').replaced,1);
  assert.equal(f.node('telegramMirrorList').replaced,1);
  assert.equal('mirrorOwnerId' in f.node('telegramThreadMessages').dataset,false);
  assert.equal(f.node('telegramThreadView').hidden,true);
  assert.equal(f.node('telegramChatsView').hidden,false);
  assert.ok(f.calls.includes('abort-poll'));
  assert.ok(f.calls.includes('abort-history'));
  assert.ok(f.calls.includes('revoke-media'));
  assert.ok(f.calls.includes('revoked:blob:private-avatar'));
  assert.ok(f.calls.some(x=>x.startsWith('notice:')));
});

test('stale signed-owner disconnect callback does not clear a different active owner',()=>{
  const f=fixture({changedOwner:true});
  f.run();
  assert.equal(f.state.messages.length,1);
  assert.equal(f.state.drafts.size,1);
  assert.equal(f.calls.length,0);
});

test('send ACK/error/finally are session-fenced after logout even if initData unchanged',()=>{
  const sendText=slice(chat,'  async function sendOutgoing(){',
    '  // Owner-scoped volatile cache:');
  const sendRich=slice(chat,'  async function sendRichOutgoing(',
    '  // Installed packs are fetched');
  for(const source of [sendText,sendRich]){
    assert.match(source,/sessionEpoch=state\.sessionEpoch/);
    assert.match(source,/if\(sessionEpoch!==state\.sessionEpoch\)return;/);
    assert.match(source,/if\(sessionEpoch===state\.sessionEpoch&&ownerKey===state\.ownerInitData\)/);
  }
  assert.match(chat,/state\.ownerInitData=current;\s*state\.sessionEpoch\+\+/);
  assert.match(invalidate,/state\.sessionEpoch\+\+/);
  assert.match(invalidate,/state\.generation\+\+;state\.inboxOverlayEpoch\+\+/);
});

test('signed-in inbox does not pretend that a revoked session is merely loading',()=>{
  assert.match(chat,/state\.sessionDisconnected=true;/);
  assert.match(chat,/if\(data\.connection\?\.verified===true\)state\.sessionDisconnected=false;/);
  assert.match(chat,/state\.sessionDisconnected\s*\?\s*'○ Личный Telegram отключён/);
  assert.match(chat,/empty\('Telegram отключён','Для просмотра своих переписок подключи Telegram заново\.'/);
  assert.match(chat,/\$\('telegramMirrorAccessButton'\)\.textContent=ready\?'LIVE ✓':'Подключить ↗'/);
  const link=slice(chat,
    "  window.addEventListener('vetogram:telegram-session-connected',()=>{",
    "  window.addEventListener('vetogram:telegram-session-disconnected',()=>{");
  assert.match(link,/state\.sessionDisconnected=false;/);
});

test('server-confirmed disconnect paths emit exactly one local invalidation event',()=>{
  const helper=slice(app,'  function notifyTelegramSessionDisconnected(){',
    '  async function refreshViewerSync(');
  assert.match(helper,/new CustomEvent\('vetogram:telegram-session-disconnected'\)/);
  assert.doesNotMatch(helper,/event\.detail|detail:|JSON\.stringify|initDataUnsafe|session_ciphertext|phoneNumber/);
  const sync=slice(app,'  async function refreshViewerSync(',
    '  // Returning from Telegram');
  assert.match(sync,/wasConnected&&viewerState\.session\?\.connected!==true&&viewerState\.degraded===false/);
  assert.match(sync,/notifyTelegramSessionDisconnected\(\)/);
  const revoke=slice(app,"    if (action === 'security-revoke-session') {",
    "    if (action === 'viewer-disconnect') {");
  const manual=slice(app,"    if (action === 'viewer-disconnect') {",
    '    if (storyId) {');
  for(const piece of [revoke,manual]){
    assert.ok(piece.indexOf("await viewerApi('disconnect'")<piece.indexOf('notifyTelegramSessionDisconnected()'));
    assert.match(piece,/notifyTelegramSessionDisconnected\(\)/);
  }
});

test('personal Account badge resets without silently removing separate Business rights',()=>{
  const helper=slice(app,'  function notifyTelegramSessionDisconnected(){',
    '  async function refreshViewerSync(');
  const state={accountConnection:{connected:true,account:{username:'old'}},
    businessPermissions:{connected:true,stories:true,messages:false}};
  const emitted=[],renders=[];
  const qr={aborted:false,abort(){this.aborted=true;}};
  const context={
    state,viewerOwnerEpoch:5,viewerSyncIntent:3,viewerAnalyticsIntent:2,
    viewerAuthBusy:true,viewerQrAbortController:qr,
    CustomEvent:class {constructor(type){this.type=type;}},
    window:{dispatchEvent:event=>emitted.push(event.type)},
    renderHome:()=>renders.push('home'),
    renderConnection:()=>renders.push('connection'),
    renderViewerPendingLoginNotice:()=>renders.push('pending'),
  };
  vm.runInNewContext(helper+'\nnotifyTelegramSessionDisconnected();',context);
  assert.equal(state.accountConnection.connected,false);
  assert.equal(state.accountConnection.account,null);
  assert.equal(state.businessPermissions.connected,true);
  assert.equal(state.businessPermissions.stories,true);
  assert.deepEqual(emitted,['vetogram:telegram-session-disconnected']);
  assert.equal(context.viewerOwnerEpoch,6,'same-owner session boundary invalidates pre-logout reads');
  assert.equal(context.viewerSyncIntent,4);
  assert.equal(context.viewerAnalyticsIntent,3);
  assert.equal(context.viewerAuthBusy,false);
  assert.equal(context.viewerQrAbortController,null);
  assert.equal(qr.aborted,true);
  assert.deepEqual(renders,['home','connection','pending']);
});

test('temporary viewer storage errors do not trigger a disconnect event',()=>{
  const sync=slice(app,'  async function refreshViewerSync(',
    '  // Returning from Telegram');
  assert.match(sync,/if \(data\.degraded\)/);
  assert.match(sync,/degraded: true/);
  assert.match(sync,/wasConnected&&viewerState\.session\?\.connected!==true&&viewerState\.degraded===false/);
});
