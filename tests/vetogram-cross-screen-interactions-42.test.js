import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const source=read('voice-studio.js'),viewportSource=read('veto-device-polish.js'),html=read('studio.html');
const theme=read('chat-theme.js'),css=read('vetogram-finish-2026.css');
const segment=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing real voice handler: '+start);
  return source.slice(a,b);
};
const actual=segment('  function updateButtons(){','  function setStrength(){')+
  segment('  function stopMic(){','  function releaseRecording(){');

function deferred(){
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b});
  return {promise,resolve,reject};
}
function micFixture({pauseResume=false}={}){
  const permission=deferred(),resume=deferred(),events=[],ui={};
  const state={active:false,micStarting:false,micEpoch:0,recording:false,
    stream:null,context:null,source:null,nodes:null,oscillator:null,recorder:null,
    raf:0,monitor:false,recordedBlob:null,morph:75,preset:'clean'};
  const fields=['voiceMicButton','voiceMicStop','voiceRecord','voiceStopRecord',
    'voiceShare','voiceDownload','voiceMorphValue','voiceMicState','voiceStatus'];
  for(const name of fields){
    ui[name]={disabled:false,textContent:'',dataset:{},attributes:{},
      setAttribute(k,v){this.attributes[k]=v},
      classList:{toggle(){}}};
  }
  ui.voicePresetGrid={querySelectorAll:()=>[]};
  const nodes=()=>({connect(){},disconnect(){},
    start(){},stop(){events.push('oscillator-stop')},
    gain:{value:0},threshold:{value:0},frequency:{value:0},
    Q:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},
    release:{value:0},delayTime:{value:0},stream:{}});
  class AudioContext{
    constructor(){events.push('context-create');this.state='suspended'}
    resume(){events.push('context-resume');return pauseResume?resume.promise:Promise.resolve()}
    close(){events.push('context-close');return Promise.resolve()}
    createMediaStreamSource(){return nodes()}
    createBiquadFilter(){return nodes()}
    createGain(){return nodes()}
    createOscillator(){return nodes()}
    createDynamicsCompressor(){return nodes()}
    createDelay(){return nodes()}
    createAnalyser(){return nodes()}
    createMediaStreamDestination(){return nodes()}
  }
  const track={stop(){events.push('track-stop')}};
  const stream={getTracks:()=>[track]};
  let activeScreen='voice',hidden=false,calls=0;
  const context={state,audioSupported:true,$:name=>ui[name],
    navigator:{mediaDevices:{getUserMedia:()=>{calls++;return permission.promise}}},
    window:{AudioContext},
    document:{get hidden(){return hidden},
      querySelector:()=>({dataset:{screen:activeScreen}})},
    setStrength:()=>{},draw:()=>{},stopMonitor:()=>{},
    cancelAnimationFrame:()=>{},toast:message=>events.push('toast:'+message)};
  const functions=vm.runInNewContext(actual+';({startMic,stopMic,updateButtons})',context);
  return {state,ui,events,stream,permission,resume,...functions,
    calls:()=>calls,leave:()=>{activeScreen='home';functions.stopMic()},
    hide:()=>{hidden=true;functions.stopMic()}};
}
test('duplicate taps while getUserMedia is pending start only one permission request',async()=>{
  const f=micFixture(),a=f.startMic(),b=f.startMic();
  assert.equal(f.calls(),1);
  assert.equal(f.state.micStarting,true);
  assert.equal(f.ui.voiceMicStop.disabled,false,'Stop must cancel pending permission');
  assert.equal(f.ui.voiceMicStop.textContent,'Отменить запрос');
  assert.equal(f.ui.voiceMicStop.attributes['aria-label'],'Отменить запрос доступа к микрофону');
  assert.equal(f.ui.voiceMicButton.attributes['aria-busy'],'true');
  f.permission.reject(new Error('Denied'));
  await Promise.all([a,b]);
  assert.equal(f.state.micStarting,false);
  assert.equal(f.ui.voiceMicButton.disabled,false);
  assert.equal(f.ui.voiceMicStop.textContent,'Отключить');
});
test('leaving the screen while permission pending closes a late stream and never activates mic',async()=>{
  const f=micFixture(),run=f.startMic();
  f.leave();f.permission.resolve(f.stream);
  await run;
  assert.equal(f.state.active,false);assert.equal(f.state.micStarting,false);
  assert.equal(f.events.filter(x=>x==='track-stop').length,1);
  assert.equal(f.events.includes('context-create'),false);
});
test('leaving during delayed AudioContext.resume closes stream and audio context',async()=>{
  const f=micFixture({pauseResume:true}),run=f.startMic();
  f.permission.resolve(f.stream);
  for(let i=0;i<4&&!f.events.includes('context-resume');i++)await Promise.resolve();
  assert.ok(f.events.includes('context-resume'));
  f.leave();f.resume.resolve();await run;
  assert.equal(f.state.active,false);
  assert.equal(f.events.filter(x=>x==='track-stop').length,1);
  assert.equal(f.events.filter(x=>x==='context-close').length,1);
});
test('hiding app with pending permission invalidates request before it resolves',async()=>{
  const f=micFixture(),run=f.startMic();
  f.hide();f.permission.resolve(f.stream);await run;
  assert.equal(f.state.active,false);
  assert.equal(f.events.filter(x=>x==='track-stop').length,1);
});
test('allowed permission in active Voice Studio starts real device graph and Stop cleans it',async()=>{
  const f=micFixture(),run=f.startMic();
  f.permission.resolve(f.stream);await run;
  assert.equal(f.state.active,true);
  assert.equal(f.state.micStarting,false);
  assert.equal(f.ui.voiceMicStop.disabled,false);
  assert.equal(f.ui.voiceMicButton.disabled,true);
  f.stopMic();
  assert.equal(f.state.active,false);
  assert.equal(f.events.filter(x=>x==='track-stop').length,1);
  assert.equal(f.events.filter(x=>x==='context-close').length,1);
});
test('late permission denial after navigating away cannot overwrite later screen status',async()=>{
  const f=micFixture(),run=f.startMic();
  f.leave();
  const earlier=f.events.filter(x=>x.startsWith('toast:')).length;
  f.permission.reject(new Error('Denied'));
  await run;
  assert.equal(f.events.filter(x=>x.startsWith('toast:')).length,earlier);
});
test('keyboard flag belongs to focused input only while its screen is visible',()=>{
  const events={},frames=[],classes={},styles={};
  let active=true,blurred=false;
  const screen={classList:{contains:()=>active}};
  const input={matches:()=>true,closest:()=>screen,blur(){blurred=true}};
  const root={clientHeight:800,style:{setProperty:(k,v)=>styles[k]=v},
    classList:{toggle:(k,value)=>classes[k]=value}};
  const document={documentElement:root,activeElement:input,
    addEventListener:(k,fn)=>events['document:'+k]=fn};
  const window={innerHeight:800,visualViewport:{scale:1,height:450,offsetTop:0,
    addEventListener:(k,fn)=>events['viewport:'+k]=fn},
    addEventListener:(k,fn)=>events[k]=fn};
  const requestAnimationFrame=fn=>{frames.push(fn);return frames.length};
  vm.runInNewContext(viewportSource,{window,document,requestAnimationFrame,setTimeout:()=>{}});
  assert.equal(classes['veto-keyboard-open'],true);
  assert.equal(styles['--veto-visible-height'],'450px');
  active=false;events['veto:screen-changed']({detail:{screen:'home'}});
  assert.equal(blurred,true);
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(classes['veto-keyboard-open'],false);
  assert.equal(styles['--veto-visual-bottom'],'0px');
});
test('voice and device scripts are current-release assets and navigation has explicit cleanup',()=>{
  assert.match(source,/state\.micStarting\|\|!audioSupported/);
  assert.match(source,/epoch===state\.micEpoch/);
  assert.match(source,/screen==='voice'/);
  assert.match(source,/state\.active\|\|state\.micStarting/);
  assert.match(viewportSource,/window\.addEventListener\('veto:screen-changed'/);
  assert.match(html,/\/voice-studio\.js\?v=20261025-cross-screen-42/);
  assert.match(html,/\/veto-device-polish\.js\?v=20261025-cross-screen-42/);
});


test('leaving fullscreen Telegram chat restores navigation classes on other screens',()=>{
  const begin=theme.indexOf('  function dock(where) {');
  const end=theme.indexOf('  let selected=',begin);
  assert.ok(begin>=0&&end>begin);
  const code=theme.slice(begin,end);
  let screen='telegram';
  const flags={},body={classList:{toggle:(key,val)=>{flags[key]=val}}};
  const bar={insertBefore(control){control.parentElement=bar}};
  const thread={insertBefore(control){control.parentElement=thread}};
  const heading={insertBefore(control){control.parentElement=heading}};
  const control={parentElement:thread};
  const document={body,
    querySelector:selector=>{
      if(selector==='.screen[data-screen="telegram"]')
        return {classList:{contains:()=>screen==='telegram'}};
      if(selector.includes('thread-bar'))return thread;
      if(selector.includes('header-actions'))return heading;
      return null;
    },
    getElementById:()=>({hidden:false})
  };
  const dock=vm.runInNewContext(code+';dock',{document,bar,control,closeMenu(){}});
  dock('thread');
  assert.equal(flags['veto-chat-active'],true);
  assert.equal(flags['veto-chat-thread'],true);
  screen='ai';dock();
  assert.equal(flags['veto-chat-active'],false);
  assert.equal(flags['veto-chat-thread'],false);
  assert.equal(control.parentElement,bar);
  assert.match(theme,/window\.addEventListener\('veto:screen-changed',\(\)=>dock\(\)\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
