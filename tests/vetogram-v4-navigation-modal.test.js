/* V4.8 real Canvas Noir cross-screen / shared-modal regressions.
 * Controlled DOM and promises, no live Telegram or browser rendering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'controller anchors: '+start);
  return source.slice(a,b);
}
const navigation=section('  // Pages without a bottom-tab button still belong','  let vetoWelcomeStep =');
const auth=section('  async function runViewerAuthAction(button, task) {','  function viewerPhoneSheet() {');
const identity=section('  function ensureComposerIdentity(){','  async function prepareComposerFile(');

function harness(){
  const events=[],windows=[],notices=[],toasts=[],listeners={};
  const classes=()=>{const set=new Set();return {
    add(...ids){for(const id of ids)set.add(id)},
    remove(...ids){for(const id of ids)set.delete(id)},
    toggle(id,on){if(on===undefined)on=!set.has(id);if(on)set.add(id);else set.delete(id);return on},
    contains:id=>set.has(id)
  }};
  const nodes=new Map();
  let restoredFocus=0;
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{
      id,hidden:id==='sheet'||id==='sheetBackdrop',
      textContent:'',innerHTML:'',value:'',disabled:false,dataset:{},
      classList:classes(),isConnected:true,
      setAttribute(name,value){this[name]=value},
      getAttribute(name){return this[name]},
      focus(){restoredFocus++},
    });
    return nodes.get(id);
  };
  const screens=['telegram','home','ai','story-engine','privacy','viewers','publish']
    .map(id=>{const e=node('screen:'+id);e.dataset.screen=id;e.classList=classes();if(id==='telegram')e.classList.add('active');return e});
  const tabs=['telegram','privacy','ai','publish'].map(id=>{const e=node('nav:'+id);e.dataset.nav=id;return e});
  const tg={initData:'signed-A',initDataUnsafe:{user:{id:111}},
    BackButton:{shown:0,hidden:0,show(){this.shown++},hide(){this.hidden++}}
  };
  const document={
    activeElement:{isConnected:true,focus(){restoredFocus++}},
    documentElement:{classList:classes()},body:{classList:classes()},
    querySelectorAll(sel){
      if(sel==='.screen')return screens;
      if(sel==='.nav-item')return tabs;
      return [];
    }
  };
  const window={
    Telegram:{WebApp:tg},scrollTo(){},
    matchMedia:()=>({matches:true}),
    dispatchEvent(evt){events.push(evt.type);listeners[evt.type]?.(evt)},
    addEventListener(name,fn){listeners[name]=fn},
  };
  const variables=Object.assign({
    currentScreen:'telegram',composerOwner:'',
    composerSignedIdentity:'signed-A',
    viewerOwnerEpoch:0,viewerSyncIntent:0,viewerAnalyticsIntent:0,
    viewerRegisteredKey:'old-registration',viewerSearchQuery:'secret',
    selectedViewerStory:'123',viewerPendingPhone:'123',viewerAuthBusy:false,
    viewerQrAbortController:null,composerDataUrl:'secret-photo',
    state:{history:[{id:'123'}],ready:true,accountConnection:{connected:true}},
    viewerState:{session:{connected:true},viewers:[{name:'private'}],analytics:{}},
    automationState:{loaded:true,jobs:[{title:'old'}],rules:{}},
  });
  const ctx=vm.createContext({
    ...variables,document,window,tg,
    SCREEN_ALIASES:{telegram:'telegram',ai:'ai',home:'home',publish:'publish',privacy:'privacy'},
    $:node,sessionStorage:{getItem:()=>'',removeItem(){}},
    DRAFT_CAPTION_KEY:'story-pilot:draft-caption',
    captionDraftStorageKey:()=>null,
    resetComposer(){ctx.composerDataUrl='';toasts.push('reset composer')},
    renderViewers(){},renderAnalytics(){},renderHome(){},renderConnection(){},
    haptic(){},refreshViewerSync:async()=>{},
    refreshViewerAnalytics:async()=>{},
    profileSheet(){notices.push('profile')},
    connectionHelpSheet(){notices.push('connection-help')},
    showToast:msg=>toasts.push(String(msg)),
    showViewerAuthError:err=>notices.push('auth-error:'+String(err.message||err)),
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    Error,Array,Boolean,console,
  });
  const expression=identity+navigation+auth+
    '\nthis.exports={openSheet,closeSheet,switchScreen,ensureComposerIdentity,'+
    'runViewerAuthAction,getState:()=>({viewerOwnerEpoch,viewerState,automationState,currentScreen})};';
  new vm.Script(expression).runInContext(ctx);
  return {ctx,window,tg,document,node,screens,events,notices,toasts,
    get restoredFocus(){return restoredFocus},
    ...ctx.exports};
}

test('switching screens closes old shared modal exactly once without returning old focus',()=>{
  const s=harness();
  s.openSheet('<strong>Old chat details</strong>');
  assert.equal(s.node('sheet').hidden,false);
  assert.equal(s.node('sheetBackdrop').hidden,false);
  assert.equal(s.tg.BackButton.shown,1);
  assert.equal(s.switchScreen('ai'),true);
  assert.equal(s.node('sheet').hidden,true);
  assert.equal(s.node('sheetBackdrop').hidden,true);
  assert.equal(s.restoredFocus,1,'focus once for initial modal open, not after cross-screen close');
  assert.equal(s.events.filter(x=>x==='vetogram:modal-closed').length,1);
  assert.equal(s.events.filter(x=>x==='veto:screen-changed').length,1);
  assert.equal(s.getState().currentScreen,'ai');
  assert.equal(s.node('nav:ai').classList.contains('active'),true);
});
test('same-screen navigation leaves active auth modal open until user closes it',()=>{
  const s=harness();
  s.openSheet('Код Telegram');
  s.switchScreen('telegram');
  assert.equal(s.node('sheet').hidden,false);
  assert.equal(s.events.includes('vetogram:modal-closed'),false);
  s.closeSheet();
  assert.equal(s.node('sheet').hidden,true);
  assert.equal(s.events.filter(x=>x==='vetogram:modal-closed').length,1);
});
test('account switching revokes shared private modal and owner-only collections',()=>{
  const s=harness();
  s.openSheet('Owner A · Auth');
  s.tg.initData='signed-B';s.tg.initDataUnsafe.user.id=222;
  s.ensureComposerIdentity();
  assert.equal(s.node('sheet').hidden,true);
  assert.equal(s.getState().viewerOwnerEpoch,1);
  assert.equal(s.getState().viewerState.session,null);
  assert.equal(s.getState().automationState.jobs.length,0);
  assert.equal(s.events.filter(x=>x==='vetogram:modal-closed').length,1);
  assert.equal(s.restoredFocus,1,'do not return to old account');
});
test('late authorization failure cannot reopen modal or unlock next owner auth',async()=>{
  const s=harness(),button=s.node('button');
  s.openSheet('Password');
  let rejectTask;
  const pending=s.runViewerAuthAction(button,()=>new Promise((resolve,reject)=>{
    rejectTask=reject;
  }));
  assert.equal(button.disabled,true);
  s.tg.initData='signed-B';s.tg.initDataUnsafe.user.id=222;
  s.ensureComposerIdentity();
  // The new owner is allowed to start their own authentication.
  s.ctx.viewerAuthBusy=true;
  rejectTask(new Error('stale phone authorization'));
  await pending;
  assert.equal(s.ctx.viewerAuthBusy,true);
  assert.equal(s.notices.some(x=>x.startsWith('auth-error:')),false);
  assert.equal(s.node('sheet').hidden,true);
});
test('connection helper never opens old-owner profile after delayed refresh',async()=>{
  const s=harness();
  let resume;
  s.ctx.refreshViewerSync=()=>new Promise(resolve=>{resume=resolve});
  const pending=s.window.VetoTelegramOpenAccountConnection();
  s.tg.initData='signed-B';s.tg.initDataUnsafe.user.id=222;
  s.ensureComposerIdentity();
  resume();
  await pending;
  assert.deepEqual(s.notices,[]);
});
test('source keeps escape and native BackButton on one canonical shared sheet',()=>{
  assert.match(source,/tg\?\.BackButton\?\.onClick\(closeSheet\)/);
  assert.match(source,/window\.VetoTelegramModal = Object\.freeze\(\{open:openSheet,close:closeSheet\}\)/);
  assert.match(source,/closeSheet\(\{restoreFocus:false\}\)/);
  assert.match(source,/if\(isCurrent\(\) && !\$\('sheet'\)\?\.hidden\)showViewerAuthError\(error\)/);
});

test('keyboard Tab wraps inside live modal and cannot escape to underlying chats',()=>{
  const sectionText=section("  document.addEventListener('keydown',event=>{",
    "  $('sheet').addEventListener('input'");
  let handler=null,focused='',closed=0;
  const first={getClientRects:()=>[{}],focus(){focused='first'}};
  const last={getClientRects:()=>[{}],focus(){focused='last'}};
  const sheet={
    hidden:false,querySelectorAll:()=>[first,last],
    contains:n=>[first,last].includes(n),focus(){focused='sheet'}
  };
  const doc={
    activeElement:last,querySelector:()=>null,
    addEventListener:(name,fn)=>{if(name==='keydown')handler=fn}
  };
  const ctx=vm.createContext({
    $:name=>name==='sheet'?sheet:null,
    document:doc,getComputedStyle:()=>({visibility:'visible'}),
    closeSheet(){closed++}
  });
  new vm.Script(sectionText).runInContext(ctx);
  assert.ok(handler,'must install real key handler');
  let blocked=false;
  handler({key:'Tab',shiftKey:false,preventDefault(){blocked=true}});
  assert.equal(blocked,true);assert.equal(focused,'first');
  doc.activeElement=first;blocked=false;
  handler({key:'Tab',shiftKey:true,preventDefault(){blocked=true}});
  assert.equal(blocked,true);assert.equal(focused,'last');
  assert.equal(closed,0);
});
test('native dialog and country picker win Escape priority over shared modal',()=>{
  const keyboard=section("  document.addEventListener('keydown',event=>{",
    "  $('sheet').addEventListener('input'");
  const sheet={hidden:false};
  let handler,closed=0,countryOpen=true,dialogOpen=false;
  const doc={
    querySelector:()=>dialogOpen?{}:null,
    addEventListener:(name,fn)=>{if(name==='keydown')handler=fn}
  };
  new vm.Script(keyboard).runInContext(vm.createContext({
    document:doc,$:name=>name==='sheet'?sheet:name==='viewerCountryPicker'?
      {hidden:!countryOpen}:null,
    closeSheet(){closed++}
  }));
  handler({key:'Escape',preventDefault(){}});
  assert.equal(closed,0);
  countryOpen=false;dialogOpen=true;
  handler({key:'Escape',preventDefault(){}});
  assert.equal(closed,0);
  dialogOpen=false;
  handler({key:'Escape',preventDefault(){}});
  assert.equal(closed,1);
});
test('Noir keyboard modal has visualViewport override with safe-area and reduced motion',()=>{
  const css=readFileSync(new URL('../public/vetogram-noir.css',import.meta.url),'utf8');
  assert.match(css,/html#vetogram\.vetogram-noir\.veto-keyboard-open body\.veto-sheet-open #sheet/);
  assert.match(css,/bottom:var\(--veto-visual-bottom,0px\)!important/);
  assert.match(css,/max-height:min\(90dvh,calc\(var\(--veto-visible-height,100dvh\) - 12px\)\)!important/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
