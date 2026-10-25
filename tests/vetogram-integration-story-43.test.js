import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const app=read('app.js'),engine=read('story-engine.js'),ai=read('vetogram-ai.js'),privacy=read('privacy.js'),chats=read('telegram-chats.js');
const between=(body,start,end)=>{
  const a=body.indexOf(start),b=body.indexOf(end,a+start.length);
  assert.ok(a>0&&b>a,'missing actual source: '+start);
  return body.slice(a,b);
};
const lifecycle=between(app,'  function resetComposer({ keepCaption = false } = {}) {','  function relativeTime(');
const apiCode=between(app,'  async function api(action = null, payload = {}) {','  async function viewerApi(');
function delay(){
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b});
  return {promise,resolve,reject};
}
function composerFixture(){
  let owner='owner-A',uuid=0,apiCalls=0;
  const jobs=new Map(),alerts=[],elements={};
  for(const id of ['storyFileInput','storyCaption','captionCounter','mediaPreview','pickStoryMedia',
    'mediaPreviewImage','mediaFileName','mediaFileMeta','composerState']){
    elements[id]={value:'',textContent:'',hidden:false,src:'',className:'',click(){this.clicked=true}};
  }
  const externalState={processing:false,ready:true,audience:'standard',selected:[],excluded:[],protect:false};
  const scope={
    tg:{get initData(){return owner}},
    $:id=>elements[id],externalState,externalViewer:{session:{connected:false}},
    window:{crypto:{randomUUID:()=>String(++uuid)}},
    sessionStorage:{removeItem(){}},URL:{createObjectURL:f=>'blob:'+f.name,revokeObjectURL(){}},
    compressStoryImage:file=>{const f=delay();jobs.set(file.name,f);return f.promise},
    renderPublish(){},notify(){},showToast:m=>alerts.push(m),formatBytes:n=>String(n),
    telegramAccountReady:()=>true,api:async()=>{apiCalls++;return {storyId:'101',transport:'telegram'}},
    audienceLabel:x=>x,haptic(){},refreshViewerSync:async()=>{},
    refreshViewerAnalytics:async()=>{},escapeHtml:String,openSheet(){},connectionHelpSheet(){}
  };
  const prelude="let composerFile=null,composerDataUrl='',composerPreviewUrl='',composerNonce='',composerBusy=false,composerGeneration=0,composerOwner='';"+
    "let selectedViewerStory=null; const state=externalState,viewerState=externalViewer;";
  const exposed="return {prepareComposerFile,resetComposer,publishComposerStory,snapshot:()=>({composerFile,composerDataUrl,composerOwner,composerBusy})};";
  const controller=new Function(...Object.keys(scope),prelude+lifecycle+exposed)(...Object.values(scope));
  return {controller,jobs,elements,alerts,state:externalState,
    setOwner:x=>{owner=x},apiCalls:()=>apiCalls};
}
const img=name=>({name,size:800,type:'image/jpeg'});
const result=name=>({dataUrl:'data:image/jpeg;base64,'+name,blob:{size:200}});
test('previous image completion never replaces a newer chosen Story image',async()=>{
  const f=composerFixture();
  const first=f.controller.prepareComposerFile(img('old'));
  const second=f.controller.prepareComposerFile(img('new'));
  f.jobs.get('new').resolve(result('new'));await second;
  f.jobs.get('old').resolve(result('old'));await first;
  assert.equal(f.controller.snapshot().composerFile.name,'new');
  assert.match(f.controller.snapshot().composerDataUrl,/base64,new/);
});
test('remove before image preparation resolves keeps Story composer empty',async()=>{
  const f=composerFixture(),task=f.controller.prepareComposerFile(img('slow'));
  f.controller.resetComposer({keepCaption:true});
  f.jobs.get('slow').resolve(result('slow'));await task;
  assert.equal(f.controller.snapshot().composerDataUrl,'');
  assert.equal(f.elements.mediaPreview.hidden,true);
});
test('owner switch mid-compression discards obsolete blob and recovers idle state',async()=>{
  const f=composerFixture(),task=f.controller.prepareComposerFile(img('owner-A'));
  f.setOwner('owner-B');f.jobs.get('owner-A').resolve(result('owner-A'));await task;
  assert.equal(f.controller.snapshot().composerDataUrl,'');
  assert.equal(f.controller.snapshot().composerOwner,'');
  assert.equal(f.controller.snapshot().composerBusy,false);
});
test('photo prepared under first account cannot be published under second account',async()=>{
  const f=composerFixture(),task=f.controller.prepareComposerFile(img('A'));
  f.jobs.get('A').resolve(result('A'));await task;
  assert.equal(f.controller.snapshot().composerOwner,'owner-A');
  f.setOwner('owner-B');await f.controller.publishComposerStory();
  assert.equal(f.apiCalls(),0);
  assert.equal(f.controller.snapshot().composerDataUrl,'');
  assert.match(f.alerts.join(' '),/Telegram-аккаунт изменился/);
});
test('new owner can prepare an image after stale request was discarded',async()=>{
  const f=composerFixture(),task=f.controller.prepareComposerFile(img('A'));
  f.setOwner('owner-B');f.jobs.get('A').resolve(result('A'));await task;
  const next=f.controller.prepareComposerFile(img('B'));
  f.jobs.get('B').resolve(result('B'));await next;
  assert.equal(f.controller.snapshot().composerOwner,'owner-B');
});
test('stale main API response cannot mutate new owner Story, activity or avatar',async()=>{
  let owner='owner-A',renders=0,avatars=0;const deferred=delay();
  const scope={tg:{get initData(){return owner}},requestJson:()=>deferred.promise,
    state:{ready:false,history:[]},selectedViewerStory:null,
    render(){renders++},setAvatar(){avatars++}};
  const run=new Function(...Object.keys(scope),apiCode+';return api')(...Object.values(scope));
  const pending=run('check');owner='owner-B';
  deferred.resolve({response:{ok:true},data:{ok:true,state:{ready:true},activity:[{x:1}],user:{id:123}}});
  await assert.rejects(pending,/Telegram-аккаунт изменился/);
  assert.equal(scope.state.ready,false);assert.equal(renders,0);assert.equal(avatars,0);
});
test('Story Engine, AI and Privacy keep true owner validation and explicit user actions',()=>{
  assert.match(engine,/owner\(\)!==exportOwner \|\| state\.owner!==exportOwner/);
  assert.match(engine,/input\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
  assert.match(engine,/window\.VetoTelegramNavigate\?\.\('publish'\)/);
  assert.doesNotMatch(engine,/publish_story['"]/);
  assert.match(app,/composerOwner !== signedOwner/);
  assert.match(app,/signedOwner !== String\(tg\?\.initData \|\| ''\)/);
  assert.match(ai,/if\(!window\.confirm\('Отправить ПОЛНЫЙ текст сообщения/);
  assert.match(ai,/if\(!isOwnerRequestCurrent\(scope\)\)return/);
  assert.match(ai,/if\(!\$\(.\s*vtaiConsent/);
  assert.match(privacy,/businessWizardConsent/);
  assert.match(privacy,/scopeConsent:/);
  assert.match(chats,/function canSendInThread\(chat\)/);
});
