import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Api } from 'teleproto';
import { connectBusiness, disconnectBusiness, readBusinessConsentState, signConsentSnapshot,
  verifyConsentSnapshot, businessRights, recipientSnapshot, rightsSnapshot, withBusinessWriteLock, unifiedOnboardingEnabled } from '../lib/telegram-business-consent.js';
import { createBusinessWizardHandler, verifyStoredBusinessConnection } from '../api/business-wizard.js';

// Business consent unit fixtures intentionally use the non-Neon transport.
// Vercel Preview selects Neon without preview-only secrets; never let unit
// tests invoke a real database lease. Full Neon contract/preflight remains
// separately verified by its dedicated suite and release gate.
const originalUnitProvider = process.env.VETO_STORAGE_PROVIDER;
process.env.VETO_STORAGE_PROVIDER = 'supabase';
after(() => {
  if (originalUnitProvider === undefined) delete process.env.VETO_STORAGE_PROVIDER;
  else process.env.VETO_STORAGE_PROVIDER = originalUnitProvider;
});


function clientFixture(initial=[],mode='success') {
  let bots=initial,reads=0,writes=0;
  const bot={id:999n,bot:true,botBusiness:true,accessHash:99n};
  const client={
    getMe:async()=>({id:111n,firstName:'Test'}),
    getEntity:async()=>bot,
    getInputEntity:async entity=>new Api.InputUser({userId:entity.id??entity,accessHash:99n}),
    getDialogs:async()=>[101n,202n,303n].map(id=>({id,isUser:true,entity:{id,accessHash:99n}})),
    invoke:async rpc=>{
      if(rpc instanceof Api.account.GetConnectedBots) {
        reads++;
        if(mode==='concurrent'&&reads===2) bots=[own({newChats:true,users:[],excludeUsers:[]})];
        return {connectedBots:bots,users:[bot]};
      }
      assert.ok(rpc instanceof Api.account.UpdateConnectedBot);writes++;
      if(mode!=='timeout-before') bots=rpc.deleted?[]:[own(rpc.recipients,rpc.rights)];
      if(mode.startsWith('timeout')) throw new Error('ETIMEDOUT');
      return {};
    },
  };
  return {client,get bots(){return bots},get writes(){return writes}};
}
const own=(recipients={users:[],excludeUsers:[]},rights={})=>({botId:999n,recipients,rights});
const all={scope:'all-private',scopeConsent:true,storiesConsent:true};
test('installed teleproto serializes manageStories at wire flag 13 without other privileges',()=>{
  assert.equal(businessRights({},true).getBytes().readUInt32LE(4),8192);
  assert.equal(businessRights({},false).getBytes().readUInt32LE(4),0);
  assert.equal(businessRights({manageStories:true,reply:true},false).getBytes().readUInt32LE(4),8193);
});
test('new connection is minimal and preserves separate read-only Ghost View mechanism',async()=>{
  const f=clientFixture();const result=await connectBusiness(f.client,all);
  assert.equal(result.manageStories,true);assert.equal(result.needsMessageProof,true);assert.equal(f.writes,1);
  assert.deepEqual(Object.entries(rightsSnapshot(f.bots[0].rights)).filter(([,v])=>v).map(([k])=>k),['manageStories']);
});
test('all recipient modes plus exclusions and selected peer validation',async()=>{
  for(const [scope,flag] of [['existing-private','existingChats'],['future-private','newChats'],['contacts','contacts'],['non-contacts','nonContacts']]) {
    const f=clientFixture();await connectBusiness(f.client,{scope,scopeConsent:true,excludeChatIds:['202']});
    const r=recipientSnapshot(f.bots[0].recipients);
    assert.equal(r[flag],true);assert.deepEqual(r.excludeUsers,['202']);
    assert.equal(['existingChats','newChats','contacts','nonContacts'].filter(k=>r[k]).length,1);
  }
  const f=clientFixture();await connectBusiness(f.client,{scope:'selected-private',scopeConsent:true,chatIds:['101'],excludeChatIds:['202']});
  assert.deepEqual(recipientSnapshot(f.bots[0].recipients).users,['101']);
  await assert.rejects(connectBusiness(clientFixture().client,{scope:'selected-private',scopeConsent:true,chatIds:['999']}),/доступные/);
  await assert.rejects(connectBusiness(clientFixture().client,{scope:'selected-private',scopeConsent:true,chatIds:['101'],excludeChatIds:['101']}),/одновременно/);
});
test('existing connection is idempotent and keeps manageStories, scope and exclusions',async()=>{
  const prior=own({existingChats:true,excludeSelected:true,users:[101n],excludeUsers:[202n]},{manageStories:true,reply:true});
  const f=clientFixture([prior]);
  const result=await connectBusiness(f.client,{scope:'preserve'});
  assert.equal(result.unchanged,true);assert.equal(f.writes,0);
  assert.deepEqual(rightsSnapshot(f.bots[0].rights),rightsSnapshot(prior.rights));
});
test('Stories opt-in changes only manageStories; revoke only Stories keeps message rights and recipients',async()=>{
  const prior=own({newChats:true,users:[101n],excludeUsers:[202n]},{reply:true,readMessages:true});
  const f=clientFixture([prior]);await connectBusiness(f.client,{scope:'preserve',storiesConsent:true});
  assert.equal(f.bots[0].rights.manageStories,true);
  assert.equal(f.bots[0].rights.reply,true);
  assert.deepEqual(recipientSnapshot(f.bots[0].recipients),recipientSnapshot(prior.recipients));
  await connectBusiness(f.client,{scope:'preserve',revokeStories:true});
  assert.equal(f.bots[0].rights.manageStories,false);assert.equal(f.bots[0].rights.readMessages,true);
});
test('other bot, changed snapshots and concurrent edits cannot be replaced',async()=>{
  const other=clientFixture([{botId:888n}]);await assert.rejects(connectBusiness(other.client,all),/другой Business-бот/);assert.equal(other.writes,0);
  const changed=clientFixture([],'concurrent');await assert.rejects(connectBusiness(changed.client,all),/изменились/);assert.equal(changed.writes,0);
  const f=clientFixture();const state=await readBusinessConsentState(f.client);
  const token=signConsentSnapshot('111',state,'test',100);
  assert.doesNotThrow(()=>verifyConsentSnapshot(token,'111',state,'test',101));
  for(const [owner,snapshot,secret,now] of [['222',state,'test',101],['111',{fingerprint:'changed'},'test',101],['111',state,'wrong',101],['111',state,'test',400000]])
    assert.throws(()=>verifyConsentSnapshot(token,owner,snapshot,secret,now));
});
test('ambiguous write errors are reconciled by reads with zero write retries',async()=>{
  const applied=clientFixture([],'timeout-after');const result=await connectBusiness(applied.client,all);
  assert.equal(result.recoveredAfterError,true);assert.equal(applied.writes,1);
  const notApplied=clientFixture([],'timeout-before');await assert.rejects(connectBusiness(notApplied.client,all),/ETIMEDOUT/);assert.equal(notApplied.writes,1);
});
test('explicit business revoke leaves the independent session and archive untouched',async()=>{
  const f=clientFixture([own()]);assert.equal((await disconnectBusiness(f.client)).disconnected,true);assert.equal(f.writes,1);
  assert.equal((await disconnectBusiness(f.client)).unchanged,true);assert.equal(f.writes,1);
});
function signedInit(id,token) {
  const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id})});
  const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
  p.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));return p.toString();
}
function response() {return {headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};}
function apiFixture(f=clientFixture(),settingsFailure=false) {
  let settingsWrites=0;
  const handler=createBusinessWizardHandler({token:'test-token',
    getViewerSession:async()=>({status:'active',session_ciphertext:'encrypted-fixture',telegram_account_user_id:'111'}),
    openJson:async()=>({session:'fixture-only'}),
    withBackupClient:async(_session,callback,options)=>{if(options)assert.equal(options.requestRetries,1);return callback(f.client)},
    listBackupDialogs:async()=>[],getPrivacySettings:async()=>({antiDelete:false}),
    updatePrivacySettings:async(_id,patch)=>{settingsWrites++;assert.deepEqual(patch,{antiDelete:true,editHistory:true,ghostInbox:true});if(settingsFailure)throw Error('store failure')},
    verifyStoredBusinessConnection:async()=>({botApi:'pending-webhook'}),upsertBusinessConnectionState:async()=>{},
  });
  const request=async body=>{const res=response();await handler({method:'POST',headers:{'x-telegram-init-data':signedInit(111,'test-token')},body},res);return res};
  return {handler,request,get settingsWrites(){return settingsWrites},f};
}
test('API checks cryptographic Mini App auth and never enables Anti-Delete implicitly',async()=>{
  const a=apiFixture();const bad=response();await a.handler({method:'POST',headers:{},body:{action:'prepare'}},bad);assert.equal(bad.code,401);
  const prepared=await a.request({action:'prepare'});assert.equal(prepared.code,200);assert.equal(prepared.body.diagnostics.antiDeleteProof,'not-verified-in-this-onboarding');
  const base={action:'connect',consent:true,approval:'CONNECT_SELECTED_PRIVATE_CHATS',snapshotToken:prepared.body.snapshotToken,...all};
  const denied=await a.request({...base,storiesConsent:false});assert.equal(denied.code,409);assert.equal(a.f.writes,0);
  const stories=await a.request(base);assert.equal(stories.code,200);assert.equal(a.settingsWrites,0);assert.equal(stories.body.settingsUpdated,false);
});
test('API reports partial archive settings failure without rolling back the Business connection',async()=>{
  const a=apiFixture(clientFixture(),true);const p=await a.request({action:'prepare'});
  const res=await a.request({action:'connect',consent:true,approval:'CONNECT_SELECTED_PRIVATE_CHATS',snapshotToken:p.body.snapshotToken,...all,antiDeleteConsent:true});
  assert.equal(res.code,200);assert.equal(res.body.connected,true);assert.equal(res.body.settingsUpdated,false);
  assert.equal(res.body.archiveConsentRequested,true,'explicit opt-in must not be hidden on storage failure');
  assert.equal(a.f.writes,1);
});
test('production feature gate is off unless explicitly enabled',()=>{
  const before=process.env.VERCEL_ENV,flag=process.env.VETOGRAM_UNIFIED_ONBOARDING;
  try {process.env.VERCEL_ENV='production';delete process.env.VETOGRAM_UNIFIED_ONBOARDING;assert.equal(unifiedOnboardingEnabled(),false);
    process.env.VETOGRAM_UNIFIED_ONBOARDING='1';assert.equal(unifiedOnboardingEnabled(),true);
  } finally {if(before===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before;if(flag===undefined)delete process.env.VETOGRAM_UNIFIED_ONBOARDING;else process.env.VETOGRAM_UNIFIED_ONBOARDING=flag;}
});
test('production disabled prepare exposes capability only and performs no session reads',async()=>{
  const before=process.env.VERCEL_ENV,flag=process.env.VETOGRAM_UNIFIED_ONBOARDING;
  try {
    process.env.VERCEL_ENV='production';delete process.env.VETOGRAM_UNIFIED_ONBOARDING;
    const handler=createBusinessWizardHandler({token:'test-token',getViewerSession:async()=>{throw Error('must not read sessions')}});
    const res=response();await handler({method:'POST',headers:{'x-telegram-init-data':signedInit(111,'test-token')},body:{action:'prepare'}},res);
    assert.equal(res.code,200);assert.equal(res.body.enabled,false);assert.equal(res.body.snapshotToken,undefined);
  } finally {if(before===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before;if(flag===undefined)delete process.env.VETOGRAM_UNIFIED_ONBOARDING;else process.env.VETOGRAM_UNIFIED_ONBOARDING=flag;}
});
test('Bot API verification cannot write an older Connection ID or accept another owner',async()=>{
  const previous=globalThis.fetch,hash=process.env.TELEGRAM_API_HASH,token=process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_API_HASH='fixture';process.env.TELEGRAM_BOT_TOKEN='test-token';
  let owner=111,storeOps=[];
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('/getBusinessConnection')) return {ok:true,json:async()=>({ok:true,result:{id:'old',user:{id:owner},user_chat_id:owner,is_enabled:true}})};
    const p=JSON.parse(options.body);storeOps.push(p.op);assert.equal(p.op,'get_business_connection_state');
    return {ok:true,json:async()=>({ok:true,data:{businessConnectionId:'old'}})};
  };
  try {
    assert.equal((await verifyStoredBusinessConnection('test-token','111')).botApi,'verified');
    owner=222;assert.equal((await verifyStoredBusinessConnection('test-token','111')).botApi,'not-verified');
    assert.deepEqual(storeOps,['get_business_connection_state','get_business_connection_state']);
  } finally {globalThis.fetch=previous;if(hash===undefined)delete process.env.TELEGRAM_API_HASH;else process.env.TELEGRAM_API_HASH=hash;if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;}
});

