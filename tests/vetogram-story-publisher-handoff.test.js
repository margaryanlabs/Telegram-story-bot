/* V4.6: production Story Engine → Publisher handoff and Portal consent.
 * Executes real app.js closure functions with browser/API test doubles.
 * NOT a live Telegram Business publication or native WebView run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const engine=readFileSync(new URL('../public/story-engine.js',import.meta.url),'utf8');
const noir=readFileSync(new URL('../public/vetogram-noir.css',import.meta.url),'utf8');
const ai=readFileSync(new URL('../public/vetogram-ai.js',import.meta.url),'utf8');

const composerVars=app.slice(app.indexOf('  let composerFile ='),
  app.indexOf('  let viewerState ='));
const composerActions=app.slice(app.indexOf('  function resetComposer('),
  app.indexOf('  function relativeTime('));
// Node does not accept plain-object mock files in URL.createObjectURL().
class FakeBrowserURL extends URL{
  static createObjectURL(){return 'blob:local-preview'}
  static revokeObjectURL(){}
}
assert.match(composerVars,/let composerPortalHandoff/);
assert.match(composerActions,/window\.VetoTelegramStageStory/);

function setup({slow=false}={}){
  const nodes=new Map(),calls=[],toasts=[],sheets=[],signals=[];
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{
      hidden:false,checked:false,disabled:false,value:'',textContent:'',
      src:'',className:'',dataset:{},
      removeAttribute(key){if(key==='src')this.src='';},
      dispatchEvent(event){signals.push([id,event.type])},
      click(){signals.push([id,'click'])},
    });
    return nodes.get(id);
  };
  const tg={initData:'signed-111',initDataUnsafe:{user:{id:111}}};
  const window={
    location:{origin:'https://vetogram.test'},
    crypto:{randomUUID:()=> 'nonce-123'},
    confirm:()=>true,
    Telegram:{WebApp:tg}
  };
  let complete=null;
  const compress=async file=>slow?new Promise(resolve=>{complete=()=>resolve({
      dataUrl:'data:image/jpeg;base64,QUJD',blob:{size:600}
    })}):{dataUrl:'data:image/jpeg;base64,QUJD',blob:{size:600}};
  const state={
    processing:false,ready:true,audience:'standard',selected:[],excluded:[],
    protect:false,businessPermissions:{stories:true}
  };
  const storage={removed:[],removeItem(key){this.removed.push(key)}};
  const ctx=vm.createContext({
    state,tg,window,URL:FakeBrowserURL,Date,Math,JSON,Event:class{constructor(type){this.type=type}},
    sessionStorage:storage,selectedViewerStory:null,
    viewerState:{session:{connected:false}},
    $:el,formatBytes:n=>String(n),notify:()=>{},renderPublish:()=>{},
    showToast:v=>toasts.push(String(v)),haptic:()=>{},
    compressStoryImage:compress,telegramAccountReady:()=>true,
    api:async(action,payload)=>{
      calls.push({action,payload});return {
        published:true,storyId:'789',verifiedAudience:'standard',
        portalAreaAttached:!!payload.portalLink,transport:'bot-api'
      };
    },
    audienceLabel:()=> 'Стандарт',escapeHtml:x=>String(x),
    refreshViewerSync:async()=>{},refreshViewerAnalytics:async()=>{},
    openSheet:message=>sheets.push(message),
    connectionHelpSheet:()=>{},
  });
  new vm.Script(composerVars+'\n'+composerActions+
    '\nthis.exports={prepareComposerFile,publishComposerStory,resetComposer,'+
    'getState:()=>({composerDataUrl,composerPortalHandoff,composerGeneration,composerOwner,composerFromStudio})};'
  ).runInContext(ctx);
  const url='https://vetogram.test/portal.html#p=abc_DEF-21';
  const jpeg={name:'vetogram-story.jpg',type:'image/jpeg',size:700};
  return {...ctx.exports,window,state,el,calls,toasts,sheets,signals,url,jpeg,storage,
    complete:()=>complete?.()};
}
test('direct bridge stages JPEG without DataTransfer and requires a new Portal consent',async()=>{
  const s=setup();
  const result=await s.window.VetoTelegramStageStory({
    file:s.jpeg,caption:'Текст с AI',portalLink:s.url,ownerId:'111',
    draftId:'draft-7',stillCurrent:()=>true
  });
  assert.equal(result,true);
  assert.equal(s.getState().composerPortalHandoff.url,s.url);
  assert.equal(s.el('storyPortalHandoff').hidden,false);
  assert.equal(s.el('storyPortalConfirm').checked,false);
  assert.equal(s.el('storyCaption').value,'Текст с AI');
  assert.equal(s.getState().composerDataUrl.startsWith('data:image/jpeg'),true);
  assert.equal(s.getState().composerFromStudio,true);
});
test('a public Portal link is sent only after separate checkbox and confirmation',async()=>{
  const s=setup();
  await s.window.VetoTelegramStageStory({
    file:s.jpeg,caption:'Good story',portalLink:s.url,ownerId:'111',stillCurrent:()=>true
  });
  await s.publishComposerStory();
  assert.equal(s.calls.length,1);
  assert.equal('portalLink' in s.calls[0].payload,false);
  assert.equal(s.calls[0].payload.caption,'Good story');
  await s.window.VetoTelegramStageStory({
    file:s.jpeg,caption:'Public Story',portalLink:s.url,ownerId:'111',stillCurrent:()=>true
  });
  s.el('storyPortalConfirm').checked=true;
  await s.publishComposerStory();
  assert.equal(s.calls[1].payload.portalLink,s.url);
  assert.match(s.sheets.at(-1),/Кликабельный Portal подтверждён/);
});
test('nonstandard audience and unavailable Business permission block linked Story',async()=>{
  const s=setup();
  await s.window.VetoTelegramStageStory({
    file:s.jpeg,portalLink:s.url,ownerId:'111',stillCurrent:()=>true
  });
  s.el('storyPortalConfirm').checked=true;
  s.state.audience='all';
  await s.publishComposerStory();
  assert.equal(s.calls.length,0);
  assert.match(s.toasts.at(-1),/только для стандартной аудитории/);
  s.state.audience='standard';s.state.businessPermissions.stories=false;
  await s.publishComposerStory();
  assert.equal(s.calls.length,0);
  assert.match(s.toasts.at(-1),/Telegram Business/);
});
test('replacing photo immediately removes stale Portal, no link follows the new image',async()=>{
  const s=setup();
  await s.window.VetoTelegramStageStory({
    file:s.jpeg,portalLink:s.url,ownerId:'111',stillCurrent:()=>true
  });
  s.el('storyPortalConfirm').checked=true;
  await s.prepareComposerFile({name:'my-photo.jpg',type:'image/jpeg',size:800});
  assert.equal(s.el('storyPortalHandoff').hidden,true);
  assert.equal(s.el('storyPortalConfirm').checked,false);
  assert.equal(s.getState().composerPortalHandoff,null);
  assert.equal(s.getState().composerFromStudio,false);
  await s.publishComposerStory();
  assert.equal('portalLink' in s.calls[0].payload,false);
});
test('late compression or an editor revision change cannot hand off stale Story',async()=>{
  const s=setup({slow:true});
  let current=true;
  const p=s.window.VetoTelegramStageStory({
    file:s.jpeg,portalLink:s.url,ownerId:'111',stillCurrent:()=>current
  });
  current=false;
  s.complete();
  assert.equal(await p,false);
  assert.equal(s.getState().composerDataUrl,'');
  assert.equal(s.el('storyPortalHandoff').hidden,true);
  assert.equal(s.getState().composerPortalHandoff,null);
});
test('foreign owner, portal host and invalid links are rejected',async()=>{
  const s=setup();
  await assert.rejects(
    s.window.VetoTelegramStageStory({file:s.jpeg,ownerId:'222',stillCurrent:()=>true}),
    /Telegram-аккаунт/
  );
  await assert.rejects(
    s.window.VetoTelegramStageStory({
      file:s.jpeg,portalLink:'https://evil.test/portal.html#p=abc',
      ownerId:'111',stillCurrent:()=>true
    }),
    /Portal-ссылка/
  );
  assert.equal(s.getState().composerPortalHandoff,null);
  assert.equal(s.getState().composerDataUrl,'');
});
test('actual producer and UI require separate consent and use new native bridge',()=>{
  assert.match(engine,/await window\.VetoTelegramStageStory\(/);
  assert.match(engine,/const stillCurrent=\(\)=>owner\(\)===exportOwner/);
  assert.match(engine,/if\(!accepted \|\| !stillCurrent\(\)\)/);
  assert.match(html,/id="storyPortalConfirm" type="checkbox" \/>/);
  assert.doesNotMatch(html,/id="storyPortalConfirm" type="checkbox" checked/);
  assert.match(app,/attachPortal\?\{portalLink:composerPortalHandoff\.url\}:\{\}/);
  assert.match(app,/result\.portalAreaAttached===true/);
  assert.match(html,/app\.js\?v=20261025-v4-6/);
  assert.match(html,/id="storySourceStatus" hidden/);
  assert.match(app,/if\(sourceBadge\)sourceBadge\.hidden=!\(composerFromStudio/);
  assert.match(noir,/V4\.6 Publisher source provenance/);
  assert.match(ai,/signed:scope\.identity,story,replacePortal,portal/);
  assert.match(engine,/const requestedSigned=String\(requested\?\.signed\|\|''\)/);
});
test('AI → Story editor rejects sessionless and stale-session apply requests',async()=>{
  const handler=engine.slice(engine.indexOf('async function applyAiStorySuggestion(requested){'),
    engine.indexOf('window.VetoTelegramApplyAiStory='));
  assert.match(handler,/requestedSigned!==String\(tg\?\.initData\|\|''\)/);
  let ready;
  const tg={initData:'signed-owner-a'};
  const ctx=vm.createContext({
    tg,state:{owner:'111',draft:{id:'story-1'}},owner:()=> '111',
    init:()=>new Promise(resolve=>{ready=resolve}),
  });
  new vm.Script(handler+'\nthis.exports={applyAiStorySuggestion};').runInContext(ctx);
  const sample={ownerId:'111',story:{title:'Новый текст',subtitle:'Проверка'}};
  assert.equal(await ctx.exports.applyAiStorySuggestion(sample),false);
  assert.equal(await ctx.exports.applyAiStorySuggestion({...sample,signed:'signed-B'}),false);
  const pending=ctx.exports.applyAiStorySuggestion({...sample,signed:'signed-owner-a'});
  tg.initData='signed-owner-b';
  ready();
  assert.equal(await pending,false);
});

