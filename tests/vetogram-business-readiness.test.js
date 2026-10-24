import test from 'node:test';
import assert from 'node:assert/strict';
import {businessConnectionReadiness} from '../lib/vetogram-business-readiness.js';
const connection=(patch={})=>({
  id:'trusted-connection',user:{id:111},user_chat_id:922337,
  is_enabled:true,rights:{can_manage_stories:true},...patch
});
test('a separate Bot API user_chat_id does not invalidate verified Business owner',()=>{
  const result=businessConnectionReadiness('111','trusted-connection',connection());
  assert.deepEqual(result,{botApi:'verified',serverState:'verified',
    storiesPermission:'granted',messageEventsProven:false});
});
test('connection owner AND exact connection ID must match',()=>{
  for(const patch of [{id:'other-connection'},{user:{id:222}},
    {user:null},{user_chat_id:0},{user_chat_id:null},
    {user_chat_id:Number.MAX_SAFE_INTEGER+1},{is_enabled:null}]){
    const result=businessConnectionReadiness('111','trusted-connection',connection(patch));
    assert.equal(result.botApi,'not-verified');
    assert.equal(result.messageEventsProven,false);
  }
  assert.equal(businessConnectionReadiness('111','wrong-id',connection()).botApi,'not-verified');
  assert.equal(businessConnectionReadiness('111','trusted-connection',null).botApi,'not-verified');
});
test('disabled connection is not ready, even when earlier rights were granted',()=>{
  const result=businessConnectionReadiness('111','trusted-connection',connection({is_enabled:false}));
  assert.equal(result.botApi,'disabled');
  assert.equal(result.storiesPermission,'not-granted');
});
test('a valid Business connection is not proof of Story permission or message delivery',()=>{
  const noRights=businessConnectionReadiness('111','trusted-connection',connection({rights:null}));
  assert.equal(noRights.botApi,'verified');
  assert.equal(noRights.storiesPermission,'unknown');
  assert.equal(noRights.messageEventsProven,false);
  const noStoryPermission=businessConnectionReadiness('111','trusted-connection',
    connection({rights:{can_manage_stories:false,can_reply:true}}));
  assert.equal(noStoryPermission.storiesPermission,'not-granted');
  assert.equal(noStoryPermission.messageEventsProven,false);
});
