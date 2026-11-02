import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const current=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const original=readFileSync(new URL('../../market-remembers-preview/human-legacy-v74.html',import.meta.url),'utf8');
const js=current.split('<script>')[1]?.split('</script>')[0];
const css=current.split('<style>')[1]?.split('</style>')[0];

test('V7.5.1 preserves V7.4 visual engine, local storage and fictional disclosures',()=>{
  assert.ok(original.includes('V.07.4 / HUMAN LEGACY'));
  assert.match(current,/V\.07\.5(?:\.\d+)? \/ (?:STELLAR UX|MEMORY PATHS)/);
  assert.ok(current.includes('function generateParticles'));
  assert.ok(current.includes('function initGL'));
  assert.ok(current.includes('function showLegacy'));
  assert.ok(current.includes('const LEGEND_ENTRIES='));
  assert.ok(current.includes("const KEY='veto-market-remembers-demo-v4'"));
  assert.ok(current.includes("const BOOK_KEY='veto-market-remembers-private-bookmarks-v74'"));
  assert.ok(current.includes('LOCAL DEMO / NO REAL MEMBERS'));
  assert.ok(current.includes('href="https://market-remembers-veto-universe.onrender.com/human-legacy-v74.html'));
});

test('V7.5.1 reader features compile and keep an internally coherent DOM contract',()=>{
  assert.doesNotThrow(()=>new Function(js));
  assert.equal(css.split('{').length,css.split('}').length,'CSS braces must balance');
  for(const id of ['journeyStatus','journeyProgress','journeyExit']){
    assert.ok(current.includes('id="'+id+'"'),id);
  }
  for(const path of ['risk','fomo','patience']){
    assert.ok(current.includes('data-memory-path="'+path+'"'),path);
  }
  assert.ok(js.includes('renderJourneyReader();'),'each story can show chapter progress');
  assert.ok(js.includes("goJourneyReader(1)"),'reader navigation');
  assert.ok(css.includes('.drawer.journey-finished'),'full-screen completion');
  assert.ok(css.includes('@media(max-width:820px)'),'mobile layout');
});

test('all three curated paths can be opened, navigated and completed without leaving the route',()=>{
  const first=js.indexOf('  // V7.5 guided Memory Paths');
  const last=js.indexOf('  let immersive=false;',first);
  assert.ok(first>=0&&last>first,'extract only route handlers');
  const moduleCode=js.slice(first,last);
  const aliases=['MIRA','EMBER','ATLAS','NORTHSTAR','SOLACE','NOVA','HORIZON','QUARTZ'];
  const stories=aliases.map((alias,i)=>({alias,quote:'Fictional lesson '+i,category:'Risk',local:false}));
  const nodes=new Map(),dived=[],toasts=[],drawers=[];
  function el(id){
    if(!nodes.has(id))nodes.set(id,{
      hidden:true,textContent:'',disabled:false,
      setAttribute(){},style:{},classList:{add(){},remove(){}},
      querySelector(){return {insertAdjacentElement(_position,ribbon){el('lastRibbon').value=ribbon;}};},
      querySelectorAll(){return [];}
    });
    return nodes.get(id);
  }
  const document={
    createElement(){return {
      className:'',setAttribute(){},set innerHTML(v){this.html=v;},
      get innerHTML(){return this.html;},querySelectorAll(){return [];}
    };}
  };
  const args={
    stories,$:el,document,
    setLens(){},closeLensPanel(){},diveLog:dived,
    showToast(message){toasts.push(message);},
    nextVisibleSignal(i,d){return (i+d+stories.length)%stories.length;},
    isSavedLesson(story){return story.alias==='MIRA';},
    setDrawer(tag,html){drawers.push({tag,html});},
    closeDrawer(){},updateLensControls(){},
    escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');}
  };
  const code='let selected=0;function beginDive(index){selected=index;diveLog.push(index);}' +
    'function focus(index){selected=index;diveLog.push(index);}' + moduleCode +
    'return {startMemoryJourney,goJourneyReader,renderJourneyReader,advanceJourneyFromGlobe,' +
    'getJourney:()=>guidedJourney,getSelected:()=>selected};';
  const env=Function(...Object.keys(args),code)(...Object.values(args));
  for(const path of ['risk','fomo','patience']){
    env.startMemoryJourney(path);
    assert.equal(env.getJourney().name,path);
    assert.equal(env.getJourney().step,0);
    assert.ok(!el('journeyStatus').hidden);
    env.renderJourneyReader();
    assert.ok(el('lastRibbon').value.html.includes('MEMORY PATH'));
    for(let i=1;i<4;i++){
      env.goJourneyReader(1);
      assert.equal(env.getJourney().step,i,path+' step '+i);
    }
    env.goJourneyReader(1);
    assert.equal(env.getJourney(),null,path+' completion');
    assert.equal((drawers.at(-1).html.match(/<li>/g)||[]).length,4);
    assert.ok(drawers.at(-1).html.includes('уроков сохранено'));
    assert.equal(el('journeyStatus').hidden,true);
  }
});
