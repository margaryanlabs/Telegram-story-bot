/* Voice Studio V4.5 actual-controller session regressions.
   Browser audio graph is simulated; this is NOT real WebView or device QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/voice-studio.js',import.meta.url),'utf8');

function studio({deferMic=false}={}){
  const nodes=new Map(),events=new Map(),recorders=[],streams=[];
  const element=id=>{
    if(!nodes.has(id)){
      const listeners=new Map(),classes=new Set();
      const node={
        disabled:false,hidden:id==='voiceResult',checked:false,textContent:'',
        dataset:{},value:'',src:'',
        classList:{toggle:(key,active)=>active?classes.add(key):classes.delete(key),
          contains:key=>classes.has(key)},
        setAttribute(){},removeAttribute(name){if(name==='src')this.src='';},
        addEventListener:(type,handler)=>listeners.set(type,handler),
        emit:(type,detail={})=>listeners.get(type)?.({target:node,currentTarget:node,...detail}),
        querySelectorAll:()=>[],getContext:()=>({
          clearRect(){},fillRect(){},set fillStyle(value){}
        }),width:320,height:140,
      };
      nodes.set(id,node);
    }
    return nodes.get(id);
  };
  const simpleNode=()=>({
    gain:{value:0,setTargetAtTime(){}},frequency:{value:0,setTargetAtTime(){}},
    Q:{value:0},threshold:{value:0},knee:{value:0},ratio:{value:0},
    attack:{value:0},release:{value:0},delayTime:{value:0},
    fftSize:1024,frequencyBinCount:512,
    getByteTimeDomainData(bytes){bytes.fill(128)},
    connect(){},disconnect(){},start(){},stop(){},
  });
  class FakeContext{
    constructor(){this.destination=simpleNode();this.currentTime=0;this.closed=false;}
    resume(){return Promise.resolve()}
    close(){this.closed=true;return Promise.resolve()}
    createMediaStreamSource(){return simpleNode()}
    createBiquadFilter(){return simpleNode()}
    createGain(){return simpleNode()}
    createOscillator(){return simpleNode()}
    createDynamicsCompressor(){return simpleNode()}
    createDelay(){return simpleNode()}
    createAnalyser(){return simpleNode()}
    createMediaStreamDestination(){return {...simpleNode(),stream:{}}}
  }
  class FakeRecorder{
    static isTypeSupported(){return true}
    constructor(){this.state='inactive';this.mimeType='audio/webm';recorders.push(this)}
    start(){this.state='recording'}
    stop(){this.state='inactive'}
    deliver(){
      this.ondataavailable?.({data:new Blob(['private voice'])});
      this.onstop?.();
    }
  }
  const document={
    hidden:false,screen:'voice',getElementById:element,
    querySelector:()=>({dataset:{screen:document.screen}}),
    addEventListener:(type,handler)=>events.set('doc:'+type,handler),
    createElement:()=>({click(){},remove(){}}),
    body:{appendChild(){}}
  };
  let requestResolve;
  const newStream=()=>{
    const track={stopped:false,stop(){this.stopped=true}};
    const stream={getTracks:()=>[track]};
    streams.push({stream,track});return stream;
  };
  const navigator={
    mediaDevices:{getUserMedia:()=>deferMic
      ?new Promise(resolve=>{requestResolve=resolve})
      :Promise.resolve(newStream())},
  };
  const window={
    AudioContext:FakeContext,MediaRecorder:FakeRecorder,
    Telegram:{WebApp:{initData:'signed-owner-a'}},
    addEventListener:(type,handler)=>events.set('win:'+type,handler),
  };
  const URL={revokeObjectURL(){},createObjectURL:()=>('blob:test-'+recorders.length)};
  const ctx=vm.createContext({
    window,document,navigator,MediaRecorder:FakeRecorder,URL,Blob,
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},Date,
  });
  new vm.Script(source).runInContext(ctx);
  const emit=(name,...args)=>element(name).emit('click',...args);
  const signal=(kind,value)=>events.get(kind)?.(value||{});
  const mic=()=>emit('voiceMicButton');
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
  return {element,emit,signal,mic,flush,streams,recorders,window,document,
    get requestResolve(){return requestResolve},newStream};
}
test('normal Stop Recording produces one playable local file',async()=>{
  const s=studio();s.mic();await s.flush();
  assert.equal(s.element('voiceMicState').classList.contains('live'),true);
  s.emit('voiceRecord');
  assert.equal(s.recorders.length,1);
  s.emit('voiceStopRecord');
  s.recorders[0].deliver();
  assert.equal(s.element('voiceResult').hidden,false);
  assert.equal(s.element('voiceShare').disabled,false);
  assert.match(s.element('voicePlayer').src,/blob:test/);
});
test('leaving Voice revokes microphone and ignores delayed recorder onstop',async()=>{
  const s=studio();s.mic();await s.flush();s.emit('voiceRecord');
  s.document.screen='ai';
  s.signal('win:veto:screen-changed',{detail:{screen:'ai'}});
  s.recorders[0].deliver();
  assert.equal(s.streams[0].track.stopped,true);
  assert.equal(s.element('voiceMicState').classList.contains('live'),false);
  assert.equal(s.element('voiceResult').hidden,true);
  assert.equal(s.element('voicePlayer').src,'');
  assert.equal(s.element('voiceShare').disabled,true);
});
test('owner switching while a finished audio file is open revokes it',async()=>{
  const s=studio();s.mic();await s.flush();s.emit('voiceRecord');
  s.emit('voiceStopRecord');s.recorders[0].deliver();
  assert.equal(s.element('voiceResult').hidden,false);
  s.window.Telegram.WebApp.initData='signed-owner-b';
  s.signal('win:focus');
  assert.equal(s.streams[0].track.stopped,true);
  assert.equal(s.element('voiceResult').hidden,true);
  assert.equal(s.element('voiceShare').disabled,true);
});
test('mic permission arriving after navigation is immediately rejected and stopped',async()=>{
  const s=studio({deferMic:true});
  s.mic();s.document.screen='ai';
  s.signal('win:veto:screen-changed',{detail:{screen:'ai'}});
  const stream=s.newStream();
  s.requestResolve(stream);await s.flush();
  assert.equal(s.streams[0].track.stopped,true);
  assert.equal(s.element('voiceMicState').classList.contains('live'),false);
  assert.equal(s.recorders.length,0);
});
test('manual mic stop preserves already-finished file until screen exit',async()=>{
  const s=studio();s.mic();await s.flush();s.emit('voiceRecord');
  s.emit('voiceStopRecord');s.recorders[0].deliver();
  s.emit('voiceMicStop');
  assert.equal(s.element('voiceResult').hidden,false);
  s.document.screen='ai';
  s.signal('win:veto:screen-changed',{detail:{screen:'ai'}});
  assert.equal(s.element('voiceResult').hidden,true);
});

test('idle spectrum never simulates audio and remains static after stop',async()=>{
  const s=studio();
  assert.match(source,/function paintIdleSpectrum\(\)/);
  assert.doesNotMatch(source,/Math\.sin\(\(i\*2\.15\)\+\(Date\.now\(\)\/2500\)\)/);
  assert.match(source,/if\(state\.active\)state\.raf=requestAnimationFrame\(draw\)/);
  s.mic();await s.flush();
  s.emit('voiceMicStop');
  assert.equal(s.element('voiceMicState').classList.contains('live'),false);
  assert.equal(s.element('voiceResult').hidden,true);
});
