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
const input={userId:'111',chatId:'222',messageIds:[5]};

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
  assert.match(src,/message_id=ANY\(\$3::bigint\[\]\) AND deleted_at IS NULL/);
  assert.match(src,/const newlyDeleted=before\.filter/);
});
