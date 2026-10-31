import test from 'node:test';
import assert from 'node:assert/strict';
import {neonArchiveOperation} from '../lib/neon-archive-store.js';
import {readFileSync} from 'node:fs';

const owner=v=>String(v),chat=v=>String(v);
function fixture({staleSelect=false}={}) {
  let deleted=false,inserted=0;
  const row={chat_id:'222',message_id:'5',text_content:'fixture',deleted_at:null,
    direction:'incoming',chat_title:'Test',sender_display_name:'Example'};
  return {
    sql:{owner,chat,one:async()=>({anti_delete:true,edit_history:true,ghost_inbox:true,retention_days:30}),
      query:async(text,params)=>{
        if(text.includes('SELECT * FROM public.story_pilot_messages'))return !deleted||staleSelect?[row]:[];
        if(text.includes('UPDATE public.story_pilot_messages SET deleted_at')){
          if(deleted)return [];
          deleted=true;return [{message_id:'5'}];
        }
        if(text.includes('INSERT INTO public.story_pilot_events')){inserted++;return []}
        throw Error('Unexpected database operation in fixture');
      }},
    get inserted(){return inserted},
  };
}
const input={userId:'111',chatId:'222',messageIds:[5],businessConnectionId:'connected-A'};

test('deletion requires the verified Business connection identity',async()=>{
  const f=fixture();
  await assert.rejects(
    neonArchiveOperation('mark_business_messages_deleted',
      {...input,businessConnectionId:null},f.sql),
    /BUSINESS_CONNECTION_REQUIRED/
  );
  assert.equal(f.inserted,0);
});
test('delete webhook cannot update a message captured by another Business connection',async()=>{
  let verifiedSelect=false,verifiedUpdate=false;
  const sql={owner,chat,
    one:async()=>({anti_delete:true,edit_history:true,ghost_inbox:true,retention_days:30}),
    query:async(q,args)=>{
      if(q.includes('SELECT * FROM public.story_pilot_messages')){
        assert.match(q,/business_connection_id=\$4/);
        assert.equal(args[3],'connected-B');verifiedSelect=true;return [];
      }
      if(q.includes('UPDATE public.story_pilot_messages SET deleted_at')){
        assert.match(q,/business_connection_id=\$4/);
        assert.equal(args[3],'connected-B');verifiedUpdate=true;return [];
      }
      throw Error('Cross-connection delete unexpectedly created a notification');
    },
  };
  const response=await neonArchiveOperation('mark_business_messages_deleted',
    {...input,businessConnectionId:'connected-B'},sql);
  assert.equal(response.affected,0);
  assert.deepEqual(response.events,[]);
  assert.equal(verifiedSelect,true);
  assert.equal(verifiedUpdate,true);
});

test('duplicate delete webhook never returns a second notification event',async()=>{
  const f=fixture();
  const first=await neonArchiveOperation('mark_business_messages_deleted',input,f.sql);
  assert.equal(first.affected,1);assert.equal(first.events.length,1);assert.equal(f.inserted,1);
  const retry=await neonArchiveOperation('mark_business_messages_deleted',input,f.sql);
  assert.equal(retry.affected,0);assert.deepEqual(retry.events,[]);assert.equal(f.inserted,1);
});

test('stale concurrent SELECT does not emit notifications if UPDATE lost the race',async()=>{
  const f=fixture({staleSelect:true});
  const first=await neonArchiveOperation('mark_business_messages_deleted',input,f.sql);
  assert.equal(first.affected,1);
  const second=await neonArchiveOperation('mark_business_messages_deleted',input,f.sql);
  assert.equal(second.affected,0);assert.deepEqual(second.events,[]);assert.equal(f.inserted,1);
});

test('SQL marks only previously undeleted rows, preventing repeated tombstone updates',()=>{
  const src=readFileSync(new URL('../lib/neon-archive-store.js',import.meta.url),'utf8');
  assert.match(src,/message_id=ANY\(\$3::bigint\[\]\) AND business_connection_id=\$4 AND deleted_at IS NULL/);
  assert.match(src,/const newlyDeleted=before\.filter/);
});

test('permanent deletion with Anti-Delete off does not retain private edit versions',async()=>{
 let deletedVersions=0,deletedMessages=0,inserted=0;
 const sql={owner:v=>String(v),chat:v=>String(v),
   one:async()=>({anti_delete:false,edit_history:true,ghost_inbox:false,retention_days:30}),
   query:async(q,params)=>{
     if(q.includes('SELECT * FROM public.story_pilot_messages')) return [{
       message_id:'5',chat_id:'222',deleted_at:null,media_storage_path:null,direction:'incoming'
     }];
     if(q.includes('DELETE FROM public.story_pilot_message_versions')){deletedVersions++;return []}
     if(q.includes('DELETE FROM public.story_pilot_messages')){deletedMessages++;return [{message_id:'5'}]}
     if(q.includes('INSERT INTO public.story_pilot_events')){inserted++;return []}
     throw Error('Unrecognized SQL fixture');
   }};
 const result=await neonArchiveOperation('mark_business_messages_deleted',input,sql);
 assert.equal(result.affected,1);
 assert.equal(result.retained,false);
 assert.equal(deletedVersions,1);
 assert.equal(deletedMessages,1);
 assert.equal(inserted,1);
});
