import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCallInvite} from '../lib/veto-call-signals.js';
import {inviteToStartParam,startParamToInvite,makeCallInviteUrl} from '../lib/veto-call-invite-link.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('VETO Mini App share link transports ephemeral invitation without SDP or user IDs',()=>{
  const original=newCallInvite().invite;
  const param=inviteToStartParam(original);
  assert.match(param,/^vc_[A-Za-z0-9_-]{54}$/);
  assert.equal(param.length,57);
  assert.equal(startParamToInvite(param),original);
  const url=makeCallInviteUrl('VetoExampleBot',original);
  assert.equal(new URL(url).hostname,'t.me');
  assert.equal(new URL(url).pathname,'/VetoExampleBot');
  assert.equal(new URL(url).searchParams.get('startapp'),param);
  assert.ok(!url.includes('v=0'));
  assert.ok(!url.includes('VETOR1'));
  assert.ok(!url.includes('callerId'));
});
test('Startapp decoder rejects tampered links and wrong bot usernames',()=>{
  const param=inviteToStartParam(newCallInvite().invite);
  for(const broken of ['', 'abc', param.slice(0,-1), param+'a',
    param.replace('vc_','wrong_'),param.slice(0,10)+'!'+param.slice(11)]){
    assert.throws(()=>startParamToInvite(broken));
  }
  assert.throws(()=>makeCallInviteUrl('https://evil.example/path',newCallInvite().invite));
  assert.throws(()=>makeCallInviteUrl('not valid',newCallInvite().invite));
});
test('Mini App uses call deep link only to prefill, with real explicit consent and account verification',()=>{
  const app=read('public/app.js'),calls=read('public/calls.js');
  const api=read('api/call-signal.js'),html=read('public/studio.html');
  assert.ok(app.includes('tgWebAppStartParam'));
  assert.ok(app.includes("?'calls'"));
  assert.ok(calls.includes('function prefillDeepLink()'));
  assert.ok(calls.includes("tg?.initDataUnsafe?.start_param"));
  assert.ok(calls.includes("callIncoming').value"));
  assert.ok(calls.includes("addEventListener('click',joinAssisted)"));
  assert.ok(calls.includes('function copyInviteLink()'));
  assert.ok(calls.includes('state.inviteShareUrl='));
  assert.ok(html.includes('id="callInviteShare"'));
  assert.ok(api.includes('makeCallInviteUrl(botUsername,room.invite)'));
  assert.ok(api.includes('validateTelegramMiniApp('));
  assert.ok(!calls.includes('joinAssisted();'));
  assert.ok(html.includes('второго устройства'));
});
