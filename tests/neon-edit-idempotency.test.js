import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {neonArchiveOperation} from '../lib/neon-archive-store.js';

function fixture(){
  let row=null,versions=0,events=0,updates=0;
  const sql={
    owner:value=>String(value),chat:value=>String(value),
    one:async(statement,args)=>{
      if(statement.startsWith('SELECT * FROM public.story_pilot_privacy_settings')){
        return {anti_delete:true,edit_history:true,ghost_inbox:true,retention_days:30};
      }
      if(statement.startsWith('INSERT INTO public.story_pilot_messages')){
        assert.match(statement,/content_hash IS DISTINCT FROM excluded\.content_hash/);
        const incoming={content_hash:args[19],text_content:args[9],deleted_at:null,
          direction:args[4],message_id:String(args[3])};
        if(row?.deleted_at || row?.content_hash===incoming.content_hash)return null;
        if(row)updates++;
        row=incoming;
        return row;
      }
      throw Error('Unexpected query: '+statement.slice(0,80));
    },
    query:async statement=>{
      if(statement.includes('INSERT INTO public.story_pilot_message_versions')){versions++;return [];}
      if(statement.includes('INSERT INTO public.story_pilot_events')){events++;return [];}
      throw Error('Unexpected query: '+statement.slice(0,80));
    },
  };
  return {sql,get versions(){return versions},get events(){return events},
    get updates(){return updates},deleteMessage(){if(row)row.deleted_at='2026-10-24T00:00:00Z'}};
}
function msg(text,hash,eventType='edit'){
  return {eventType,row:{telegram_user_id:'111',business_connection_id:'bc-A',
    chat_id:'222',message_id:5,direction:'incoming',sender_user_id:'222',
    text_content:text,content_hash:hash}};
}

test('duplicate edited webhook never creates a second version or edit alert',async()=>{
  const f=fixture();
  const first=await neonArchiveOperation('capture_business_message',msg('before','hash-A','new'),f.sql);
  assert.equal(first.captured,true);
  const edited=await neonArchiveOperation('capture_business_message',msg('after','hash-B'),f.sql);
  assert.equal(edited.captured,true);
  const duplicate=await neonArchiveOperation('capture_business_message',msg('after','hash-B'),f.sql);
  assert.equal(duplicate.captured,false);
  assert.equal(duplicate.reason,'duplicate_content_or_already_deleted');
  assert.equal(f.versions,2);
  assert.equal(f.events,2);
  assert.equal(f.updates,1);
});
test('late duplicated original and stale edit after deletion never restore a tombstone',async()=>{
  const f=fixture();
  await neonArchiveOperation('capture_business_message',msg('before','hash-A','new'),f.sql);
  f.deleteMessage();
  const delayed=await neonArchiveOperation('capture_business_message',msg('later','hash-C'),f.sql);
  assert.equal(delayed.captured,false);
  assert.equal(f.versions,1);
  assert.equal(f.events,1);
  assert.equal(f.updates,0);
});
test('SQL guards no-op edit on hash equality and never rewrites a deleted message',()=>{
  const source=readFileSync(new URL('../lib/neon-archive-store.js',import.meta.url),'utf8');
  assert.match(source,/public\.story_pilot_messages\.content_hash IS DISTINCT FROM excluded\.content_hash/);
  assert.match(source,/public\.story_pilot_messages\.deleted_at IS NULL/);
  assert.match(source,/if\(saved&&p\.editHistory\)/);
  assert.match(source,/if\(saved\)\{/);
});
test('disabled Business bot cannot reach archive or deletion even on webhook replay',()=>{
  const source=readFileSync(new URL('../api/webhook-v7.js',import.meta.url),'utf8');
  const handler=source.slice(source.indexOf('const privacyBusinessMessage = update?.business_message'),
    source.indexOf('if (update?.message)',source.indexOf('const privacyBusinessMessage = update?.business_message')));
  assert.match(handler,/privacy_message_ignored:'business_connection_disabled'/);
  assert.match(handler,/privacy_delete_ignored:'business_connection_disabled'/);
  assert.match(handler,/BUSINESS_CONNECTION_STATE_UNVERIFIED/g);
  assert.match(handler,/connection\?\.is_enabled !== true/g);
});
