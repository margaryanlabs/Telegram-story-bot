import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('VETO Calls destroys previous owner audio, SDP and invite when Telegram identity switches',()=>{
  const js=read('public/calls.js');
  const start=js.indexOf('  function stop(skipEnd=false){');
  const end=js.indexOf('  function morph(){',start);
  assert.ok(start>=0&&end>start);
  let peerClose=0,micStops=0,trackStops=0,playerStops=0,endRequests=0;
  const state={
    ownerFingerprint:'signed-user-A',signalRoom:'room-of-A',signalPollTimer:12,
    sessionTimer:13,connectionTimer:14,timer:15,qualityTimer:16,waveRaf:17,
    epoch:9,peer:{close(){peerClose++;}},
    mic:{getTracks:()=>[{stop(){micStops++;}}]},
    processed:{getTracks:()=>[{stop(){trackStops++;}}]},
    oscillator:{stop(){},disconnect(){}},audio:{close(){return Promise.resolve();}},
    nodes:{},room:'A-room',role:'caller',mode:'assisted',muted:false,
    connectedAt:123,phase:'connected',inviteShareUrl:'https://t.me/A-secret',
    signalPollFailures:0,iceMode:'turn',
  };
  const elements={
    callRemoteAudio:{pause(){playerStops++;},srcObject:{some:'audio'}},
    callOutgoing:{value:'A-share-secret'},
    callIncoming:{value:'A-incoming-secret'},
    callElapsed:{textContent:'00:22'},
    callPreflight:{disabled:true},
    callDiagnostics:{textContent:'A network status'},
    callQuality:{textContent:'A RTT'},
    callWaveform:{width:400,height:80,getContext:()=>({clearRect(){}})},
  };
  const messages=[];
  const context={state,tg:{initData:'signed-user-B'},$:id=>elements[id],
    clearTimeout(){},clearInterval(){},cancelAnimationFrame(){},
    report(m){messages.push(m)},signalRequest(){endRequests++;return Promise.resolve();},
    update(){},
  };
  const guard=vm.runInNewContext(js.slice(start,end)+'\nguardOwner',context);
  assert.equal(guard(),false,'Identity transition cancels current action');
  assert.equal(state.ownerFingerprint,'signed-user-B');
  assert.equal(state.epoch,10,'Outstanding operations invalidated by generation');
  assert.equal(peerClose,1);
  assert.equal(micStops,1);
  assert.equal(trackStops,1);
  assert.equal(playerStops,1);
  assert.equal(endRequests,0,'Never authenticate A room deletion with B initData');
  assert.equal(state.peer,null);
  assert.equal(state.mic,null);
  assert.equal(state.processed,null);
  assert.equal(state.room,null);
  assert.equal(state.signalRoom,null);
  assert.equal(state.inviteShareUrl,'');
  assert.equal(state.phase,'idle');
  assert.equal(elements.callOutgoing.value,'');
  assert.equal(elements.callIncoming.value,'');
  assert.equal(elements.callPreflight.disabled,false);
  assert.ok(!elements.callDiagnostics.textContent.includes('A network status'));
  assert.ok(messages.some(s=>s.includes('Telegram-аккаунт изменился')));
  assert.equal(guard(),true,'New account can use clean screen');
});
test('Owner-switch checks are wired into all call entry points and WebView focus',()=>{
  const js=read('public/calls.js'),html=read('public/studio.html');
  assert.ok(html.includes('id="callPreflight"'));
  assert.ok(html.includes('id="callDiagnostics"'));
  assert.ok(js.includes("window.addEventListener('focus',guardOwner)"));
  assert.ok(js.includes("window.addEventListener('pageshow',guardOwner)"));
  assert.ok(js.includes("if(!document.hidden){guardOwner();return;}"));
  assert.ok(js.includes("state.ownerFingerprint===String(tg.initData)"));
  assert.ok(js.includes("if(signed!==state.ownerFingerprint)throw Error('TELEGRAM_ACCOUNT_CHANGED')"));
  for(const method of ['createAssisted','joinAssisted','create','join','applyAnswer',
    'copyInviteLink','copy']){
    assert.ok(js.includes(`async function ${method}(){\n    if(!guardOwner())return;`),
      'Entry must clear A state before B can operate: '+method);
  }
});
test('Network preflight checks readiness without recording or uploading microphone samples',()=>{
  const js=read('public/calls.js');
  const first=js.indexOf('  async function checkCallReadiness()');
  const last=js.indexOf('  function morph()',first);
  assert.ok(first>=0&&last>first);
  const source=js.slice(first,last);
  assert.ok(source.includes("signalRequest('ice')"));
  assert.ok(source.includes("navigator.permissions.query({name:'microphone'})"));
  assert.ok(source.includes('config.relayConfigured'));
  assert.ok(source.includes('Реальный звонок'));
  assert.ok(!source.includes('getUserMedia('));
  assert.ok(!source.includes('MediaRecorder'));
});
