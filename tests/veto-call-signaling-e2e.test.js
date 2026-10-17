import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {storyPilotPublicKey,verifyEdgeSignature} from '../lib/viewer-sync-signing.js';
import {parseCallInvite} from '../lib/veto-call-signals.js';
import {startParamToInvite} from '../lib/veto-call-invite-link.js';

const BOT='123456:test-bot-signature-SecretExample';
process.env.TELEGRAM_BOT_TOKEN=BOT;
process.env.TELEGRAM_API_HASH='test-hash-only-in-process';
const {default:handler}=await import('../api/call-signal.js?two-account-test');
const originalFetch=globalThis.fetch;
const rooms=new Map();
const prefs=new Map();
const alerts=[];
const offer='v=0\r\n'+'a=candidate:0 1 udp 123 test.local 555 typ host\r\n'.repeat(3);
const answer='v=0\r\n'+'a=candidate:1 1 udp 321 test.local 556 typ host\r\n'.repeat(3);

function signedInitData(id,authDate=Math.floor(Date.now()/1000)){
  const params=new URLSearchParams({
    user:JSON.stringify({id,first_name:'Consent Test '+id}),
    auth_date:String(authDate),query_id:'AA-test-'+id,
  });
  const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT).digest();
  params.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));
  return params.toString();
}
function edgeOK(data){return {ok:true,status:200,json:async()=>({ok:true,data})};}
function edgeFail(error){return {ok:false,status:403,json:async()=>({ok:false,error})};}
function gateway(op,a){
  const now=Date.now();
  const existing=rooms.get(a.roomId);
  switch(op){
    case 'call_preferences_get':
      return edgeOK({notificationsEnabled:prefs.get(a.userId)?.enabled===true});
    case 'call_preferences_set':
      prefs.set(a.userId,{enabled:a.enabled,lastAlert:prefs.get(a.userId)?.lastAlert||0});
      return edgeOK({notificationsEnabled:a.enabled});
    case 'call_probe':return edgeOK({signaling:'ready',database:'ready',retentionMinutes:8});
    case 'call_create':
      if(existing)return edgeFail('call_invite_unavailable');
      if(a.recipientId){
        const pref=prefs.get(a.recipientId);
        if(!pref?.enabled||now-pref.lastAlert<3*60000)
          return edgeFail('call_recipient_unavailable');
        pref.lastAlert=now;
      }
      rooms.set(a.roomId,{callerId:a.callerId,recipientId:a.recipientId||null,
        hash:a.tokenHash,offer:a.offerSdp,
        calleeId:null,answer:null,expiresAt:now+8*60000});
      return edgeOK({roomId:a.roomId,expiresAt:new Date(now+8*60000).toISOString()});
    case 'call_inspect':
      if(!existing||existing.hash!==a.tokenHash||existing.callerId===a.userId||
        (existing.recipientId&&existing.recipientId!==a.userId)||
        existing.calleeId||now>existing.expiresAt)return edgeFail('call_invite_unavailable');
      return edgeOK({roomId:a.roomId,callerId:existing.callerId,offerSdp:existing.offer,
        expiresAt:new Date(existing.expiresAt).toISOString()});
    case 'call_answer':
      if(!existing||existing.hash!==a.tokenHash||existing.calleeId||
        existing.callerId===a.userId||
        (existing.recipientId&&existing.recipientId!==a.userId))return edgeFail('call_invite_unavailable');
      existing.calleeId=a.userId;existing.answer=a.answerSdp;
      return edgeOK({roomId:a.roomId,callerId:existing.callerId,
        calleeId:existing.calleeId,status:'answered'});
    case 'call_poll':
      if(!existing||existing.callerId!==a.userId)return edgeFail('call_access_denied');
      return edgeOK(existing.calleeId
        ?{status:'answered',answerSdp:existing.answer,calleeId:existing.calleeId}
        :{status:'offered'});
    case 'call_end':
      if(!existing)return edgeOK({closed:true});
      if(existing.callerId!==a.userId&&existing.calleeId!==a.userId)
        return edgeFail('call_access_denied');
      rooms.delete(a.roomId);return edgeOK({closed:true});
    default:throw Error('unknown gateway action');
  }
}
async function mockFetch(url,options={}){
  const u=String(url);
  if(u.includes('/getMe'))return {ok:true,json:async()=>({
    ok:true,result:{username:'VetoTestBot'}
  })};
  if(u.includes('/sendMessage')){
    const message=JSON.parse(options.body);
    assert.equal(typeof message.chat_id,'string');
    assert.ok(!message.text.includes('v=0'));
    assert.equal(message.protect_content,true);
    alerts.push(message);
    return {ok:true,json:async()=>({ok:true,result:{message_id:345}})};
  }
  if(!u.endsWith('/functions/v1/veto-call-signal'))throw Error('Unexpected external request '+u);
  const body=String(options.body||'');
  const header=options.headers;
  assert.equal(verifyEdgeSignature({publicKey:storyPilotPublicKey(),body,
    timestamp:header['x-story-timestamp'],signature:header['x-story-signature']}),true,
    'Every call store action must be signed by trusted Vercel key');
  const payload=JSON.parse(body);
  // Signature covers operation, owner ID and SDP; browser must not be allowed to
  // call the Edge store directly with unsigned user-selected identifiers.
  assert.match(payload.op,/^call_(probe|preferences_get|preferences_set|create|inspect|answer|poll|end)$/);
  return gateway(payload.op,payload.args);
}
async function call(id,action,fields={},authOverride){
  const res={headers:{},statusCode:0,result:null,
    setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    status(code){this.statusCode=code;return this;},
    json(json){this.result=json;return this;}};
  await handler({method:'POST',headers:{
    'x-telegram-init-data':authOverride??signedInitData(id),
  },body:{action,...fields}},res);
  assert.equal(res.headers['cache-control'],'private, no-store, max-age=0');
  return res;
}
test('Real Vercel handler protects invite→accept→poll→end between two signed Telegram accounts',async()=>{
  globalThis.fetch=mockFetch;rooms.clear();
  try{
    const anonymous=await call(11,'create',{sdp:offer},'');
    assert.equal(anonymous.statusCode,401);
    const expired=await call(11,'ice',{},signedInitData(11,Math.floor(Date.now()/1000)-4000));
    assert.equal(expired.statusCode,401);
    const probe=await call(11,'probe');
    assert.equal(probe.statusCode,200);
    assert.equal(probe.result.signaling,'ready');
    assert.equal(probe.result.database,'ready');
    const caller=await call(11,'create',{sdp:offer});
    assert.equal(caller.statusCode,200);
    assert.equal(caller.result.ok,true);
    assert.ok(caller.result.invite.startsWith('VETOR1:'));
    assert.ok(caller.result.shareUrl.startsWith('https://t.me/VetoTestBot?startapp=vc_'));
    assert.equal(startParamToInvite(new URL(caller.result.shareUrl).searchParams.get('startapp')),
      caller.result.invite);
    const owner=await call(11,'inspect',{invite:caller.result.invite});
    assert.equal(owner.statusCode,410,'Caller may not claim own invitation as callee');
    const callee=await call(22,'inspect',{invite:caller.result.invite});
    assert.equal(callee.statusCode,200);
    assert.equal(callee.result.offerSdp,offer);
    const claim=await call(22,'answer',{invite:caller.result.invite,sdp:answer});
    assert.equal(claim.statusCode,200);
    const replay=await call(33,'answer',{invite:caller.result.invite,sdp:answer});
    assert.equal(replay.statusCode,410,'Only first consenting callee can claim a room');
    const stranger=await call(33,'poll',{roomId:caller.result.roomId});
    assert.equal(stranger.statusCode,403);
    const calleeCannotPoll=await call(22,'poll',{roomId:caller.result.roomId});
    assert.equal(calleeCannotPoll.statusCode,403);
    const poll=await call(11,'poll',{roomId:caller.result.roomId});
    assert.equal(poll.statusCode,200);
    assert.equal(poll.result.status,'answered');
    assert.equal(poll.result.answerSdp,answer);
    assert.equal(String(poll.result.calleeId),'22');
    const strangerCannotEnd=await call(33,'end',{roomId:caller.result.roomId});
    assert.equal(strangerCannotEnd.statusCode,403);
    const calleeCanEnd=await call(22,'end',{roomId:caller.result.roomId});
    assert.equal(calleeCanEnd.statusCode,200);
    assert.equal(rooms.size,0,'Room and all SDP must be removed after hangup');
  }finally{globalThis.fetch=originalFetch;}
});

