import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('public/calls.js');
const start=js.indexOf('  function bindCallControl(channel,epoch){');
const end=js.indexOf('  function armConnectionWatchdog(epoch){',start);
assert.ok(start>=0&&end>start);
function setup(){
  const listeners=new Map(),sent=[],reports=[],ui={callPeerMute:{textContent:''}};
  let stopCount=0;
  const state={epoch:10,control:null,remoteMuted:null,muted:true};
  const channel={label:'veto-call-control',readyState:'open',closed:false,
    addEventListener(type,cb){listeners.set(type,cb);},
    send(message){sent.push(JSON.parse(message));},
    close(){this.closed=true;}};
  const context={state,$:key=>ui[key],stop:()=>{stopCount++;},
    report:(m)=>reports.push(m),guardOwner:()=>true};
  const functions=vm.runInNewContext(js.slice(start,end)+
    '\n({bindCallControl,sendCallControl,hangup})',context);
  return {listeners,sent,reports,ui,state,channel,functions,get stops(){return stopCount;}};
}
test('1:1 audio control channel sends structured mute state and ignores unrecognized packets',()=>{
  const x=setup();
  x.functions.bindCallControl(x.channel,10);
  assert.equal(x.state.control,x.channel);
  x.listeners.get('open')();
  assert.deepEqual(x.sent[0],{v:1,type:'mute',value:true});
  x.listeners.get('message')({data:JSON.stringify({v:1,type:'mute',value:false})});
  assert.equal(x.state.remoteMuted,false);
  assert.ok(x.ui.callPeerMute.textContent.includes('ВКЛЮЧЕН'));
  x.listeners.get('message')({data:JSON.stringify({v:1,type:'mute',value:true})});
  assert.equal(x.state.remoteMuted,true);
  assert.ok(x.ui.callPeerMute.textContent.includes('ВЫКЛЮЧЕН'));
  x.listeners.get('message')({data:'{\"type\":\"hangup\"}'});
  x.listeners.get('message')({data:JSON.stringify({v:2,type:'hangup'})});
  x.listeners.get('message')({data:'A'.repeat(129)});
  assert.equal(x.stops,0);
  assert.equal(x.functions.sendCallControl('unknown'),false);
});
test('Explicit hangup signals peer, then shuts down locally even if packet may be undelivered',()=>{
  const x=setup();
  x.functions.bindCallControl(x.channel,10);
  x.functions.hangup();
  assert.equal(x.stops,1);
  assert.deepEqual(x.sent[x.sent.length-1],{v:1,type:'hangup'});
  assert.ok(x.reports.at(-1).includes('Микрофон отключён'));
});
test('Remote hangup immediately releases resources, future owner epoch packets are ignored',()=>{
  const x=setup();
  x.functions.bindCallControl(x.channel,10);
  x.listeners.get('message')({data:JSON.stringify({v:1,type:'hangup'})});
  assert.equal(x.stops,1);
  assert.ok(x.reports.at(-1).includes('Собеседник завершил'));
  x.state.epoch=11;
  x.listeners.get('message')({data:JSON.stringify({v:1,type:'hangup'})});
  assert.equal(x.stops,1);
});
test('WebRTC caller creates channel before local offer; callee receives negotiated channel',()=>{
  assert.ok(js.includes("peer.createDataChannel('veto-call-control',{ordered:true})"));
  assert.ok(js.includes("peer.addEventListener('datachannel'"));
  assert.ok(js.includes("sendCallControl('mute',state.muted)"));
  assert.ok(js.includes('clearTimeout(state.disconnectTimer)'));
  assert.ok(js.includes("},15000)"));
  assert.ok(js.includes('if(!state.connectedAt)state.connectedAt=Date.now()'));
  assert.ok(read('public/studio.html').includes('id="callPeerMute"'));
});
