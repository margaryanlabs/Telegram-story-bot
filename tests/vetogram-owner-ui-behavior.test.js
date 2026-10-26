import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual functions from the browser controller, not rewritten test
// doubles. This intentionally runs offline without DOM, npm packages or APIs.
const browser=readFileSync(new URL('../public/vetogram-ai.js',import.meta.url),'utf8');
const storyController=readFileSync(new URL('../public/story-engine.js',import.meta.url),'utf8');
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
      busy:false,generateIntent:0,mode,history:[],memory:[],selectedNotes:new Set(),
      actionDraft:null,actionRecipientConfirmed:null,dialogs:[],last:null};
    ui.get('vtaiConsent').checked=true;
    ui.get('vtaiText').value='Summarize the deadline';
    const actions=[],scope=()=>({identity:state.identity,epoch:state.requestEpoch});
    const ctx={...ui,state,AbortController,window:{confirm:()=>true},
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


function taskEditorSwitchFixture(kind){
  const ui=fakeUi(),created=[];
  ui.get('vtaiTasksList').append=()=>{};
  const original={
    owner:'111',id:uuid,title:'Account A task',sourceQuote:'Account A original quote',
    deadlineText:null,certainty:'explicit',status:'open',dueAt:null,
    kind:'task',createdAt:12345
  };
  const state={identity:'signed-A',requestEpoch:1,taskFilter:'open',
    reminders:[],tasks:[original],last:'',sendIntent:null,
    reviewedApprovalId:null};
  const counters={updates:0,mode:0,confirm:0};
  const element=tag=>{
    const node={tag,children:[],events:{},value:'',textContent:'',
      type:'',className:'',hidden:false,disabled:false,
      append(...children){this.children.push(...children)},
      setAttribute(){},
      addEventListener(name,callback){this.events[name]=callback}};
    created.push(node);
    return node;
  };
  const switchAccount=()=>{
    counters.confirm++;
    state.identity='signed-B';state.requestEpoch++;
    // Same task UUID on B is deliberately adversarial.
    state.tasks=[{...original,owner:'222',title:'Account B task'}];
    return true;
  };
  const context={...ui,state,document:{createElement:element},
    owner:()=>state.identity==='signed-A'?'111':'222',
    ownerTasks:(items,owner)=>items.filter(t=>t.owner===owner),
    taskOverview:()=>({total:1,open:1,deferred:0,done:0,overdue:0,
      tasks:[original]}),
    ownerRequestScope:()=>({identity:state.identity,epoch:state.requestEpoch}),
    isOwnerRequestCurrent:s=>s.identity===state.identity&&s.epoch===state.requestEpoch,
    safeIdentity:()=>true,taskReminderEditAllowed:()=>kind==='status'?switchAccount():true,
    updateOwnerTask:()=>{counters.updates++;return []},
    renderTasks:()=>{throw Error('Stale edit must never redraw B')},
    setMode:()=>{counters.mode++;throw Error('Stale task must not open B editor')},
    window:{confirm:switchAccount},notice:()=>{}};
  controller('function renderTasks',context)();
  const button=label=>created.find(n=>n.tag==='button'&&n.textContent===label);
  return {state,counters,created,button,original};
}
test('Task Center date edit cannot cross account while confirmation modal is open',()=>{
  const f=taskEditorSwitchFixture('date');
  const date=f.created.find(n=>n.tag==='input'&&n.type==='datetime-local');
  assert.ok(date);
  date.value='2026-11-24T18:30';
  const button=f.button('Сохранить дату');
  assert.ok(button?.events.click);
  button.events.click();
  assert.equal(f.counters.confirm,1);
  assert.equal(f.counters.updates,0);
  assert.equal(f.state.tasks[0].owner,'222');
  assert.equal(f.state.tasks[0].title,'Account B task');
});
test('Task Center delete cannot delete B task after A confirmation',()=>{
  const f=taskEditorSwitchFixture('delete');
  const button=f.button('Удалить задачу');
  assert.ok(button?.events.click);
  button.events.click();
  assert.equal(f.counters.confirm,1);
  assert.equal(f.state.tasks.length,1);
  assert.equal(f.state.tasks[0].owner,'222');
});
test('Task Center follow-up cannot copy private task A into B draft',()=>{
  const f=taskEditorSwitchFixture('followup');
  const button=f.button('Подготовить follow-up');
  assert.ok(button?.events.click);
  button.events.click();
  assert.equal(f.counters.confirm,1);
  assert.equal(f.counters.mode,0);
  assert.equal(f.state.tasks[0].owner,'222');
  assert.equal(f.created.some(n=>n.textContent==='Account B task'),false);
});
test('Task Center status updates reject owner switch during claimed-reminder consent',()=>{
  const f=taskEditorSwitchFixture('status');
  const button=f.button('✓ Готово');
  assert.ok(button?.events.click);
  button.events.click();
  assert.equal(f.counters.confirm,1);
  assert.equal(f.counters.updates,0);
  assert.equal(f.state.tasks[0].owner,'222');
});


test('AI Memory cloud save never uses B data after A consent dialog',async()=>{
  const ui=fakeUi(),state={identity:'signed-A',requestEpoch:1,memory:[{owner:'111'}]};
  let writes=0;
  const context={...ui,state,
    safeIdentity:()=>true,
    ownerRequestScope:()=>({identity:state.identity,epoch:state.requestEpoch}),
    isOwnerRequestCurrent:s=>s.identity===state.identity&&s.epoch===state.requestEpoch,
    window:{confirm:()=>{state.identity='signed-B';state.requestEpoch=2;
      state.memory=[{owner:'222'}];return true}},
    writeMemoryCloud:async()=>{writes++}
  };
  await controller('async function saveMemoryCloud',context)();
  assert.equal(writes,0);
  assert.equal(state.memory[0].owner,'222');
});
test('Story Engine transfer rejects stale owner before navigating or applying A story',async()=>{
  const ui=fakeUi(),state={identity:'signed-A',requestEpoch:1,busy:false};
  ui.get('vtaiStoryTitle').value='Account A title';
  ui.get('vtaiStorySubtitle').value='Account A subtitle';
  ui.get('vtaiPortalReview').hidden=true;
  let navigation=0,applied=0;
  const context={...ui,state,safeIdentity:()=>true,
    ownerRequestScope:()=>({identity:state.identity,epoch:state.requestEpoch,ownerId:'111'}),
    isOwnerRequestCurrent:s=>s.identity===state.identity&&s.epoch===state.requestEpoch,
    notice:()=>{},
    window:{
      confirm:()=>{state.identity='signed-B';state.requestEpoch=2;return true},
      VetoTelegramNavigate:()=>{navigation++;return true},
      VetoTelegramApplyAiStory:async()=>{applied++;return true}
    }
  };
  await controller('async function applyStory',context)();
  assert.equal(navigation,0);
  assert.equal(applied,0);
});
test('Second Brain confirmations cannot save A quote/task in B workspace',()=>{
  for(const action of ['Добавить в мои заметки','＋ В Task Center']){
    const ui=fakeUi(),created=[];
    ui.get('vtaiBriefList').append=()=>{};
    const item={kind:'task',title:'Account A payment',sourceQuote:'Account A private source quote',
      deadlineText:'tomorrow',certainty:'explicit'};
    const state={identity:'signed-A',requestEpoch:1,brief:{items:[item]},memory:[],tasks:[]};
    const counters={writes:0};
    const element=tag=>{
      const node={tag,events:{},children:[],value:'',textContent:'',
        append(...children){this.children.push(...children)},
        addEventListener(name,handler){this.events[name]=handler}};
      created.push(node);return node;
    };
    const context={...ui,state,document:{createElement:element},
      safeIdentity:()=>true,owner:()=>state.identity==='signed-A'?'111':'222',
      ownerRequestScope:()=>({identity:state.identity,epoch:state.requestEpoch}),
      isOwnerRequestCurrent:s=>s.identity===state.identity&&s.epoch===state.requestEpoch,
      window:{crypto:{randomUUID:()=>uuid},confirm:()=>{
        state.identity='signed-B';state.requestEpoch++;
        state.brief={items:[]};return true;
      }},
      MAX_MEMORY_NOTES:8,MAX_TASKS:24,
      crypto:{randomUUID:()=>uuid},
      makeMemoryNote:()=>{counters.writes++;throw Error('Should not create A note in B')},
      makeOwnerTask:()=>{counters.writes++;throw Error('Should not create A task in B')},
      renderMemory:()=>{counters.writes++},
      renderTasks:()=>{counters.writes++},
      notice:()=>{}
    };
    controller('function renderBrief',context)();
    const button=created.find(e=>e.tag==='button'&&e.textContent===action);
    assert.ok(button?.events.click,action);
    button.events.click();
    assert.equal(counters.writes,0);
    assert.equal(state.memory.length,0);
    assert.equal(state.tasks.length,0);
  }
});
test('clipboard and bulk task clearing use current owner after explicit consent',()=>{
  const js=browser;
  const start=js.indexOf("$('vtaiTasksClear').addEventListener");
  const stop=js.indexOf("$('vtaiTasksCloudLoad').addEventListener",start);
  const taskHandlers=js.slice(start,stop);
  assert.match(taskHandlers,/const scope=ownerRequestScope\(\)/);
  assert.equal((taskHandlers.match(/if\(!isOwnerRequestCurrent\(scope\)\)return;/g)||[]).length,2);
  assert.match(taskHandlers,/navigator\.clipboard\.writeText\(value\)\.then\(/);
  assert.match(taskHandlers,/if\(isOwnerRequestCurrent\(scope\)\)/);
  const story=js.slice(js.indexOf('async function applyStory()'),
    js.indexOf('function renderApprovals()',js.indexOf('async function applyStory()')));
  const approval=story.indexOf('window.confirm(');
  const guard=story.indexOf('if(!isOwnerRequestCurrent(scope))return;',approval);
  const navigation=story.indexOf('VetoTelegramNavigate',guard);
  const apply=story.indexOf('VetoTelegramApplyAiStory',navigation);
  assert.ok(approval>=0&&guard>approval&&navigation>guard&&apply>navigation);
});


test('Story Engine receiver rejects owner switch while waiting for init',async()=>{
  const marker='async function applyAiStorySuggestion(';
  const start=storyController.indexOf(marker),end=storyController.indexOf('\n}\n',start);
  assert.ok(start>=0&&end>start);
  let resolveInit;
  const ownerState={owner:'111',draft:{id:'story-A',title:'Original title',
    subtitle:'Original subtitle',caption:'Old',photo:'kept'}};
  let owner='111',renders=0;
  const fn=vm.runInNewContext('('+storyController.slice(start,end+2)+')',
    vm.createContext({
      tg:{get initData(){return 'signed-'+owner}},owner:()=>owner,
      init:()=>new Promise(resolve=>{resolveInit=resolve}),
      state:ownerState,
      trimText:(x,n)=>String(x).slice(0,n),
      normalizePortal:x=>x,clearPublicPortalLink:()=>{},
      $:()=>({checked:true,style:{},hidden:true,disabled:true}),render:()=>{renders++},notify:()=>{}
    }));
  const promise=fn({ownerId:'111',signed:'signed-111',story:{title:'Account A private title',subtitle:'Private subtitle'}});
  owner='222';ownerState.owner='222';
  ownerState.draft={id:'story-B',title:'Account B original',subtitle:'B subtitle'};
  resolveInit();
  const success=await promise;
  assert.equal(success,false);
  assert.equal(ownerState.draft.title,'Account B original');
  assert.equal(renders,0);
});
test('Story Engine receiver accepts owner-approved text only, preserving unrelated media and portal',async()=>{
  const marker='async function applyAiStorySuggestion(';
  const start=storyController.indexOf(marker),end=storyController.indexOf('\n}\n',start);
  assert.ok(start>=0&&end>start);
  const savedPortal={type:'link',title:'Existing portal'};
  const state={owner:'111',draft:{id:'story-A',title:'Old',subtitle:'Old',
    caption:'Old caption',photoId:'keep-this-photo',portal:savedPortal}};
  let renders=0,clears=0;
  const fn=vm.runInNewContext('('+storyController.slice(start,end+2)+')',
    vm.createContext({tg:{initData:'signed-111'},checkpoint:()=>{},owner:()=> '111',init:async()=>{},state,
      trimText:(x,n)=>String(x??'').slice(0,n),
      normalizePortal:x=>x,
      aiEditableFields:(draft,withPortal)=>JSON.stringify({
        title:draft.title,subtitle:draft.subtitle,caption:draft.caption,
        ...(withPortal?{portal:draft.portal}:{})
      }),
      clearPublicPortalLink:()=>{clears++},
      $:()=>({checked:true,style:{},hidden:true,disabled:true}),render:()=>{renders++},notify:()=>{}
    }));
  const success=await fn({ownerId:'111',signed:'signed-111',story:{
    title:'Proposed AI title',subtitle:'Proposed subtitle',caption:'Suggested'
  },replacePortal:false});
  assert.equal(success,true);
  assert.equal(state.draft.title,'Proposed AI title');
  assert.equal(state.draft.subtitle,'Proposed subtitle');
  assert.equal(state.draft.caption,'Suggested');
  assert.equal(state.draft.photoId,'keep-this-photo');
  assert.equal(state.draft.portal,savedPortal);
  assert.equal(renders,1);
  assert.equal(clears,0);
});
