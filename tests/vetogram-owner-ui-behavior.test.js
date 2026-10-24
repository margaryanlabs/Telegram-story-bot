import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual functions from the browser controller, not rewritten test
// doubles. This intentionally runs offline without DOM, npm packages or APIs.
const browser=readFileSync(new URL('../public/vetogram-ai.js',import.meta.url),'utf8');
function controller(name,context){
  const start=browser.indexOf('  '+name+'(');
  assert.ok(start>=0,'Controller function missing: '+name);
  const end=browser.indexOf('\n  }\n',start);
  assert.ok(end>start,'Controller function terminator missing: '+name);
  return vm.runInNewContext('('+browser.slice(start,end+4).trim()+')',
    vm.createContext(context));
}
function fakeUi(){
  const cache=new Map();
  const get=id=>{
    if(!cache.has(id))cache.set(id,{
      value:'',hidden:false,disabled:false,readOnly:false,checked:false,
      textContent:'',placeholder:'',replaceChildren(){},
      scrollIntoView(){},setAttribute(){},classList:{toggle(){}}
    });
    return cache.get(id);
  };
  return {$:get,get,document:{querySelectorAll:()=>[]}};
}
const uuid='12345678-1234-4234-8234-123456789012';
function sendContext(){
  const ui=fakeUi(),status=[];
  const state={identity:'signed-A',requestEpoch:1,mode:'reply',busy:false,
    last:'Generated reply',dialogs:[{id:'77',title:'Alice Chat'}],
    sendIntent:null,approvals:[],reviewedApprovalId:null};
  ui.get('vtaiDraft').value='Hello from user';
  ui.get('vtaiRecipients').value='77';
  ui.get('vtaiReview').hidden=false;
  let requestImpl=async()=>({sent:true});
  const requests=[];
  const context={...ui,state,
    window:{confirm:()=>true,crypto:{randomUUID:()=>uuid}},
    safeIdentity:()=>true,canSendDraft:()=>Boolean(state.last),
    validNegotiatorSend:()=>true,actionRecipientReady:()=>true,
    owner:()=> '111',
    ownerRequestScope:()=>({identity:state.identity,epoch:state.requestEpoch,ownerId:'111'}),
    isOwnerRequestCurrent:s=>s.identity===state.identity&&s.epoch===state.requestEpoch,
    requestedSendKey:(owner,chat,message)=>JSON.stringify([owner,chat,message]),
    request:async(...args)=>{requests.push(args);return requestImpl(...args)},
    notice:(message,error)=>status.push({message,error}),
    setBusy:value=>{state.busy=value},
    renderApprovals:()=>{}
  };
  return {...context,requests,status,setRequest:fn=>{requestImpl=fn}};
}
test('mode switch clears old authorization, old draft, and send nonce',()=>{
  const ui=fakeUi(),state={
    mode:'negotiator',history:[{role:'assistant',text:'old'}],
    last:'old',reviewedApprovalId:'approval-old',sendIntent:{nonce:uuid},
    negotiationPolicy:{},negotiationDraft:{reply:'old'},actionDraft:null,
    actionRecipientConfirmed:null,brief:null
  };
  ui.get('vtaiDraft').value='Previous negotiator text';
  ui.get('vtaiSend').disabled=false;
  ui.get('vtaiReview').hidden=false;
  const fn=controller('function setMode',{...ui,state});
  fn('reply');
  assert.equal(state.mode,'reply');
  assert.equal(state.last,null);
  assert.equal(state.sendIntent,null);
  assert.equal(state.reviewedApprovalId,null);
  assert.equal(state.negotiationPolicy,null);
  assert.equal(state.negotiationDraft,null);
  assert.equal(ui.get('vtaiDraft').value,'');
  assert.equal(ui.get('vtaiReview').hidden,true);
  assert.equal(ui.get('vtaiSend').disabled,true);
});
test('send rejects hidden, stale, or other-mode draft before network',async()=>{
  const ctx=sendContext();
  ctx.get('vtaiReview').hidden=true;
  await controller('async function send',ctx)();
  assert.equal(ctx.requests.length,0);
  assert.equal(ctx.status.length,1);
  ctx.get('vtaiReview').hidden=false;
  ctx.state.last=null;
  await controller('async function send',ctx)();
  assert.equal(ctx.requests.length,0);
});
test('user-confirmed uncertain send retries with same Telegram random nonce',async()=>{
  const ctx=sendContext();
  ctx.setRequest(async()=>{throw Error('Network timeout; Telegram may have sent it')});
  const send=controller('async function send',ctx);
  await send();
  assert.equal(ctx.requests.length,1);
  assert.equal(ctx.state.sendIntent.nonce,uuid);
  assert.equal(ctx.get('vtaiDraft').value,'Hello from user');
  assert.equal(ctx.get('vtaiReview').hidden,false);
  assert.equal(ctx.state.busy,false);
  ctx.setRequest(async()=>({sent:true}));
  await send();
  assert.equal(ctx.requests.length,2);
  assert.equal(ctx.requests[0][1].nonce,ctx.requests[1][1].nonce);
  assert.equal(ctx.get('vtaiDraft').value,'');
  assert.equal(ctx.state.sendIntent,null);
  assert.equal(ctx.state.last,null);
});
test('Approval Center never restores account A draft after asynchronous chat load switches to B',async()=>{
  const ui=fakeUi(),state={identity:'signed-A',requestEpoch:1,
    approvals:[{id:uuid,owner:'111',chatId:'77',message:'Personal approval',nonce:uuid}],
    dialogs:[],reviewedApprovalId:null,sendIntent:null,last:null};
  const context={...ui,state,
    safeIdentity:()=>true,owner:()=>state.identity==='signed-A'?'111':'222',
    ownerRequestScope:()=>({identity:state.identity,epoch:state.requestEpoch}),
    isOwnerRequestCurrent:s=>state.identity===s.identity&&state.requestEpoch===s.epoch,
    activeApprovals:entries=>entries,
    loadChats:async()=>{state.identity='signed-B';state.requestEpoch=2;
      state.dialogs=[{id:'77',title:'B personal chat'}]},
    setMode:()=>{throw Error('Stale A approval must not load B editor')},
    notice:()=>{}
  };
  await controller('async function reviewApproval',context)(uuid);
  assert.equal(state.reviewedApprovalId,null);
  assert.equal(state.sendIntent,null);
  assert.equal(ui.get('vtaiDraft').value,'');
});
test('Second Brain and AI Action execute provider call before using its response',async()=>{
  for(const mode of ['brief','action']){
    const ui=fakeUi(),state={identity:'signed-A',requestEpoch:1,
      busy:false,mode,history:[],memory:[],selectedNotes:new Set(),
      actionDraft:null,actionRecipientConfirmed:null,dialogs:[],last:null};
    ui.get('vtaiConsent').checked=true;
    ui.get('vtaiText').value='Summarize the deadline';
    const actions=[],scope=()=>({identity:state.identity,epoch:state.requestEpoch});
    const ctx={...ui,state,window:{confirm:()=>true},
      safeIdentity:()=>true,isExplicitActionCommand:()=>false,
      owner:()=> '111',ownerRequestScope:scope,
      isOwnerRequestCurrent:s=>s.identity===state.identity&&s.epoch===state.requestEpoch,
      buildMemoryContext:()=>[],setBusy:v=>{state.busy=v},
      notice:()=>{},addBubble:()=>{},renderBrief:()=>{},
      renderActionMatches:()=>{},actionDraftValid:action=>action?.intent==='draft_message',
      canSendDraft:()=>false,
      request:async endpoint=>{actions.push(endpoint);return {
        ok:true,text:'Here is the response',brief:{tasks:[]},
        action:{intent:'draft_message',recipientQuery:'Alice',message:'Draft reply'}
      }}
    };
    await controller('async function generate',ctx)();
    assert.deepEqual(actions,['/api/vetogram-ai']);
    if(mode==='brief')assert.ok(state.brief);
    else{
      assert.equal(state.actionDraft.message,'Draft reply');
      assert.equal(ui.get('vtaiDraft').value,'Draft reply');
      assert.equal(ui.get('vtaiSend').disabled,true);
    }
    assert.equal(state.busy,false);
  }
});


