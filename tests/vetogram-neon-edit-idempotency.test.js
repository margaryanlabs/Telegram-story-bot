import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {neonArchiveOperation} from '../lib/neon-archive-store.js';

function fixture({privacy=true}={}){
  const messages=new Map(),versions=[],events=[],queries=[];
  let tombstoned=false;
  const sql={
    owner:value=>String(value),
    chat:value=>String(value),
    one:async(statement,params=[])=>{
      if(statement.includes('story_pilot_privacy_settings'))return {
        anti_delete:privacy,edit_history:privacy,ghost_inbox:privacy,
        retention_days:30
      };
      if(statement.includes('INSERT INTO public.story_pilot_messages')){
        assert.match(statement,/content_hash IS DISTINCT FROM excluded\.content_hash/);
        assert.match(statement,/deleted_at IS NULL/);
        if(tombstoned)return null;
        const key=String(params[0])+':'+String(params[2])+':'+String(params[3]);
        const hash=params[19];
        if(messages.get(key)===hash)return null;
        messages.set(key,hash);
        return {telegram_user_id:params[0],chat_id:params[2],
          message_id:params[3],direction:params[4],content_hash:hash};
      }
      throw Error('Unexpected SQL query: '+statement.slice(0,100));
    },
    query:async(statement,params)=>{
      queries.push(statement);
      if(statement.includes('story_pilot_message_versions'))versions.push(params[4]);
      if(statement.includes('story_pilot_events'))events.push(params[6]);
      return [];
    }
  };
  const capture=(textHash,eventType='edit')=>neonArchiveOperation(
    'capture_business_message',{
      row:{telegram_user_id:'111',business_connection_id:'business-111',
        chat_id:'222',message_id:17,direction:'incoming',
        text_content:'message',content_hash:textHash,
        sender_user_id:'222',sent_at:'2026-10-24T12:00:00Z'},
      eventType
    },sql);
  return {capture,messages,versions,events,queries,
    tombstone:()=>{tombstoned=true}};
}
test('new/edit repeat cannot create duplicate notifications for identical content in Neon',async()=>{
  const f=fixture();
  assert.equal((await f.capture('hash-A','new')).captured,true);
  assert.equal((await f.capture('hash-B','edit')).captured,true);
  const duplicate=await f.capture('hash-B','edit');
  assert.equal(duplicate.captured,false);
  assert.equal(duplicate.reason,'duplicate_content_or_already_deleted');
  assert.equal(f.messages.size,1);
  assert.equal(f.versions.length,2);
  assert.equal(f.events.length,2);
});
test('a later genuinely changed edit is retained, but late edit after deletion is rejected',async()=>{
  const f=fixture();
  await f.capture('hash-A','new');
  assert.equal((await f.capture('hash-B','edit')).captured,true);
  assert.equal((await f.capture('hash-C','edit')).captured,true);
  f.tombstone();
  assert.equal((await f.capture('hash-D','edit')).captured,false);
  assert.equal(f.versions.length,3);
  assert.equal(f.events.length,3);
});
test('disabled owner archive stores no text or versions',async()=>{
  const f=fixture({privacy:false});
  const result=await f.capture('hash-private','new');
  assert.equal(result.captured,false);
  assert.equal(result.reason,'privacy_disabled');
  assert.equal(f.queries.length,0);
  assert.equal(f.messages.size,0);
});
test('Neon SQL uses an atomic hash predicate rather than only in-process memoization',()=>{
  const source=readFileSync(new URL('../lib/neon-archive-store.js',import.meta.url),'utf8');
  assert.match(source,/ON CONFLICT\(telegram_user_id,chat_id,message_id\) DO UPDATE SET/);
  assert.match(source,/WHERE public\.story_pilot_messages\.deleted_at IS NULL\s+AND public\.story_pilot_messages\.content_hash IS DISTINCT FROM excluded\.content_hash/);
  assert.match(source,/ON CONFLICT\(telegram_user_id,chat_id,message_id,content_hash\) DO NOTHING/);
});
