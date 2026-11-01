/* VETOGRAM V4.2 mobile gesture boundaries against actual production source.
 * No Telegram API, message data, AI calls or browser permission is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const chats=read('telegram-chats.js');
const actions=read('vetogram-chat-experience-v4.js');
const story=read('story-engine.js');
const html=read('studio.html');
const css=read('vetogram-noir.css');

test('real thread stamps are owner/thread/generation scoped, never signed tokens',()=>{
  assert.match(chats,/threadBox\.dataset\.mirrorOwnerId=String\(tg\?\.initDataUnsafe\?\.user\?\.id\|\|''\)/);
  assert.match(chats,/threadBox\.dataset\.mirrorThreadId=String\(chat\.id\)/);
  assert.match(chats,/threadBox\.dataset\.mirrorThreadGeneration=String\(state\.threadGeneration\)/);
  assert.match(chats,/delete oldThreadBox\.dataset\.mirrorOwnerId/);
  assert.match(chats,/delete oldThreadBox\.dataset\.mirrorThreadId/);
  assert.match(chats,/delete oldThreadBox\.dataset\.mirrorThreadGeneration/);
  assert.doesNotMatch(chats,/dataset\.(?:mirrorOwnerId|mirrorThreadId|mirrorThreadGeneration)\s*=\s*(?:String\()?tg\?\.initData(?:\)|;)/);
});
test('V4 menu rejects stale owner or hidden/different thread',()=>{
  const begin=actions.indexOf('  function visibleOwner(){');
  const end=actions.indexOf('  function messageText(node){',begin);
  assert.ok(begin>0&&end>begin);
  const source=actions.slice(begin,end)+'\nvisibleOwner';
  const run=({actual='123',dom='123',thread='99',generation='5',shown=true,active=true}={})=>{
    const host={dataset:{mirrorOwnerId:dom,mirrorThreadId:thread,mirrorThreadGeneration:generation}};
    const tg={initData:'signed-test',initDataUnsafe:{user:{id:actual}}};
    const document={querySelector:()=>active?{}:null};
    const $=id=>id==='telegramThreadView'?{hidden:!shown}:null;
    return vm.runInNewContext(source,{host,tg,document,$})();
  };
  assert.equal(run(),true);
  assert.equal(run({actual:'999'}),false);
  assert.equal(run({thread:''}),false);
  assert.equal(run({generation:''}),false);
  assert.equal(run({shown:false}),false);
  assert.equal(run({active:false}),false);
  assert.match(actions,/threadKey\(\)!==selectedThreadKey/);
  assert.match(actions,/gesture\.threadKey===threadKey\(\)/);
});
test('long press and swipe cancel on multi touch, owner change and scroll',()=>{
  assert.match(actions,/activePointers\.size>1/);
  assert.match(actions,/signed===String\(tg\?\.initData\|\|''\)/);
  assert.match(actions,/boundThread===threadKey\(\)/);
  assert.match(actions,/activeSwipe\.threadKey!==threadKey\(\)/);
  assert.match(actions,/activeSwipe\.signed!==String\(tg\?\.initData\|\|''\)/);
  assert.match(actions,/function cancelSwipe\(\)/);
  assert.match(actions,/bubble\.style\.removeProperty\('--v4-swipe-reply-x'\)/);
  assert.match(actions,/host\.addEventListener\('scroll',\(\)=>\{cancelPress\(\);cancelSwipe\(\)/);
  assert.match(actions,/menu\.addEventListener\('close',\(\)=>\{if\(!menu\.open\)clearSelection\(\)/);
  assert.doesNotMatch(actions,/\bfetch\s*\(/);
  assert.doesNotMatch(actions,/\blocalStorage\s*\./);
});
test('real Story canvas tap has no checkpoint or movement; first deliberate drag has exactly one',()=>{
  const begin=story.indexOf('  function pointerRatio(event){');
  const end=story.indexOf('  const endDrag=',begin);
  assert.ok(begin>0&&end>begin);
  const handlers=new Map();
  const canvas={getBoundingClientRect:()=>({left:0,top:0,width:500,height:900}),
    setPointerCapture(){},addEventListener:(name,cb)=>handlers.set(name,cb)};
  const layer={id:'layer-1',x:.5,y:.55,text:'original',style:'plain'};
  const state={owner:'123',draft:{id:'draft-1',layers:[layer]},dragLayer:null,selectedLayer:null};
  let checkpoints=0,paints=0;
  const context=vm.createContext({canvas,state,owner:()=>state.owner,
    root:{classList:{contains:()=>false}},checkpoint:()=>{checkpoints++},
    renderLayers:()=>{},paint:()=>{paints++},$:()=>({value:''}),
    activePhotoGesture:false,historyGroup:''});
  new vm.Script(story.slice(begin,end)).runInContext(context);
  const evt=(x,y)=>({clientX:x,clientY:y,pointerId:10,preventDefault(){}});
  handlers.get('pointerdown')(evt(250,495));
  assert.equal(checkpoints,0);
  handlers.get('pointermove')(evt(255,501)); // jitter < 12 px
  assert.equal(layer.x,.5);assert.equal(layer.y,.55);
  assert.equal(checkpoints,0);assert.equal(paints,0);
  handlers.get('pointermove')(evt(315,510)); // deliberate drag
  assert.ok(layer.x>.6);assert.equal(checkpoints,1);
  handlers.get('pointermove')(evt(335,510));
  assert.equal(checkpoints,1);
  const before=layer.x;
  state.owner='456';handlers.get('pointermove')(evt(450,550));
  assert.equal(layer.x,before);
  assert.equal(state.dragLayer,null);
});
test('mobile affordances use real controls and release transient visuals',()=>{
  for(const id of ['telegramThreadMessages','telegramThreadView','seCanvas','seUndo',
    'seRedo','seTabLayers','seToolLayers','seLayerText']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.match(css,/\.v4-swiping-reply \.veto-mirror-bubble-inner/);
  assert.match(css,/var\(--v4-swipe-reply-x,0px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
