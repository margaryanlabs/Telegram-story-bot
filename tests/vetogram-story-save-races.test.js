/* Story Studio V4.5: async IndexedDB save must never roll back live edits.
 * Executes the real save/checkpoint functions with controllable storage.
 * No browser IndexedDB, image codec or Telegram backend is emulated here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const story=readFileSync(new URL('../public/story-engine.js',import.meta.url),'utf8');
const historyPart=story.slice(story.indexOf('function recordEdit('),
  story.indexOf('const owner='));
const savePart=story.slice(story.indexOf('const storageKey=d=>'),
  story.indexOf('async function listDrafts()'));
assert.match(historyPart,/function checkpoint/);
assert.match(savePart,/async function saveDraft/);

function makeHarness(){
  let currentOwner='111',commit=null,lastStored=null,reads=0;
  const messages=[];
  const initial={id:'story-1',ownerId:'111',title:'Draft A',caption:'',
    subtitle:'',imageDataUrl:'',updatedAt:0};
  const state={draft:initial,owner:'111',revision:0};
  const ctx=vm.createContext({
    state,historyGroup:'',owner:()=>currentOwner,
    editorIdentity:()=>currentOwner,
    history:{checkpoint(){}},
    queueMicrotask:update=>update(),
    updateHistoryButtons(){},
    notify:message=>messages.push(message),
    requireOwner(){
      if(!currentOwner||currentOwner!==state.owner||!state.draft)throw Error('Owner');
    },
    normalizeDraft:d=>({...d}),
    transact:async (mode,action)=>{
      const pending=action({put:row=>{lastStored=row}});
      return new Promise(resolve=>{commit=()=>resolve(pending)});
    },
    listDrafts:async()=>{reads++},
  });
  new vm.Script(historyPart+'\n'+savePart+
    '\nthis.exports={recordEdit,checkpoint,saveDraft};').runInContext(ctx);
  return {state,messages,api:ctx.exports,commit:()=>commit?.(),
    get lastStored(){return lastStored},get reads(){return reads},
    setOwner:id=>{currentOwner=id}};
}
test('editing during slow save keeps new on-screen text and warns of unsaved changes',async()=>{
  const t=makeHarness(),ref=t.state.draft;
  const saving=t.api.saveDraft();
  t.api.recordEdit('seTitle');t.state.draft.title='Newest edit';
  assert.equal(t.lastStored.draft.title,'Draft A');
  t.commit();await saving;
  assert.equal(t.state.draft,ref);
  assert.equal(t.state.draft.title,'Newest edit');
  assert.match(t.messages.at(-1),/более новые правки/);
  assert.equal(t.reads,1);
});
test('unchanged save updates only the timestamp, not the entire live draft',async()=>{
  const t=makeHarness(),ref=t.state.draft;
  const saving=t.api.saveDraft();
  t.commit();await saving;
  assert.equal(t.state.draft,ref);
  assert.ok(t.state.draft.updatedAt>0);
  assert.match(t.messages.at(-1),/сохранён только на этом устройстве/);
});
test('old owner commit cannot change the new owner draft',async()=>{
  const t=makeHarness(),saving=t.api.saveDraft();
  t.setOwner('222');t.state.owner='222';
  t.state.draft={id:'story-2',ownerId:'222',imageDataUrl:'',title:'Owner B'};
  t.commit();await saving;
  assert.equal(t.state.draft.title,'Owner B');
  assert.equal(t.messages.length,0);
  assert.equal(t.reads,0);
});
test('replacing draft object with same id still protects newer content',async()=>{
  const t=makeHarness(),saving=t.api.saveDraft();
  t.state.draft={...t.state.draft,title:'Recovered by undo'};
  t.state.revision++;
  t.commit();await saving;
  assert.equal(t.state.draft.title,'Recovered by undo');
  assert.match(t.messages.at(-1),/более новые правки/);
});
test('editor owner check guards asynchronous image errors and save revisions',()=>{
  assert.match(story,/state\.revision\+\+;\s*history\.checkpoint/);
  assert.match(story,/if\(historyGroup!==id\)\{checkpoint\(\);historyGroup=id;\}\s*state\.revision\+\+/);
  assert.match(story,/const reference=state\.draft,revision=state\.revision/);
  assert.match(story,/state\.draft!==reference \|\| state\.revision!==revision/);
  assert.match(story,/i\.onerror=\(\)=>\{\s*if\(state\.owner!==sourceOwner/);
});

test('IndexedDB save waits for commit: put success followed by abort must reject',async()=>{
  const section=story.slice(story.indexOf('async function transact(mode,fn){'),
    story.indexOf('const storageKey=d=>'));
  assert.match(section,/tx\.oncomplete=\(\)=>resolve\(result\)/);
  let tx,request;
  const state={
    db:{transaction(){
      tx={objectStore:()=>({put(){
        request={result:'written'};
        return request;
      }})};
      return tx;
    }}
  };
  const ctx=vm.createContext({state,openVault:async()=>state.db,Error});
  new vm.Script(section+'\nthis.exports={transact};').runInContext(ctx);
  const pending=ctx.exports.transact('readwrite',store=>store.put({}));
  request.onsuccess();
  tx.onabort();
  await assert.rejects(pending,/Local storage transaction aborted/);
});
test('only committed IndexedDB results are marked saved; export checks editor revision',()=>{
  assert.match(story,/tx\.oncomplete=\(\)=>resolve\(result\)/);
  assert.doesNotMatch(story,/request\.onsuccess=\(\)=>resolve\(request\.result\)/);
  const snapshots=story.match(/exportRevision=state\.revision/g)||[];
  assert.equal(snapshots.length,2,'publisher handoff and JPG download');
  const fences=story.match(/state\.revision!==exportRevision/g)||[];
  assert.equal(fences.length,2,'both exports reject stale edits');
});
