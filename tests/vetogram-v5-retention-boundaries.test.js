import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {neonArchiveOperation} from '../lib/neon-archive-store.js';

const source=readFileSync(new URL('../lib/neon-media-store.js',import.meta.url),'utf8')
 .replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,'');
const nowMs=Date.parse('2026-10-26T12:00:00Z');
const day=86400000;

function fixture(message={},settings={}){
 const signed=[],storage=[],sql=[];
 class FrozenDate extends Date {static now(){return nowMs}}
 class Command {constructor(value){this.input=value}}
 const context={Date:FrozenDate,process:{env:{AWS_ENDPOINT_URL_S3:'https://br-test.storage.eu.neon.tech',
   AWS_ACCESS_KEY_ID:'fixture-only',AWS_SECRET_ACCESS_KEY:'fixture-only'}},
  S3Client:class {async send(command){storage.push(command.input);return {}}},
  PutObjectCommand:Command,GetObjectCommand:Command,HeadObjectCommand:Command,
  DeleteObjectCommand:Command,HeadBucketCommand:Command,
  getSignedUrl:async(_client,command)=>{signed.push(command.input);return 'https://fixture.invalid/private'},
 };
 const api=vm.runInNewContext(source+';({neonMediaOperation,mediaWithinRetention})',context);
 const row={sent_at:new Date(nowMs-day).toISOString(),media_file_id:'private-file',
   media_type:'photo',media_file_size:10,business_connection_id:'test-business',
   media_archive_status:'pending',content_hash:'abcdef',...message};
 const db={owner:String,chat:String,
  async one(statement,args){
   sql.push({statement,args});
   if(statement.includes('story_pilot_privacy_settings'))return {anti_delete:true,ghost_inbox:true,retention_days:30,...settings};
   if(statement.includes('SELECT * FROM public.story_pilot_messages'))return row;
   if(statement.includes('COUNT(*)'))return {n:0};
   if(statement.includes('UPDATE public.story_pilot_messages'))return {};
   throw Error('Unexpected SQL');
  },
  async query(statement,args){sql.push({statement,args});return []},
 };
 return {row,signed,storage,sql,api,run:(op,extra={})=>api.neonMediaOperation(op,
  {userId:'123',chatId:'456',messageId:7,...extra},db)};
}

test('expired media cannot disclose Bot API references or sign a vault download before cleanup',async()=>{
 for(const extra of [{},{media_archive_status:'archived',media_storage_path:'123/456/7/a.jpg'}]){
  const f=fixture({sent_at:new Date(nowMs-31*day).toISOString(),...extra});
  assert.equal(await f.run('get_privacy_media_ref'),null);
  assert.equal(f.signed.length,0);
  assert.equal(f.storage.length,0);
 }
});

test('current media remains readable while malformed and exact-expiry boundaries fail closed',async()=>{
 const f=fixture({media_archive_status:'archived',media_storage_path:'123/456/7/a.jpg'});
 const result=await f.run('get_privacy_media_ref');
 assert.equal(result.vaultUrl,'https://fixture.invalid/private');
 assert.equal(result.fileId,'private-file');
 assert.equal(f.signed.length,1);
 assert.equal(f.api.mediaWithinRetention({sent_at:new Date(nowMs-30*day).toISOString()},{retentionDays:30},nowMs),true);
 for(const sent_at of [undefined,'invalid',new Date(nowMs-30*day-1).toISOString(),new Date(nowMs+120001).toISOString()]){
  assert.equal(f.api.mediaWithinRetention({sent_at},{retentionDays:30},nowMs),false);
 }
});

test('expired Business and history media cannot create uploads or become archived',async()=>{
 const f=fixture({sent_at:new Date(nowMs-31*day).toISOString(),business_connection_id:'user_session_backup'});
 for(const op of ['create_privacy_media_upload','create_history_media_upload','finalize_privacy_media_archive']){
  const result=await f.run(op,{archived:true,path:'123/456/7/a.jpg',fileSize:10});
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'expired_media');
 }
 assert.equal(f.signed.length,0);
 assert.equal(f.storage.length,0);
 assert.equal(f.sql.some(q=>q.statement.startsWith('UPDATE')),false);
});

test('media retry queue and count bind the same retention cutoff and authenticated owner',async()=>{
 const f=fixture();
 await f.run('list_recoverable_privacy_media',{limit:2});
 const queries=f.sql.filter(q=>q.statement.includes('FROM public.story_pilot_messages'));
 assert.equal(queries.length,2);
 for(const q of queries){
  assert.match(q.statement,/telegram_user_id=\$1::bigint/);
  assert.match(q.statement,/sent_at >= \$2::timestamptz/);
  assert.equal(q.args[0],'123');
  assert.equal(q.args[1],new Date(nowMs-30*day).toISOString());
 }
 assert.equal(queries[1].args[2],2);
});

test('edit-history reads require a retained parent with the same owner, chat and message',async()=>{
 let read;
 const result=await neonArchiveOperation('get_message_versions',
  {userId:'123',chatId:'456',messageId:7},{owner:String,chat:String,
   one:async()=>({edit_history:true,retention_days:30}),
   query:async(statement,args)=>{read={statement,args};return []},
  });
 assert.deepEqual(result.versions,[]);
 assert.match(read.statement,/EXISTS\(SELECT 1 FROM public.story_pilot_messages m/);
 assert.match(read.statement,/m\.telegram_user_id=v\.telegram_user_id AND m\.chat_id=v\.chat_id/);
 assert.match(read.statement,/m\.message_id=v\.message_id AND m\.sent_at >= \$4::timestamptz/);
 assert.deepEqual(read.args.slice(0,3),['123','456',7]);
 assert.ok(Math.abs(Date.parse(read.args[3])-(Date.now()-30*day))<1000);
});

test('invalid history timestamps are skipped without aborting an otherwise valid batch',async()=>{
 let inserts=0;
 const row={telegram_user_id:'123',chat_id:'456',business_connection_id:'user_session_backup',
  message_id:7,sent_at:'invalid',content_hash:'a'.repeat(64)};
 const result=await neonArchiveOperation('import_user_history_batch',{userId:'123',chatId:'456',rows:[row]},
  {owner:String,chat:String,one:async()=>({ghost_inbox:true,retention_days:30}),
   query:async()=>{inserts++;return []}});
 assert.equal(result.accepted,0);
 assert.equal(inserts,0);
});
