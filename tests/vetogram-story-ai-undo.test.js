import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Execute the real Story Engine handlers with fake owner, DOM and storage.
// No Telegram session, provider, IndexedDB writes or paid APIs are used.
const source=readFileSync(new URL('../public/story-engine.js',import.meta.url),'utf8');
function getHandlers(context){
  const helperStart=source.indexOf('function discardAiUndo()');
  const helperEnd=source.indexOf('async function init(){',helperStart);
  const transferStart=source.indexOf('async function applyAiStorySuggestion(');
  const transferEnd=source.indexOf('window.VetoTelegramApplyAiStory=',transferStart);
  assert.ok(helperStart>0&&helperEnd>helperStart&&transferStart>0&&transferEnd>transferStart);
  const code=source.slice(helperStart,helperEnd)+'\n'+
    source.slice(transferStart,transferEnd)+
    '\n({applyAiStorySuggestion,undoAiStorySuggestion,discardAiUndo,applyDraft})';
  return vm.runInNewContext(code,vm.createContext(context));
}
function fixture(){
  let ownerId='111',renders=0,linkClears=0;
  const button={hidden:true,disabled:true,style:{display:'none'}};
  const attached={checked:true},notices=[];
  const oldPortal={type:'link',title:'Existing portal',cta:'Go',link:'https://example.org'};
  const state={owner:'111',aiUndo:null,draft:{
    id:'draft-one',ownerId:'111',title:'Before',subtitle:'Original text',caption:'Original caption',
    photoId:'owner-media',layers:[{id:'layer1',text:'Keep me'}],
    portal:oldPortal,photoZoom:1.4
  }};
  const context={state,owner:()=>ownerId,init:async()=>{}, 
    trimText:(text,max)=>String(text??'').slice(0,max),
    normalizePortal:input=>({...input}),normalizeDraft:(draft,user)=>({...draft,ownerId:user}),
    newStoryDraft:()=>({}),loadImageForDraft:()=>{},checkpoint:()=>{},
    soundtrack:null,history:{reset(){}},updateHistoryButtons:()=>{},historyGroup:'',
    clearPublicPortalLink:()=>{linkClears++},
    render:()=>{renders++},
    notify:(message,error)=>notices.push({message,error}),
    $:id=>id==='seUndoAiText'?button:id==='sePortalAttachStory'?attached:null
  };
  const handlers=getHandlers(context);
  return {state,button,attached,oldPortal,notices,
    setOwner:value=>{ownerId=value},renders:()=>renders,linkClears:()=>linkClears,...handlers};
}
const proposal=(portal=false)=>({ownerId:'111',story:{
  title:'AI title',subtitle:'AI subtitle',caption:'AI caption'
},replacePortal:portal,portal:portal?{type:'offer',title:'New offer',cta:'Learn more'}:null});

test('AI text undo restores original copy without touching media, layers, existing Portal',async()=>{
  const f=fixture();
  assert.equal(await f.applyAiStorySuggestion(proposal()),true);
  assert.equal(f.state.draft.title,'AI title');
  assert.equal(f.state.draft.subtitle,'AI subtitle');
  assert.equal(f.state.draft.photoId,'owner-media');
  assert.equal(f.button.hidden,false);
  assert.equal(f.button.disabled,false);
  assert.equal(f.undoAiStorySuggestion(),true);
  assert.equal(f.state.draft.title,'Before');
  assert.equal(f.state.draft.subtitle,'Original text');
  assert.equal(f.state.draft.caption,'Original caption');
  assert.equal(f.state.draft.photoId,'owner-media');
  assert.equal(f.state.draft.layers[0].text,'Keep me');
  assert.equal(f.state.draft.photoZoom,1.4);
  assert.equal(f.state.draft.portal,f.oldPortal);
  assert.equal(f.button.hidden,true);
  assert.equal(f.state.aiUndo,null);
  assert.equal(f.undoAiStorySuggestion(),false);
});
test('opt-in AI Portal replacement has reversible content and clears public share opt-in',async()=>{
  const f=fixture();
  assert.equal(await f.applyAiStorySuggestion(proposal(true)),true);
  assert.equal(f.state.draft.portal.title,'New offer');
  assert.equal(f.state.draft.portal.link,'');
  assert.equal(f.attached.checked,false);
  f.attached.checked=true; // user may re-check; undo must clear it again.
  assert.equal(f.undoAiStorySuggestion(),true);
  assert.equal(f.state.draft.portal.title,'Existing portal');
  assert.equal(f.state.draft.portal.link,'https://example.org');
  assert.equal(f.attached.checked,false);
  assert.equal(f.state.draft.photoId,'owner-media');
  assert.equal(f.linkClears(),2);
});
test('undo never overwrites manual changes typed after AI suggestion',async()=>{
  const f=fixture();
  await f.applyAiStorySuggestion(proposal());
  f.state.draft.title='My own edited title';
  assert.equal(f.undoAiStorySuggestion(),false);
  assert.equal(f.state.draft.title,'My own edited title');
  assert.equal(f.state.aiUndo,null);
  assert.equal(f.button.hidden,true);
  assert.ok(f.notices.some(x=>x.error===true));
});
test('undo cannot restore an old owner draft into another account',async()=>{
  const f=fixture();
  await f.applyAiStorySuggestion(proposal());
  f.setOwner('222');f.state.owner='222';
  f.state.draft={id:'draft-one',ownerId:'222',title:'B private title',
    subtitle:'B text',caption:'B caption'};
  assert.equal(f.undoAiStorySuggestion(),false);
  assert.equal(f.state.draft.title,'B private title');
  assert.equal(f.button.hidden,true);
});
test('opening another draft invalidates old undo and does not restore prior AI text',async()=>{
  const f=fixture();
  await f.applyAiStorySuggestion(proposal());
  f.applyDraft({id:'draft-two',ownerId:'111',title:'Other draft',
    subtitle:'New subtitle',caption:'New caption',portal:null});
  assert.equal(f.undoAiStorySuggestion(),false);
  assert.equal(f.state.draft.title,'Other draft');
  assert.equal(f.button.hidden,true);
});
test('each new AI suggestion allows undo of latest edit only',async()=>{
  const f=fixture();
  await f.applyAiStorySuggestion(proposal());
  await f.applyAiStorySuggestion({ownerId:'111',story:{title:'Second AI title',
    subtitle:'Second AI subtitle',caption:'Second AI caption'},replacePortal:false});
  assert.equal(f.state.draft.title,'Second AI title');
  assert.equal(f.undoAiStorySuggestion(),true);
  assert.equal(f.state.draft.title,'AI title');
  assert.equal(f.state.draft.subtitle,'AI subtitle');
});
test('Story Engine exposes accessible undo control and one explicit event binding',()=>{
  const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  assert.match(html,/id="seUndoAiText"[^>]*hidden disabled/);
  assert.match(html,/Отменить AI-текст/);
  assert.match(source,/\$\('seUndoAiText'\)\.addEventListener\('click',\(\)=>void undoAiStorySuggestion\(\)\)/);
  assert.match(source,/function applyDraft\(d,preserveHistory=false\)\{[\s\S]*?discardAiUndo\(\)/);
});
