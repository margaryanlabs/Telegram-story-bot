import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const source=await readFile(new URL('../v10/living-universe.js',import.meta.url),'utf8');
function harness(options={}){
  const calls=[];
  let view='archive',replay=false;
  const location={hash:'#archive?theme=Risk&q=BTC'};
  const original={id:'alpha',alias:'ALPHA'};
  const card={
    dataset:{storyId:'alpha'},
    focus(opts){calls.push({action:'focus',preventScroll:opts?.preventScroll===true})}
  };
  const drawer={
    hidden:false,
    scrollTop:options.scrollTop??420,
    scrollHeight:options.scrollHeight??1400,
    clientHeight:options.clientHeight??700,
    classList:{remove(){}},
    querySelector:()=>null
  };
  const invisible={hidden:true};
  const app={dataset:{},removeAttribute(){}};
  const archiveGrid={
    querySelectorAll:selector=>{
      calls.push({action:'query',selector});
      return options.cardMissing?[]:[card];
    }
  };
  const nodes={drawer,birthOverlay:invisible,memoryDive:invisible,app,archiveGrid};
  const document={
    getElementById:id=>nodes[id]||invisible,
    querySelectorAll:()=>[],
    addEventListener(){}
  };
  class MutationObserver{observe(){}}
  const router={
    read:()=>({view,id:original.id}),
    visit(next,params={}){if(!replay){view=next;location.hash=next==='story'?'#story/'+params.id:'#'+next}},
    get replay(){return replay},
    previousView:()=>view==='story'?'archive':null,
    dismiss(){},
    start(){}
  };
  const V={
    navigation:()=>router,
    reader:{init(){},mount(){}},
    atmosphere:{init(){}},
    motion:{skip:()=>true,seen(){}},
    trails:{onStory(){}},
    archive:{getSort:()=> 'curated'},
    data:{themes:{}},
    legacy:{}
  };
  const context={window:{MarketV10:V},document,location,MutationObserver};
  runInNewContext(source,context);
  const api={
    stories:[original],
    base:{
      cancelDive(){},
      closeDrawer(){drawer.hidden=true},
      showStory(){drawer.hidden=false},
      showArchive(){drawer.hidden=false;drawer.scrollTop=0;calls.push({action:'render-archive'})},
      drawArchive(){}
    },
    getArchive:()=>({theme:'Risk',q:'BTC'}),
    focus(){},lensAll(){},closeLens(){},toast(){},
    restoreStar(){},returnTarget:()=>null,guided:()=>false
  };
  const wrappers=V.install(api);
  function enterFromArchive(){wrappers.beginDive(0);}
  function backToArchive(hash='#archive?theme=Risk&q=BTC'){
    view='archive';replay=true;location.hash=hash;
    wrappers.showArchive();
    replay=false;
  }
  return {wrappers,router,location,drawer,card,calls,
    enterFromArchive,backToArchive,
    setRoute(next,isReplay,hash){view=next;replay=isReplay;location.hash=hash||'#'+next;}
  };
}

test('RC5 wrapper is valid JavaScript and does not store archive position on the network',()=>{
  assert.doesNotThrow(()=>new Script(source));
  assert.match(source,/let router,travelling=false,archiveReturn=null/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|sendBeacon|XMLHttpRequest/);
});

test('Returning to an archive story restores precise drawer scroll and focus',()=>{
  const app=harness();
  app.enterFromArchive();
  assert.equal(app.location.hash,'#story/alpha');
  app.backToArchive();
  assert.equal(app.drawer.scrollTop,420);
  assert.equal(app.location.hash,'#archive?theme=Risk&q=BTC');
  assert.deepEqual(app.calls.filter(call=>call.action==='focus').map(call=>call.preventScroll),[true]);
  assert.ok(app.calls.some(call=>call.action==='query'&&call.selector==='button[data-story-id]'));
});

test('Archive scroll is safely capped when the filtered list became shorter',()=>{
  const app=harness({scrollTop:900,scrollHeight:620,clientHeight:540});
  app.enterFromArchive();app.backToArchive();
  assert.equal(app.drawer.scrollTop,80);
  assert.equal(app.calls.filter(call=>call.action==='focus').length,1);
});

test('Missing origin record never focuses an unrelated archive card',()=>{
  const app=harness({cardMissing:true});
  app.enterFromArchive();app.backToArchive();
  assert.equal(app.drawer.scrollTop,420);
  assert.equal(app.calls.filter(call=>call.action==='focus').length,0);
});

test('Opening Archive explicitly does not apply stale history restoration',()=>{
  const app=harness();
  app.enterFromArchive();
  app.setRoute('universe',false,'#universe');
  app.wrappers.showArchive();
  assert.equal(app.drawer.scrollTop,0);
  app.calls.length=0;
  app.backToArchive();
  assert.equal(app.drawer.scrollTop,0);
  assert.equal(app.calls.filter(call=>call.action==='focus').length,0);
});

test('Returning to a different filtered archive does not restore prior scroll',()=>{
  const app=harness();
  app.enterFromArchive();
  app.backToArchive('#archive?theme=Patience&q=ETH');
  assert.equal(app.drawer.scrollTop,0);
  assert.equal(app.calls.filter(call=>call.action==='focus').length,0);
});
