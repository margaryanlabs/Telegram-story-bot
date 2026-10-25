/* V4.5 AI: execute real mode-change controller and request cancellation logic.
 * No provider, Telegram send or network call. Real browser/E2E QA remains pending.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/vetogram-ai.js',import.meta.url),'utf8');
const modePart=source.slice(source.indexOf('  function setMode(mode){'),
  source.indexOf('  function actionRecipientReady('));
const busyPart=source.slice(source.indexOf('  function setBusy(value){'),
  source.indexOf('  async function request('));
const requestPart=source.slice(source.indexOf('  async function request('),
  source.indexOf('  async function generate(){'));
assert.match(modePart,/generateIntent/);
assert.match(requestPart,/externalSignal/);

function modes(){
  let abortCount=0;
  const state={
    mode:'chat',generateIntent:4,generateAbort:{abort(){abortCount++}},
    history:[{text:'private'}],last:'private',reviewedApprovalId:1,sendIntent:{},
    negotiationPolicy:null,negotiationDraft:null,actionDraft:null,
    actionRecipientConfirmed:null,brief:null,dialogs:[],busy:true,
  };
  const nodes=new Map();
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{
      hidden:false,disabled:false,readOnly:false,value:'',textContent:'',
      placeholder:'',classList:{toggle(){}},
      replaceChildren(){},setAttribute(){},
    });
    return nodes.get(id);
  };
  const buttons=['chat','translate','reply','story','campaign','action','brief','negotiator']
    .map(mode=>({dataset:{vtaiMode:mode},pressed:null,
      classList:{toggle(){}},setAttribute(name,val){if(name==='aria-pressed')this.pressed=val}}));
  const ctx=vm.createContext({
    state,$:el,document:{querySelectorAll:()=>buttons},
    window:{dispatchEvent(){}},CustomEvent:class {constructor(){}},
    canSendDraft:()=>false,
  });
  new vm.Script(busyPart+modePart+'\nthis.exports={setMode};').runInContext(ctx);
  return {setMode:ctx.exports.setMode,state,buttons,nodes,
    get abortCount(){return abortCount}};
}
test('switching chat → story cancels the prior generation and re-enables composer',()=>{
  const v=modes();
  v.setMode('story');
  assert.equal(v.abortCount,1);
  assert.equal(v.state.generateIntent,5);
  assert.equal(v.state.generateAbort,null);
  assert.equal(v.state.busy,false);
  assert.equal(v.state.history.length,0);
  assert.equal(v.state.last,null);
  assert.equal(v.buttons.find(x=>x.dataset.vtaiMode==='story').pressed,'true');
  assert.equal(v.nodes.get('vtaiReview').hidden,true);
});
test('A → B → A mode replay cannot match a prior request generation intent',()=>{
  const v=modes(),oldIntent=v.state.generateIntent;
  v.setMode('story');
  v.setMode('chat');
  assert.equal(v.state.mode,'chat');
  assert.notEqual(v.state.generateIntent,oldIntent);
  assert.equal(v.state.generateIntent,oldIntent+2);
  assert.equal(v.abortCount,1);
});
test('AI request attaches explicit cancellation signal and revokes on abort',async()=>{
  let aborted=false;
  const ctrl=new AbortController(),state={requestEpoch:1,identity:'signed-owner'};
  const ctx=vm.createContext({
    state,ownerRequestScope:()=>({epoch:1,identity:'signed-owner',ownerId:'111'}),
    isOwnerRequestCurrent:()=>true,
    oldRequestCanReset:()=>false,reset(){},owner:()=> '111',
    signed:()=> 'signed-owner',
    fetch:async(url,options)=>new Promise((resolve,reject)=>{
      assert.equal(options.headers['x-telegram-init-data'],'signed-owner');
      options.signal.addEventListener('abort',()=>{
        aborted=true;
        reject(Object.assign(new Error('abort'),{name:'AbortError'}));
      },{once:true});
    }),
    AbortController,setTimeout,clearTimeout,Error,JSON,
  });
  new vm.Script(requestPart+'\nthis.exports={request};').runInContext(ctx);
  const promise=ctx.exports.request('/api/vetogram-ai',{mode:'story'},true,ctrl.signal);
  ctrl.abort();
  await assert.rejects(promise,{name:'AbortError'});
  assert.equal(aborted,true);
});
test('generate uses fresh intent and ignores stale response/finally blocks',()=>{
  assert.match(source,/const intent=\+\+state\.generateIntent/);
  assert.match(source,/const generationAbort=new AbortController\(\)/);
  assert.match(source,/generationAbort\.signal/);
  assert.match(source,/if\(!isOwnerRequestCurrent\(scope\)\|\|intent!==state\.generateIntent\)return/);
  assert.match(source,/if\(isOwnerRequestCurrent\(scope\)&&intent===state\.generateIntent\)/);
  assert.match(source,/state\.generateAbort\?\.abort\(\)/);
  assert.match(source,/externalSignal\?\.removeEventListener\('abort',onExternalAbort\)/);
});
