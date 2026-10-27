/* Regression: same-chat history refresh must not cancel photo/file downloads.
 * Uses real VETOGRAM shipping functions, mocked owner and browser DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
function part(a,b){
  const start=source.indexOf(a),end=source.indexOf(b,start);
  assert.ok(start>0&&end>start,'missing shipping controller');
  return source.slice(start,end);
}
const photoSource=part('  async function photoRequest(', '  // A single signed MTProto connection');
const attachmentSource=part('  // History refresh re-creates message buttons.', '  function visibleMessageAnchor(');

function photoFixture(){
  const state={thread:{id:'99'},threadGeneration:7,previewEpoch:3,
    ownerInitData:'signed',mediaMimeByUrl:new Map()};
  let complete=null,revoked=0;
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},
    resetOwner(){},
    fetch:()=>new Promise(resolve=>{complete=resolve}),
    AbortController,setTimeout,clearTimeout,
    URL:{createObjectURL:()=> 'blob:photo-99',revokeObjectURL:()=>{revoked++}},
  });
  new vm.Script(photoSource).runInContext(ctx);
  return {
    state,ctx,
    start:()=>new vm.Script("photoRequest('photo','99',123)").runInContext(ctx),
    resolve:()=>complete({ok:true,blob:async()=>({size:300,type:'image/jpeg'})}),
    revoked:()=>revoked,
  };
}
test('photo remains valid after refreshing history in same verified chat',async()=>{
  const f=photoFixture(),pending=f.start();
  f.state.threadGeneration+=2;
  f.resolve();
  assert.equal(await pending,'blob:photo-99');
  assert.equal(f.state.mediaMimeByUrl.get('blob:photo-99'),'image/jpeg');
});
test('photo is rejected if media lifetime changes despite identical chat ID',async()=>{
  const f=photoFixture(),pending=f.start();
  f.state.previewEpoch++;
  f.resolve();
  await assert.rejects(pending,/Открыта другая переписка/);
});
test('photo is rejected when user leaves for a different chat',async()=>{
  const f=photoFixture(),pending=f.start();
  f.state.thread={id:'100'};
  f.resolve();
  await assert.rejects(pending,/Открыта другая переписка/);
});

function attachmentFixture({archive=false}={}){
  const id=42;
  const original={dataset:archive?{mirrorFile:'42'}:{mirrorLiveFile:'42'},
    disabled:false,textContent:'Открыть файл',isConnected:true};
  const replacement={dataset:{...original.dataset},disabled:false,
    textContent:'Открыть файл',isConnected:true};
  let complete,stored=null;
  const state={thread:{id:'99'},threadGeneration:7,previewEpoch:3,
    ownerInitData:'signed'};
  const host={querySelectorAll:()=>[replacement]};
  const ctx=vm.createContext({
    state,tg:{initData:'signed'},$:name=>name==='telegramThreadMessages'?host:null,
    fetch:()=>new Promise(resolve=>{complete=resolve}),
    cacheExpandedAttachment:(button,messageId,blob,fromArchive)=>{
      stored={button,messageId,blob,fromArchive};
    },
    URLSearchParams,AbortController,setTimeout,clearTimeout,
    toast(){},
  });
  new vm.Script(attachmentSource).runInContext(ctx);
  return {
    state,original,replacement,
    open:()=>new vm.Script(archive?
      'openArchivedFile(globalThis.input)':'openLiveAttachment(globalThis.input)')
      .runInContext(Object.assign(ctx,{input:original})),
    finish:()=>{
      original.isConnected=false;
      complete({ok:true,blob:async()=>({size:1024,type:'application/pdf'})});
    },
    saved:()=>stored,id,
  };
}
for(const archive of [false,true]){
  test((archive?'saved':'live')+' file attaches to replacement button after repaint',async()=>{
    const f=attachmentFixture({archive}),pending=f.open();
    f.state.threadGeneration++;
    f.finish();await pending;
    assert.ok(f.saved(),'attachment was not discarded by history refresh');
    assert.equal(f.saved().button,f.replacement);
    assert.equal(f.saved().messageId,42);
    assert.equal(f.saved().fromArchive,archive);
  });
  test((archive?'saved':'live')+' file cannot attach after leaving the chat',async()=>{
    const f=attachmentFixture({archive}),pending=f.open();
    f.state.previewEpoch++;
    f.finish();await pending;
    assert.equal(f.saved(),null,'stale media never crosses owner/thread lifetime');
  });
}
test('media downloads never gate on unrelated thread-history generation',()=>{
  assert.doesNotMatch(photoSource,/threadGeneration/);
  assert.doesNotMatch(attachmentSource,/threadGeneration/);
  assert.match(source,/const generation=\+\+state\.threadGeneration/);
  assert.match(source,/state\.previewEpoch\+\+;state\.previewActive=0/);
});
