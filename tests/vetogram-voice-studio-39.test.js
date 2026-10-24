import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=n=>readFileSync(new URL('../public/'+n,import.meta.url),'utf8');
const js=read('telegram-chats.js'),html=read('studio.html'),css=read('vetogram-finish-2026.css');
function extract(begin,end) {
  const a=js.indexOf(begin),b=js.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,'missing actual source fragment '+begin);
  return js.slice(a,b);
}
const startVoice=extract('  async function toggleVoiceRecording(){','  function cancelVoiceCapture(){');
const drawVoice=extract('  function renderVoiceDraft(){','  // Processing is local.');

function fixture(){
  let requested=0,resolve,reject;
  const permission=new Promise((res,rej)=>{resolve=res;reject=rej});
  const tracks=[{stopped:0,stop(){this.stopped++}}];
  const mediaStream={getTracks:()=>tracks};
  const state={
    thread:{id:'owner-chat'},ownerInitData:'signed',
    recording:null,voiceStarting:false,voicePermissionGeneration:0,
    voicePreset:'original',voiceDraft:null,pendingAttachment:null,sendInFlight:false
  };
  const calls={redraw:0,toast:[],recorder:0,start:0};
  const tg={initData:'signed'};
  class Recorder {
    static isTypeSupported(){return true}
    constructor(stream,options){calls.recorder++;this.state='inactive';this.stream=stream;this.options=options;}
    start(){calls.start++;this.state='recording'}
    stop(){this.state='inactive';this.onstop?.()}
  }
  const context={
    state,tg,navigator:{mediaDevices:{getUserMedia:()=>{requested++;return permission}}},
    window:{MediaRecorder:Recorder},MediaRecorder:Recorder,
    document:{hidden:false},canSendInThread:()=>true,
    renderSendComposer:()=>{calls.redraw++},renderVoiceDraft:()=>{},toast:msg=>calls.toast.push(String(msg)),
    processedVoiceStream:async stream=>({recordStream:stream,close(){}}),
    clearTimeout(){},clearInterval(){},setTimeout:()=>1,setInterval:()=>2,
    Date,Blob,File:class{},URL:{createObjectURL:()=> 'blob:mock'},
  };
  const toggle=runInNewContext(startVoice+';toggleVoiceRecording',context);
  return {toggle,state,tg,calls,tracks,resolve,reject,mediaStream,requests:()=>requested};
}
test('microphone permission is single-flight; quick repeated taps trigger one real request',async()=>{
  const f=fixture(),one=f.toggle(),two=f.toggle();
  await two;
  assert.equal(f.requests(),1);
  assert.equal(f.state.voiceStarting,true);
  assert.equal(f.state.recording,null);
  f.reject(new Error('Доступ запрещён'));
  await one;
  assert.equal(f.state.voiceStarting,false);
  assert.equal(f.calls.toast.length,1);
  assert.equal(f.calls.recorder,0);
});
test('stale microphone permission is rejected when owner changes while request is pending',async()=>{
  const f=fixture(),pending=f.toggle();
  f.state.voicePermissionGeneration++;f.state.voiceStarting=false;f.tg.initData='new-owner';
  f.resolve(f.mediaStream);
  await pending;
  assert.equal(f.tracks[0].stopped,1);
  assert.equal(f.calls.recorder,0);
  assert.equal(f.calls.toast.length,0);
});
test('microphone creates real recording only after permission and immediately unlocks requesting flag',async()=>{
  const f=fixture(),start=f.toggle();
  assert.equal(f.state.voiceStarting,true);
  f.resolve(f.mediaStream);await start;
  assert.equal(f.calls.start,1);
  assert.equal(f.state.voiceStarting,false);
  assert.ok(f.state.recording);
  assert.equal(f.calls.toast.length,0);
});
test('voice UI separates requesting, recording and idle without fake audio activity',()=>{
  const status={hidden:true,dataset:{}},preview={hidden:true};
  const phase={textContent:''},timer={textContent:''},voiceSend={disabled:false};
  const items={telegramThreadVoiceStatus:status,telegramThreadVoicePreview:preview,
    telegramThreadVoiceState:phase,telegramThreadVoiceTimer:timer,
    telegramThreadVoiceSend:voiceSend};
  const preset={dataset:{chatVoicePreset:'original'},disabled:false,
    setAttribute(name,value){this[name]=value}};
  const state={voiceStarting:true,recording:null,voiceDraft:null,voicePreset:'original',sendInFlight:false};
  const render=runInNewContext(drawVoice+';renderVoiceDraft',{
    state,$:id=>items[id],document:{querySelectorAll:()=>[preset]},canSendInThread:()=>true,
    Date,Math,String,Boolean,
  });
  render();
  assert.equal(status.hidden,false);assert.equal(status.dataset.phase,'requesting');
  assert.equal(phase.textContent,'Запрашиваю доступ к микрофону');
  assert.equal(timer.textContent,'Ожидаю разрешение…');
  assert.equal(preset.disabled,true,'do not change effect while browser permission is pending');
  state.voiceStarting=false;state.recording={started:Date.now()-3700};
  render();
  assert.equal(status.dataset.phase,'recording');assert.equal(phase.textContent,'Идёт запись');
  assert.equal(preset.disabled,true);
  assert.match(timer.textContent,/\/ 00:45/);
  state.recording=null;render();
  assert.equal(status.hidden,true);assert.equal(status.dataset.phase,'idle');
  assert.equal(preset.disabled,false);
});
test('screen readers receive voice state without 350ms timer announcements',()=>{
  assert.match(html,/id="telegramThreadVoiceStatus"[^>]*role="status" aria-live="polite"/);
  assert.match(html,/id="telegramThreadVoiceState"/);
  assert.match(html,/id="telegramThreadVoiceTimer" aria-hidden="true"/);
  assert.match(html,/id="telegramThreadRecordVoice"[^>]*aria-busy="false"/);
  assert.match(js,/voiceButton\.setAttribute\('aria-busy',String\(starting\)\)/);
  assert.match(js,/if\(generation===state\.voicePermissionGeneration\)\{\s*state\.voiceStarting=false/);
  assert.match(js,/state\.voicePermissionGeneration\+\+;\s*state\.voiceStarting=false/);
});
test('premium 3.9 voice layout keeps readable mobile actions and reduced-motion safeguards',()=>{
  const part=css.slice(css.indexOf('VETOGRAM 3.9 · voice recording studio'));
  assert.ok(part.length>3500);
  assert.match(part,/@media\(max-width:480px\)/);
  assert.match(part,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(part,/grid-column:1 \/ -1/);
  assert.match(part,/min-height:46px/);
  assert.match(part,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(part,/data-phase="requesting"/);
  assert.match(part,/button:disabled/);
  assert.doesNotMatch(part,/fetch\(|setInterval\(|localStorage/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});


test('Stop remains available throughout recording, while attachments cannot interrupt mic capture',()=>{
  const start=js.indexOf("    for(const id of ['telegramThreadAttachButton'");
  const end=js.indexOf("    form.classList.toggle('is-readonly'",start);
  assert.ok(start>0&&end>start);
  const controller=js.slice(start,end);
  function run({recording,starting,attachment}){
    const btns={};
    for(const id of ['telegramThreadAttachButton','telegramThreadAudioButton',
      'telegramThreadStickersButton','telegramThreadRecordVoice']){
      btns[id]={
        classList:{toggle(){}},
        setAttribute(name,value){this[name]=value},
        disabled:false
      };
    }
    const state={recording:recording?{started:123}:null,voiceStarting:starting,
      pendingAttachment:attachment?{file:{}}:null,sendInFlight:false};
    runInNewContext(controller,{state,available:true,writable:true,
      $:id=>btns[id],Boolean,String});
    return btns;
  }
  const on=run({recording:true,starting:false,attachment:true});
  assert.equal(on.telegramThreadRecordVoice.disabled,false);
  assert.equal(on.telegramThreadRecordVoice['aria-pressed'],'true');
  for(const id of ['telegramThreadAttachButton','telegramThreadAudioButton',
    'telegramThreadStickersButton'])
    assert.equal(on[id].disabled,true,id+' must stay disabled while recording');
  const pending=run({recording:false,starting:true,attachment:false});
  assert.equal(pending.telegramThreadRecordVoice.disabled,true);
  assert.equal(pending.telegramThreadRecordVoice['aria-busy'],'true');
  assert.equal(pending.telegramThreadAttachButton.disabled,true);
  const idle=run({recording:false,starting:false,attachment:false});
  assert.equal(idle.telegramThreadRecordVoice.disabled,false);
  assert.equal(idle.telegramThreadAttachButton.disabled,false);
});
