import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('public/calls-selftest.js');

test('Local WebRTC smoke test uses two actual peer connections and synthetic audio, not microphone',()=>{
  assert.ok(source.includes('new RTCPeerConnection({iceServers:[]})'));
  assert.ok(source.includes("caller.createDataChannel('veto-local-test')"));
  assert.ok(source.includes('caller.createOffer()'));
  assert.ok(source.includes('receiver.createAnswer()'));
  assert.ok(source.includes('setRemoteDescription('));
  assert.ok(source.includes('addIceCandidate('));
  assert.ok(source.includes('createMediaStreamDestination()'));
  assert.ok(source.includes('createOscillator()'));
  assert.ok(source.includes("data.send('veto-ping')"));
  assert.ok(source.includes("event.channel.send('veto-pong')"));
  assert.ok(source.includes("if(e.track.kind==='audio')"));
  assert.ok(!source.includes('getUserMedia('));
  assert.ok(!source.includes('MediaRecorder('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('SUPABASE_'));
  assert.ok(!source.includes('x-telegram-init-data'));
});
test('Self-test has a bounded timeout, releases all media and truthfully discloses limits',()=>{
  assert.ok(source.includes("},15000)"));
  assert.ok(source.includes('destination?.stream?.getTracks().forEach(t=>t.stop())'));
  assert.ok(source.includes('caller?.close()'));
  assert.ok(source.includes('receiver?.close()'));
  assert.ok(source.includes('osc?.stop()'));
  assert.ok(source.includes('audio?.close()'));
  assert.ok(source.includes("window.addEventListener('pagehide'"));
  assert.ok(source.includes("document.addEventListener('visibilitychange'"));
  assert.ok(source.includes("window.addEventListener('veto:screen-changed'"));
  assert.ok(source.includes('Это НЕ тест звонка через интернет'));
  assert.ok(read('public/studio.html').includes('id="callSelfTest"'));
  assert.ok(read('public/studio.html').includes('src="/calls-selftest.js?'));
});