test('Incoming bot alerts require explicit self opt-in, signed recipient binding and per-recipient throttle',async()=>{
  globalThis.fetch=mockFetch;rooms.clear();prefs.clear();alerts.length=0;
  try{
    const off=await call(22,'preferences_get');
    assert.equal(off.statusCode,200);
    assert.equal(off.result.notificationsEnabled,false);
    assert.equal(off.result.myCallId,'22');
    const cannotRing=await call(11,'create',{sdp:offer,recipientId:'22'});
    assert.equal(cannotRing.statusCode,410,'Nonconsenting users cannot receive push');
    assert.equal(alerts.length,0);
    const enable=await call(22,'preferences_set',{enabled:true});
    assert.equal(enable.statusCode,200);
    assert.equal(enable.result.notificationsEnabled,true);
    const target=await call(11,'create',{sdp:offer,recipientId:'22'});
    assert.equal(target.statusCode,200);
    assert.equal(target.result.notificationSent,true);
    assert.equal(alerts.length,1);
    assert.equal(alerts[0].chat_id,'22');
    assert.ok(alerts[0].reply_markup.inline_keyboard[0][0].url.includes('?startapp='));
    assert.ok(!JSON.stringify(alerts[0]).includes(offer));
    const thirdParty=await call(33,'inspect',{invite:target.result.invite});
    assert.equal(thirdParty.statusCode,410,'Forwarded invite must not be usable by third party');
    const recipient=await call(22,'inspect',{invite:target.result.invite});
    assert.equal(recipient.statusCode,200);
    const thirdPartyAnswer=await call(33,'answer',{invite:target.result.invite,sdp:answer});
    assert.equal(thirdPartyAnswer.statusCode,410);
    const secondRing=await call(11,'create',{sdp:offer,recipientId:'22'});
    assert.equal(secondRing.statusCode,410,'One alert per 3 minutes');
    assert.equal(alerts.length,1);
    const disable=await call(22,'preferences_set',{enabled:false});
    assert.equal(disable.statusCode,200);
    const reRing=await call(11,'create',{sdp:offer,recipientId:'22'});
    assert.equal(reRing.statusCode,410,'Recipient may revoke notifications');
    const end=await call(11,'end',{roomId:target.result.roomId});
    assert.equal(end.statusCode,200);
  }finally{globalThis.fetch=originalFetch;}
});
