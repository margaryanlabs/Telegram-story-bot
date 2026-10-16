import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const js=read('public/calls.js');
const html=read('public/studio.html');
const app=read('public/app.js');
test('VETO Calls is discoverable and operates outside normal Telegram calls',()=>{
  assert.ok(html.includes('data-screen="calls"'));
  assert.ok(html.includes('data-open-screen="calls"'));
  assert.ok(html.includes('/calls.js?v='));
  assert.ok(html.includes('/calls.css?v='));
  assert.ok(html.includes('id="callRemoteAudio"'));
  assert.ok(html.includes('id="callOutgoing"'));
  assert.ok(html.includes('id="callIncoming"'));
  assert.ok(app.includes("calls:'calls'"));
  assert.ok(app.includes("calls:'home'"));
  assert.ok(!html.includes('High Lab'));
  assert.ok(!html.includes('HiLab'));
});
test('Actual microphone, 1-to-1 audio WebRTC and in-call filters must exist',()=>{
  assert.ok(js.includes('new RTCPeerConnection('));
  assert.ok(js.includes('navigator.mediaDevices.getUserMedia('));
  assert.ok(js.includes('peer.addTrack(track,stream)'));
  assert.ok(js.includes('peer.setRemoteDescription('));
  assert.ok(js.includes('peer.setLocalDescription('));
  assert.ok(js.includes("peer.addEventListener('track'"));
  assert.ok(js.includes('context.createMediaStreamDestination()'));
  assert.ok(js.includes('context.createBiquadFilter()'));
  assert.ok(js.includes('track.enabled=!state.muted'));
  assert.ok(js.includes('state.mic?.getTracks().forEach(t=>t.stop())'));
  assert.ok(js.includes("event.detail?.screen!=='calls'"));
  assert.ok(js.includes("document.addEventListener('visibilitychange'"));
  assert.ok(js.includes("fetch('/api/call-signal'"));
  assert.ok(!js.includes('TelegramClient('));
  assert.ok(!js.includes('localStorage'));
  assert.ok(!js.includes('sessionStorage'));
  assert.ok(!js.includes('MediaRecorder'));
});
test('Out-of-band signaling codes enforce version, room ID, offer/answer type and expiry',()=>{
  const start=js.indexOf('  function newRoom(){');
  const end=js.indexOf('  function iceDone(',start);
  assert.ok(start>=0&&end>start);
  const context={crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,Uint8Array,Date};
  const funcs=vm.runInNewContext(js.slice(start,end)+'\n({newRoom,pack,unpack})',context);
  const room=funcs.newRoom();
  assert.match(room,/^[a-f0-9]{32}$/);
  const offer={type:'offer',sdp:'v=0\r\n'+'a=candidate:1 test\r\n'.repeat(12)};
  const code=funcs.pack(offer,room);
  assert.ok(code.startsWith('VETO1:'));
  const opened=funcs.unpack(code,'offer');
  assert.equal(opened.room,room);
  assert.equal(opened.sdp,offer.sdp);
  assert.throws(()=>funcs.unpack(code,'answer'),/Код не подходит/);
  assert.throws(()=>funcs.unpack('VETO1:not-real','offer'),/Некорректный код/);
  assert.throws(()=>funcs.unpack(funcs.pack({...offer,sdp:'something else'},room),'offer'),/Код не подходит/);
  const old=vm.runInNewContext(js.slice(start,end)+'\n({pack,unpack})',{
    ...context, Date:class extends Date{static now(){return Date.now()-3600000;}},
  });
  assert.throws(()=>old.unpack(code,'offer'),/Код не подходит/);
});
test('Server-assisted signaling still discloses missing TURN, video and Telegram-call interception',()=>{
  assert.ok(html.includes('Коды пересылаются вручную'));
  assert.ok(html.includes('id="callCreateAssisted"'));
  assert.ok(html.includes('id="callJoinAssisted"'));
  assert.ok(js.includes('pollAssisted(epoch)'));
  assert.ok(js.includes("signalRequest('answer'"));
  assert.ok(html.includes('TURN-реле'));
  assert.ok(html.includes('не проверяется')===false ||
    html.includes('личность собеседника проверяется вами'));
  assert.ok(html.includes('Не доступны: видеосвязь, живой перевод'));
  assert.ok(!js.includes('TELEGRAM_API_HASH'));
});