test('same-owner writes are serialized per instance and locks release after failures',async()=>{
  let release;const held=withBusinessWriteLock('111',()=>new Promise(resolve=>{release=resolve}));
  await assert.rejects(withBusinessWriteLock('111',async()=>{}),/уже выполняется/);
  await assert.doesNotReject(withBusinessWriteLock('222',async()=>{}));
  release();await held;
  await assert.rejects(withBusinessWriteLock('111',async()=>{throw Error('fixture failure')}),/fixture failure/);
  await assert.doesNotReject(withBusinessWriteLock('111',async()=>{}));
});
test('existing Business owner may change only chat scope; first-time owner still needs explicit feature consent',async()=>{
  const prior=own({existingChats:true,users:[],excludeUsers:[]},{manageStories:true});
  const existing=apiFixture(clientFixture([prior]));
  const p=await existing.request({action:'prepare'});
  const body={action:'connect',consent:true,approval:'CONNECT_SELECTED_PRIVATE_CHATS',
    snapshotToken:p.body.snapshotToken,scope:'all-private',scopeConsent:true,
    storiesConsent:false,antiDeleteConsent:false};
  const updated=await existing.request(body);
  assert.equal(updated.code,200);
  assert.equal(updated.body.manageStories,true);
  assert.equal(existing.f.writes,1);
  assert.equal(existing.settingsWrites,0);
  assert.equal(existing.f.bots[0].rights.manageStories,true);

  const fresh=apiFixture();const f=await fresh.request({action:'prepare'});
  const denied=await fresh.request({...body,snapshotToken:f.body.snapshotToken});
  assert.equal(denied.code,409);
  assert.equal(fresh.f.writes,0);
});
