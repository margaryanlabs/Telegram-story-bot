import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CALL_TTL_MS,newCallInvite,parseCallInvite,callInviteHash,
  checkCallRoom,checkCallDescription,
} from '../lib/veto-call-signals.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const fakeSdp='v=0\r\n'+('a=candidate:1 1 udp 1 example.test 1 typ host\r\n').repeat(4);

test('Room invitation is random high-entropy opaque capability with no SDP or account identifier',()=>{
  const one=newCallInvite(),two=newCallInvite();
  assert.equal(CALL_TTL_MS,8*60*1000);
  assert.notEqual(one.roomId,two.roomId);
  assert.notEqual(one.invite,two.invite);
  assert.match(one.roomId,/^[a-f0-9]{32}$/);
  assert.match(one.secret,/^[a-f0-9]{48}$/);
  assert.match(one.tokenHash,/^[a-f0-9]{64}$/);
  assert.equal(one.tokenHash,callInviteHash(one.secret));
  assert.equal(parseCallInvite(one.invite).roomId,one.roomId);
  assert.equal(parseCallInvite(one.invite).tokenHash,one.tokenHash);
  assert.ok(!one.invite.includes('v=0'));
  assert.ok(!one.invite.includes('telegram'));
});
test('Malformed, tampered and wrong-version invitations are rejected',()=>{
  const room=newCallInvite();
  for(const code of ['',room.invite+'A',room.invite.replace('VETOR1:','VETO1:'),
    room.invite.replace(/[a-f0-9]$/, 'X'),room.invite.replace('.',':'),
    'VETOR1:42.12345',null]){
    assert.throws(()=>parseCallInvite(code));
  }
  assert.throws(()=>callInviteHash('short'));
  assert.throws(()=>checkCallRoom('123'));
});
test('WebRTC descriptions are size and protocol bounded; no HTML or null bytes',()=>{
  assert.equal(checkCallDescription(fakeSdp,'offer'),fakeSdp);
  assert.equal(checkCallDescription(fakeSdp,'answer'),fakeSdp);
  assert.throws(()=>checkCallDescription('<html>evil</html>','offer'));
  assert.throws(()=>checkCallDescription('v=0\r\n'+('a='.repeat(16000)),'offer'));
  assert.throws(()=>checkCallDescription(fakeSdp,'bogus'));
});
test('Every short-code operation is signed, per-user and ephemeral',()=>{
  const api=read('api/call-signal.js');
  const gateway=read('lib/viewer-sync-store.js');
  const edge=read('supabase/functions/story-pilot-store/index.ts');
  const sql=read('supabase/migrations/20261016121000_veto_ephemeral_calls.sql');
  assert.ok(api.includes('validateTelegramMiniApp('));
  assert.ok(api.includes("req.headers['x-telegram-init-data']"));
  assert.ok(api.includes('const userId=String(user.id)'));
  assert.ok(api.includes('room.tokenHash'));
  assert.ok(api.includes("action==='inspect'"));
  assert.ok(api.includes("action==='answer'"));
  assert.ok(api.includes("action==='poll'"));
  assert.ok(api.includes("action==='create'"));
  assert.ok(api.includes("action==='end'")===false || api.includes('endCallRoom('));
  for(const op of ['call_create','call_inspect','call_answer','call_poll','call_end']){
    assert.ok(gateway.includes("'"+op+"'"),"gateway "+op);
    assert.ok(edge.includes('case "'+op+'":'),"edge "+op);
  }
  assert.ok(edge.includes(".eq('caller_id',actor)"));
  assert.ok(edge.includes(".neq('caller_id',actor)"));
  assert.ok(edge.includes(".is('callee_id',null)"));
  assert.ok(edge.includes(".eq('invite_hash',hash)"));
  assert.ok(edge.includes("new Date(now.getTime()+8*60*1000)"));
  assert.ok(sql.includes('enable row level security'));
  assert.ok(sql.includes('revoke all on public.story_pilot_call_rooms'));
  assert.ok(sql.includes('veto-call-room-ttl'));
  assert.ok(sql.includes("status in ('offered', 'answered')"));
  assert.ok(!api.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
test('Protected signaling is separate from Telegram private-chats MTProto APIs',()=>{
  const api=read('api/call-signal.js'),ui=read('public/calls.js');
  assert.ok(!api.includes('getViewerSession('));
  assert.ok(!api.includes('TelegramClient'));
  assert.ok(!api.includes('getDialogs('));
  assert.ok(ui.includes("fetch('/api/call-signal'"));
  assert.ok(ui.includes("document.addEventListener('visibilitychange'"));
  assert.ok(ui.includes("signalRequest('end'"));
  assert.ok(!ui.includes('localStorage'));
  assert.ok(!ui.includes('sessionStorage'));
});
