import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const root=new URL('../',import.meta.url);
const file=path=>readFile(new URL(path,root),'utf8');
const [html,pkgText,build,navSource,trailsSource,bridge]=await Promise.all([
  file('index.html'),file('package.json'),file('scripts/build.mjs'),
  file('v10/navigation.js'),file('v10/memory-trails.js'),file('v10/living-universe.js')
]);
const pkg=JSON.parse(pkgText);

test('V12 is one cumulative release candidate, not another disconnected scene',()=>{
  assert.match(html,/<title>THE MARKET REMEMBERS V12 — RELEASE CANDIDATE<\/title>/);
  assert.match(html,/(?:THE LIVING UNIVERSE \/ V12 RELEASE CANDIDATE|THE LIVING UNIVERSE \/ CINEMATIC RC2)/);
  assert.equal(pkg.version,'12.0.0-rc.6');
  assert.match(html,/локальная демоверсия/);
  assert.match(bridge,/V\.reader\.mount\(record,shared\)/);
  assert.match(bridge,/V\.trails\.onStory\(record,shared\)/);
  assert.match(bridge,/V\.archive\.mount\(shared\)/);
  assert.match(bridge,/V\.trails\.mountArchive\(shared\)/);
});

test('All cumulative modules are loaded once and in dependency order',()=>{
  const modules=[
    'memory-data','motion-system','universe-atmosphere','constellation-system',
    'story-experience','memory-archive','legacy-submission','navigation',
    'memory-trails','living-universe'
  ];
  const positions=modules.map(name=>{
    const tag='<script src="v10/'+name+'.js"></script>';
    assert.equal(html.split(tag).length-1,1,name+' should load exactly once');
    return html.indexOf(tag);
  });
  assert.ok(positions.every((pos,i)=>i===0||pos>positions[i-1]));
  const layers=[
    'cosmic-awakening.css','star-passage-v11.css','memory-atlas-v11.css',
    'memory-trails-v11.css','explainable-constellations-v11.css'
  ];
  layers.forEach(name=>assert.equal(html.split('href="v10/'+name+'"').length-1,1,name));
  assert.doesNotThrow(()=>new Script(navSource));
  assert.doesNotThrow(()=>new Script(trailsSource));
});

test('Release metadata explicitly discloses non-production, local-only publishing',()=>{
  assert.match(build,/release\.json/);
  assert.match(build,/version:'12\.0\.0-rc\.6'/);
  assert.match(build,/production:false/);
  assert.match(build,/publishing:'local-browser-only'/);
  assert.match(build,/savedRoutes:'opt-in, browser-only'/);
});

test('Corrupt saved route with one private or missing record is rejected in full',()=>{
  const saved={
    version:1,routes:[
      {id:'mixed-1',ids:['a','private','b']},
      {id:'missing-1',ids:['a','unavailable','b']},
      {id:'safe-1',ids:['a','b']}
    ]
  };
  const storage={getItem:()=>JSON.stringify(saved),setItem:()=>{}};
  const ctx={window:{localStorage:storage,MarketV10:{data:{themes:{Risk:'Риск'}}}}};
  runInNewContext(trailsSource,ctx);
  const records=[
    {id:'a',local:false,type:'fictional'},
    {id:'b',local:false,type:'editorial'},
    {id:'private',local:true,type:'fictional'}
  ];
  const visible=ctx.window.MarketV10.trails.createModel(storage).saved(records);
  assert.deepEqual(Array.from(visible,r=>r.id),['safe-1']);
  assert.deepEqual(Array.from(visible[0].records,r=>r.id),['a','b']);
});

test('Saving the expanded trail does not collapse the reader panel',()=>{
  assert.match(trailsSource,/const wasOpen=!!previous\?\.open/);
  assert.match(trailsSource,/panel\.open=wasOpen/);
  assert.match(trailsSource,/if\(existing&&!force\)return/);
  assert.doesNotMatch(trailsSource,/fetch\(|XMLHttpRequest|sendBeacon|new WebSocket/);
});

test('Deep-link router resolves existing story, archive and broken personal URL safely',()=>{
  const listeners={};
  const loc={hash:'#archive?theme=Risk&q=BTC',href:'https://example.invalid/#archive?theme=Risk&q=BTC'};
  const history={
    state:null,
    replaceState(s,title,hash){this.state=s;loc.hash=hash;loc.href='https://example.invalid/'+hash},
    pushState(s,title,hash){this.state=s;loc.hash=hash;loc.href='https://example.invalid/'+hash},
    back(){}
  };
  const calls=[];
  const stories=[{id:'demo-1',alias:'ORBIT',type:'fictional'}];
  const api={
    stories,active:v=>calls.push('active:'+v),
    cancel:()=>calls.push('cancel'),close:()=>calls.push('close'),
    modal:()=>calls.push('modal'),focus:i=>calls.push('focus:'+i),
    archiveState:p=>calls.push('filter:'+p.get('theme')),
    archive:()=>calls.push('archive'),story:r=>calls.push('story:'+r.id),
    toast:t=>calls.push('toast'),create:()=>calls.push('create'),
    legacy:()=>calls.push('legacy')
  };
  const ctx={
    window:{MarketV10:{},addEventListener:(name,cb)=>listeners[name]=cb},
    location:loc,history,URLSearchParams,encodeURIComponent,decodeURIComponent
  };
  runInNewContext(navSource,ctx);
  const nav=ctx.window.MarketV10.navigation(api);
  nav.start();
  assert.ok(calls.includes('archive'));
  assert.ok(calls.includes('filter:Risk'));
  nav.visit('story',{id:'demo-1'});
  assert.equal(loc.hash,'#story/demo-1');
  calls.length=0;
  loc.hash='#story/demo-1';loc.href='https://example.invalid/#story/demo-1';
  // A fresh history navigation triggers apply when the URL changes from #archive.
  loc.hash='#archive';loc.href='https://example.invalid/#archive';listeners.popstate();
  assert.ok(calls.includes('archive'));
  calls.length=0;
  loc.hash='#story/demo-1';loc.href='https://example.invalid/#story/demo-1';listeners.popstate();
  assert.ok(calls.includes('story:demo-1'));
  calls.length=0;
  loc.hash='#story/local-not-present';loc.href='https://example.invalid/#story/local-not-present';listeners.popstate();
  assert.ok(calls.includes('toast'));
  assert.equal(loc.hash,'#universe');
});
