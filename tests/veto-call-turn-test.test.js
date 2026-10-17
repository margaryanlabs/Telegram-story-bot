import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('public/calls-turn-test.js');

test('TURN verification requires actual selected relay ICE candidate, not mere TURN configuration',()=>{
  const start=source.indexOf('  function selectedRelay(stats){');
  const end=source.indexOf('  async function testRelay(){',start);
  assert.ok(start>=0&&end>start);
  const fn=vm.runInNewContext(source.slice(start,end)+'\nselectedRelay');
  const stats=type=>new Map([
    ['transport',{id:'transport',type:'transport',selectedCandidatePairId:'pair'}],
    ['pair',{id:'pair',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'local'}],
    ['local',{id:'local',type:'local-candidate',candidateType:type}],
  ]);
  assert.equal(fn(stats('relay')),true);
  assert.equal(fn(stats('host')),false);
  assert.equal(fn(stats('srflx')),false);
  assert.equal(fn(new Map([['transport',{type:'transport'}]])),false);
  const fallback=stats('relay');fallback.delete('transport');
  assert.equal(fn(fallback),true,'Supports WebView candidate-pair fallback');
});
test('TURN-only test uses real signed ICE endpoint and synthetic audio, without microphone or user data',()=>{
  assert.ok(source.includes("fetch('/api/call-signal'"));
  assert.ok(source.includes("'x-telegram-init-data':signed"));
  assert.ok(source.includes("JSON.stringify({action:'ice'})"));
  assert.ok(source.includes("iceTransportPolicy:'relay'"));
  assert.ok(source.includes("urls.every(u=>"));
  assert.ok(source.includes('peer.iceGatheringState'));
  assert.ok(source.includes('left.getStats()'));
  assert.ok(source.includes('right.getStats()'));
  assert.ok(source.includes('selectedRelay(ls)'));
  assert.ok(source.includes('selectedRelay(rs)'));
  assert.ok(source.includes("s.type==='inbound-rtp'"));
  assert.ok(source.includes('Number(s.bytesReceived||0)>0'));
  assert.ok(source.includes('if(!audioReceived)'));
  assert.ok(source.includes('доставка аудио RTP не подтверждена'));
  assert.ok(source.includes('createMediaStreamDestination()'));
  assert.ok(source.includes('createOscillator()'));
  assert.ok(source.includes('createDataChannel('));
  assert.ok(source.includes('proof-ping'));
  assert.ok(source.includes('proof-pong'));
  assert.ok(!source.includes('getUserMedia('));
  assert.ok(!source.includes('MediaRecorder('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('sessionStorage'));
  assert.ok(!source.includes('console.log'));
  assert.ok(!source.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
test('TURN transport self-test is bounded, cleans up on navigation and does not claim two-phone success',()=>{
  const html=read('public/studio.html');
  assert.ok(html.includes('id="callTurnTest"'));
  assert.ok(html.includes('id="callTurnTestStatus"'));
  assert.ok(html.includes('src="/calls-turn-test.js?'));
  assert.ok(source.includes('setTimeout(()=>reject(Error('));
  assert.ok(source.includes('40000);'));
  assert.ok(source.includes('turnConfig=null;'));
  assert.ok(source.includes('try{left?.close();}'));
  assert.ok(source.includes('try{right?.close();}'));
  assert.ok(source.includes('destination?.stream.getTracks().forEach(t=>t.stop())'));
  assert.ok(source.includes("window.addEventListener('pagehide'"));
  assert.ok(source.includes("document.addEventListener('visibilitychange'"));
  assert.ok(source.includes("window.addEventListener('veto:screen-changed'"));
  assert.ok(source.includes('НЕ тест звонка между двумя телефонами'));
});
