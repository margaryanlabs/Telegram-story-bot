import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {VETO_STUN,parseTurnUrls,createIceConfig} from '../lib/veto-call-ice.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Missing TURN config produces truthful safe STUN-only configuration',()=>{
  const base=createIceConfig();
  assert.equal(base.relayConfigured,false);
  assert.deepEqual(base.iceServers,[VETO_STUN]);
  assert.deepEqual(parseTurnUrls(''),[]);
  assert.deepEqual(parseTurnUrls('https://turn.invalid,turn:ok.test'),[]);
  assert.deepEqual(parseTurnUrls('turn:user:pass@host.test'),[]);
  assert.deepEqual(parseTurnUrls('turns:turn.example.org:5349?transport=tcp'),
    ['turns:turn.example.org:5349?transport=tcp']);
});
test('Authenticated Coturn REST credentials have correct short-lived HMAC digest and no Telegram identity',()=>{
  const secret='a-strong-shared-secret-value-1234567890';
  const now=1792161234000;
  const id='abc123abc123abc123ab';
  const out=createIceConfig({secret,
    turnUrls:'turn:turn.example.org:3478?transport=udp,turns:turn.example.org:5349?transport=tcp',
    now,randomId:id});
  assert.equal(out.relayConfigured,true);
  assert.equal(out.iceServers.length,2);
  const turn=out.iceServers[1];
  assert.equal(turn.urls.length,2);
  assert.match(turn.username,/^[0-9]+:[a-f0-9]{20}$/);
  assert.equal(turn.username.split(':')[1],id);
  assert.equal(Number(turn.username.split(':')[0]),Math.floor(now/1000)+7200);
  assert.equal(turn.credential,crypto.createHmac('sha1',secret).update(turn.username).digest('base64'));
  assert.ok(!JSON.stringify(out).includes(secret));
  assert.ok(!turn.username.includes('telegram'));
});
test('Authenticated user obtains ICE config only through signed Vercel backend',()=>{
  const api=read('api/call-signal.js');
  const client=read('public/calls.js');
  assert.ok(api.includes('validateTelegramMiniApp('));
  assert.ok(api.includes("action==='ice'"));
  assert.ok(api.includes('process.env.VETO_TURN_SECRET'));
  assert.ok(api.includes('process.env.VETO_TURN_URLS'));
  assert.ok(client.includes("signalRequest('ice')"));
  assert.ok(client.includes('config.relayConfigured'));
  assert.ok(client.includes('iceServers:servers'));
  assert.ok(client.includes('armConnectionWatchdog('));
  assert.ok(client.includes('45 секунд'));
  assert.ok(client.includes("track.addEventListener('ended'"));
  assert.ok(read('public/studio.html').includes('id="callTransport"'));
  assert.ok(!client.includes('VETO_TURN_SECRET'));
  assert.ok(!read('public/studio.html').includes('VETO_TURN_SECRET'));
});
