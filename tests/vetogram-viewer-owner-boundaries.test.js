/* V4.7: real Viewers/Analytics/Miniapp owner-switch handlers.
 * VM with controlled promises. No real Telegram session or network accessed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const slice=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing real controller '+start);
  return source.slice(a,b);
};
const identity=slice('  function ensureComposerIdentity(){','  async function prepareComposerFile(');
const analytics=slice('  async function refreshViewerAnalytics(','  async function refreshViewerSync(');
const viewers=slice('  async function refreshViewerSync(','  function renderConnection(');
const miniapp=slice('  async function api(','  async function viewerApi(');
const viewerApiFn=slice('  async function viewerApi(','  async function automationsApi(');
const automationApiFn=slice('  async function automationsApi(','  function automationRuleEnabled(');

function session(){
  let viewerOwnerEpoch=0,viewerSyncIntent=0,viewerAnalyticsIntent=0;
  let composerSignedIdentity='signed-A',viewerRegisteredKey='old-owner-key';
  let viewerSearchQuery='private A',selectedViewerStory='story-A';
  let viewerPendingPhone='+111',viewerAuthBusy=true,viewerQrAbortController=null;
  let composerGeneration=0,composerFile=null,composerDataUrl='data:image/jpeg;base64,OLD';
  let composerPreviewUrl='',composerNonce='oldnonce',composerOwner='signed-A';
  let composerBusy=false,composerPendingFileName='old.jpg',composerFromStudio=true;
  let composerPortalHandoff={url:'https://vetogram.test/portal.html#p=A'};
  let viewerState={
    session:{connected:true,account:{firstName:'Owner A'}},
    viewers:[{user_id:'old-user'}],analytics:{owner:'A'},story:{story_id:1},
    loginPending:{phone:'private'},degraded:false,error:null
  };
  let automationState={loaded:true,rules:{security_changes:true},jobs:[{text:'private'}]};
  let state={
    ready:true,connection:'ready',audience:'contacts',history:[{id:'old',ts:123}],
    lastStory:'old',activity:[{id:'A'}],analytics:{private:true},
    selected:['secret'],excluded:['exclude'],protect:true,processing:false,
    accountConnection:{connected:true},businessPermissions:{stories:true}
  };
  const tg={initData:'signed-A',initDataUnsafe:{user:{id:111}}};
  const calls=[],requests=[],notices=[],nodes=new Map();
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',checked:false,
      hidden:id==='sheet',src:'',className:'',disabled:false,
      removeAttribute(){},click(){},
    });
    return nodes.get(id);
  };
  const storage={items:new Map(),getItem(k){return this.items.get(k)||''},
    removeItem(k){this.items.delete(k)},setItem(k,v){this.items.set(k,v)}};
  const openRequests={
    viewer:[],analytics:[],miniapp:[]
  };
  const make=(kind)=>(...args)=>new Promise((resolve,reject)=>{
    openRequests[kind].push({resolve,reject,args});
  });
  const windows={Telegram:{WebApp:tg}};
  const ctx=vm.createContext({
    tg,window:windows,state,viewerState,automationState,
    viewerOwnerEpoch,viewerSyncIntent,viewerAnalyticsIntent,
    composerSignedIdentity,viewerRegisteredKey,viewerSearchQuery,selectedViewerStory,
    viewerPendingPhone,viewerAuthBusy,viewerQrAbortController,
    composerGeneration,composerFile,composerDataUrl,composerPreviewUrl,
    composerNonce,composerOwner,composerBusy,composerPendingFileName,
    composerFromStudio,composerPortalHandoff,
    DRAFT_CAPTION_KEY:'story-pilot:draft-caption',
    sessionStorage:storage,$:el,
    captionDraftStorageKey:()=>tg.initData?'caption:'+tg.initData:'',
    resetComposer(){ctx.composerDataUrl='';ctx.composerPortalHandoff=null;calls.push('resetComposer')},
    renderViewers(){calls.push('renderViewers')},
    renderAnalytics(){calls.push('renderAnalytics')},
    renderHome(){calls.push('renderHome')},
    renderConnection(){calls.push('renderConnection')},
    showToast:msg=>notices.push(String(msg)),
    viewerApi:make('viewer'),
    requestJson:make('analytics'),
    activeStoryHistory:()=>ctx.state.history||[],
    notify(){},setAvatar(){},render(){},
    apiRequests:make('miniapp'),
    URL,console,Date,Math,JSON,Error,
  });
  const script=identity+analytics+viewers+
    '\nthis.exports={ensureComposerIdentity,refreshViewerSync,refreshViewerAnalytics};';
  new vm.Script(script).runInContext(ctx);
  const setOwner=(name,id)=>{
    tg.initData='signed-'+name;tg.initDataUnsafe.user.id=id;
    ctx.exports.ensureComposerIdentity();
  };
  return {ctx,tg,storage,calls,notices,openRequests,el,setOwner,
    ...ctx.exports,get:()=>({
      state:ctx.state,viewer:ctx.viewerState,automations:ctx.automationState,
      epoch:ctx.viewerOwnerEpoch,viewerRegisteredKey:ctx.viewerRegisteredKey,
      selectedViewerStory:ctx.selectedViewerStory
    })};
}

test('switch clears old Viewers, analytics, archives, permissions and Automation',()=>{
  const s=session();
  s.storage.setItem('caption:signed-B','Draft for B');
  s.setOwner('B',222);
  const x=s.get();
  assert.equal(x.state.ready,false);
  assert.equal(x.state.audience,'standard');
  assert.equal(x.state.history.length,0);
  assert.equal(x.state.activity.length,0);
  assert.equal(x.state.selected.length,0);
  assert.equal(x.state.accountConnection.connected,false);
  assert.equal(x.viewer.session,null);
  assert.equal(x.viewer.viewers.length,0);
  assert.equal(x.viewer.analytics,null);
  assert.equal(x.automations.jobs.length,0);
  assert.equal(x.viewerRegisteredKey,'');
  assert.equal(x.selectedViewerStory,null);
  assert.equal(s.el('storyCaption').value,'Draft for B');
  assert.equal(x.epoch,1);
});
test('A → B → A prevents the original A Viewers response from returning',async()=>{
  const s=session();
  const oldA=s.refreshViewerSync({silent:true});
  s.setOwner('B',222);
  const oldB=s.refreshViewerSync({silent:true});
  s.setOwner('A',111);
  const newA=s.refreshViewerSync({silent:true});
  assert.equal(s.openRequests.viewer.length,3);
  s.openRequests.viewer[0].resolve({
    session:{connected:true,account:{firstName:'Leaked A'}},
    viewers:[{name:'old-A'}],config:{}});
  await oldA;
  s.openRequests.viewer[1].resolve({
    session:{connected:true},viewers:[{name:'old-B'}],config:{}});
  await oldB;
  assert.equal(s.get().viewer.viewers.length,0);
  s.openRequests.viewer[2].resolve({
    session:{connected:true,account:{firstName:'Current A'}},
    viewers:[{name:'current-A'}],config:{}});
  await newA;
  assert.equal(s.get().viewer.viewers[0].name,'current-A');
});
test('simultaneous Analytics checks cannot overwrite a newer answer',async()=>{
  const s=session();
  const slow=s.refreshViewerAnalytics();
  const fast=s.refreshViewerAnalytics();
  assert.equal(s.openRequests.analytics.length,2);
  s.openRequests.analytics[1].resolve({
    response:{ok:true},data:{ok:true,analytics:{latest:'new'}}
  });
  await fast;
  s.openRequests.analytics[0].resolve({
    response:{ok:true},data:{ok:true,analytics:{latest:'old'}}
  });
  await slow;
  assert.equal(s.get().viewer.analytics.latest,'new');
});
test('return to previous signed owner does not reuse old registration or identity status',()=>{
  const s=session();
  s.setOwner('B',222);
  s.setOwner('A',111);
  assert.equal(s.get().epoch,2);
  assert.equal(s.get().viewerRegisteredKey,'');
  assert.equal(s.get().viewer.session,null);
  assert.equal(s.get().state.connection,'unknown');
});
test('main, Viewer and Automation API rejects A → B → A late responses',()=>{
  for(const body of [miniapp,viewerApiFn,automationApiFn]){
    assert.match(body,/const epoch=viewerOwnerEpoch/);
    assert.match(body,/signedOwner!==String\(tg\?\.initData\|\|''\)|!isCurrent\(\)/);
  }
  assert.match(source,/if\(epoch!==viewerOwnerEpoch\)return;\s*state\.audience = previous/);
  assert.match(source,/if\(epoch!==viewerOwnerEpoch\)return;\s*state\.protect = previous/);
  assert.match(source,/window\.addEventListener\('focus',ensureComposerIdentity\)/);
  assert.match(source,/window\.addEventListener\('pageshow',ensureComposerIdentity\)/);
});

test('viewer API selects default Story ID only after account cleanup',async()=>{
  let url='';
  const tg={initData:'signed-B'};
  const ctx=vm.createContext({
    tg,viewerOwnerEpoch:0,selectedViewerStory:'old-account-story',
    ensureComposerIdentity(){
      ctx.selectedViewerStory=null;
      ctx.viewerOwnerEpoch++;
    },
    requestJson:async requested=>{
      url=requested;
      return {response:{ok:true},data:{ok:true}};
    },encodeURIComponent,
    Error,
  });
  new vm.Script(viewerApiFn+'\nthis.exports={viewerApi};').runInContext(ctx);
  const result=await ctx.exports.viewerApi();
  assert.equal(result.ok,true);
  assert.equal(url,'/api/viewer-sync');
  assert.equal(ctx.viewerOwnerEpoch,1);
  assert.equal(ctx.selectedViewerStory,null);
});
test('connected Viewer copy is conditional on confirmed background readiness',()=>{
  assert.match(source,/viewerState\.backgroundReady\s*\? 'Fast Alerts/);
});