test('shared HTTP boundary rejects old A response after A → B → A, without resetting fresh A',async()=>{
  let resolveFetch,resetCount=0;
  const pending=new Promise(resolve=>{resolveFetch=resolve});
  const state={identity:'signed-A',requestEpoch:1};
  let signed='signed-A',ownerId='111';
  const context={state,
    signed:()=>signed,owner:()=>ownerId,
    ownerRequestScope:()=>({identity:state.identity,ownerId,epoch:state.requestEpoch}),
    isOwnerRequestCurrent:scope=>scope.identity===state.identity&&
      scope.identity===signed&&scope.ownerId===ownerId&&scope.epoch===state.requestEpoch,
    oldRequestCanReset:(current,original)=>current===original,
    reset:()=>{resetCount++;state.identity=null;state.requestEpoch++},
    AbortController,fetch:async()=>pending,setTimeout,clearTimeout
  };
  const original=controller('async function request',context);
  const result=original('/api/vetogram-ai',{mode:'brief'},true);
  // A completes after the active account has already changed to B and back
  // to A, but the reset epoch has advanced. The old result is not valid.
  state.identity='signed-B';signed='signed-B';ownerId='222';state.requestEpoch++;
  state.identity='signed-A';signed='signed-A';ownerId='111';state.requestEpoch++;
  resolveFetch({ok:true,json:async()=>({ok:true,brief:{tasks:['old']}})});
  await assert.rejects(result,/Старый запрос отменён/);
  assert.equal(resetCount,0);
  assert.equal(state.identity,'signed-A');
  assert.equal(state.requestEpoch,3);
});
test('shared HTTP boundary rejects response for a different signed Telegram account',async()=>{
  let resolveFetch,resetCount=0;
  const pending=new Promise(resolve=>{resolveFetch=resolve});
  const state={identity:'signed-B',requestEpoch:4};
  let signed='signed-B',ownerId='222';
  const context={state,signed:()=>signed,owner:()=>ownerId,
    ownerRequestScope:()=>({identity:state.identity,ownerId,epoch:state.requestEpoch}),
    isOwnerRequestCurrent:scope=>scope.identity===state.identity&&
      scope.identity===signed&&scope.ownerId===ownerId&&scope.epoch===state.requestEpoch,
    oldRequestCanReset:(current,original)=>current===original,
    reset:()=>{resetCount++;state.identity=null;state.requestEpoch++},
    AbortController,fetch:async()=>pending,setTimeout,clearTimeout
  };
  const request=controller('async function request',context);
  const outcome=request('/api/vetogram-ai',{mode:'chat'},true);
  // The currently signed Telegram account changes before the HTTP reply.
  signed='signed-C';ownerId='333';
  resolveFetch({ok:true,json:async()=>({ok:true,text:'private B data'})});
  await assert.rejects(outcome,/Аккаунт изменился/);
  assert.equal(resetCount,1);
  assert.equal(state.identity,null);
  assert.equal(state.requestEpoch,5);
});
