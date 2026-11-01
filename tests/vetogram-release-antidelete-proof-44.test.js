import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api=read('api/privacy.js'),client=read('public/privacy.js');
const start=api.indexOf('async function ghostDiagnostics(token, userId) {');
const end=api.indexOf('function transientStoreError(',start);
assert.ok(start>=0&&end>start);
const diagnosticsCode=api.slice(start,end);
function fixture({deleted=false,webhook=true,enabled=true,archiveReady=true,connectionOwner='owner-telegram-id',connectionId='owner-business-connection',telegramUnavailable=false}={}){
  const tg=async (_token,method)=>{
    if(method==='getWebhookInfo')
      return webhook?{url:'https://example.com/api/webhook-v8',pending_update_count:0}:{url:''};
    if(method==='getBusinessConnection') {
      if(telegramUnavailable) throw new Error('Telegram connection verification unavailable');
      return {id:connectionId,user:{id:connectionOwner},is_enabled:enabled,
        rights:{can_manage_stories:true,can_read_messages:true}};
    }
    return null;
  };
  const fn=new Function('getPrivacySettings','viewerStoreHealth','listDeletedFeed','tg',
    'getBusinessConnectionState','connectionIdFromMenu',diagnosticsCode+';return ghostDiagnostics')(
      async()=>({antiDelete:enabled,ghostFocus:true,notifyDeletes:true}),
      async()=>({storage:'ok',directGhostWrites:archiveReady,mediaVault:true}),
      async()=>({items:deleted?[{deletedAt:'2026-10-25T00:00:00Z',
        chatTitle:'Согласившийся тестовый контакт',mediaArchiveStatus:'archived',businessConnectionId:'owner-business-connection'}]:[]}),
      tg,async()=>({businessConnectionId:'owner-business-connection',isEnabled:enabled}),
      ()=>null
    );
  return fn('bot-token','owner-telegram-id');
}
test('configured permissions without real deleted event cannot report proven readiness',async()=>{
  const result=await fixture();
  assert.equal(result.status,'configured');
  assert.equal(result.liveDeleteProof.captured,false);
  assert.equal(result.checks.business.ok,true);
  assert.equal(result.checks.antiDelete.ok,true);
  assert.match(result.note,/no real delete event/i);
});
test('real persisted owner-scoped deletion proof unlocks readiness only with operational pipeline',async()=>{
  const result=await fixture({deleted:true});
  assert.equal(result.status,'ready');
  assert.equal(result.liveDeleteProof.captured,true);
  assert.match(result.liveDeleteProof.chatTitle,/тестовый контакт/);
  assert.equal(result.liveDeleteProof.mediaArchived,true);
});
test('existing deletion does not bypass absent webhook or revoked Business rights',async()=>{
  const noWebhook=await fixture({deleted:true,webhook:false});
  assert.equal(noWebhook.status,'attention');
  const noBusiness=await fixture({deleted:true,enabled:false});
  assert.equal(noBusiness.status,'attention');
  assert.equal(noBusiness.checks.antiDelete.ok,false);
});
test('Archive unavailable does not report protected storage ready',async()=>{
  const outcome=await fixture({deleted:true,archiveReady:false});
  assert.equal(outcome.status,'attention');
  assert.equal(outcome.checks.storage.ok,false);
});
test('UI distinguishes configured vs proven, never creates synthetic deletion',()=>{
  assert.match(client,/diagnostics.status === 'configured'/);
  assert.match(client,/Подключено · ждём тест удаления/);
  assert.match(client,/Есть сохранённое реальное удаление/);
  assert.match(client,/Self-Test не подделывает Telegram delete event/);
  assert.match(client,/Telegram delete event/);
  assert.doesNotMatch(diagnosticsCode,/createDeleteEvent|synthesizeDelete|fakeDelete/);
});

test('stale stored connection never counts as verified when live Bot API fails',async()=>{
  const result=await fixture({deleted:true,telegramUnavailable:true});
  assert.equal(result.status,'attention');
  assert.equal(result.checks.business.ok,false);
  assert.equal(result.business.verifiedNow,false);
});
test('Bot API owner or Business ID mismatch cannot certify another account',async()=>{
  for(const settings of [{connectionOwner:'another-user'},{connectionId:'another-connection'}]){
    const result=await fixture({deleted:true,...settings});
    assert.equal(result.status,'attention');
    assert.equal(result.checks.business.ok,false);
    assert.equal(result.business.verifiedNow,false);
  }
});

test('old archive copies never prove a newly connected Business bot',async()=>{
  // The current live connection is verified, but its newest archive items
  // must belong to the exact verified ID, not a previous bot.
  const evaluator=new Function('getPrivacySettings','viewerStoreHealth','listDeletedFeed','tg',
    'getBusinessConnectionState','connectionIdFromMenu',diagnosticsCode+';return ghostDiagnostics')(
      async()=>({antiDelete:true,ghostFocus:true,notifyDeletes:true}),
      async()=>({storage:'ok',directGhostWrites:true,mediaVault:true}),
      async()=>({items:[{deletedAt:'2026-10-30T00:00:00Z',
        chatTitle:'Старый чат',businessConnectionId:'previous-connection'}]}),
      async(_token,method)=>method==='getWebhookInfo'
        ? {url:'https://example.com/api/webhook-v8',pending_update_count:0}
        : method==='getBusinessConnection'
          ? {id:'owner-business-connection',user:{id:'owner-telegram-id'},is_enabled:true,rights:{}}
          : null,
      async()=>({businessConnectionId:'owner-business-connection',isEnabled:true}),()=>null
    );
  const result=await evaluator('bot-token','owner-telegram-id');
  assert.equal(result.status,'configured');
  assert.equal(result.liveDeleteProof.captured,false);
});
