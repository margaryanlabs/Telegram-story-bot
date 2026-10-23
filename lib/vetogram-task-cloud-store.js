import {neon} from '@neondatabase/serverless';
import {taskCloudSnapshot,taskCloudRevision} from './vetogram-task-cloud-core.js';
import {encryptTaskCloud,decryptTaskCloud} from './vetogram-task-cloud-crypto.js';

function database(){
  if(process.env.VETOGRAM_TASKS_CLOUD_ENABLED!=='true')throw Error('TASK_CLOUD_DISABLED');
  const url=String(process.env.VETO_NEON_DATABASE_URL||'');
  if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('TASK_CLOUD_DATABASE_UNAVAILABLE');
  return neon(url);
}
export async function loadTaskCloud(owner){
  const sql=database(),id=String(owner);
  const rows=await sql.query(
    'SELECT encrypted_snapshot,revision,updated_at FROM public.vetogram_task_cloud WHERE owner_id=$1::bigint LIMIT 1',
    [id]);
  const row=rows[0];
  if(!row)return {revision:0,tasks:[],updatedAt:null};
  const tasks=row.encrypted_snapshot===null?[]:
    taskCloudSnapshot(id,decryptTaskCloud(id,row.encrypted_snapshot));
  return {revision:taskCloudRevision(row.revision),tasks,updatedAt:row.updated_at??null};
}
export async function saveTaskCloud(owner,expectedRevision,input){
  const id=String(owner),rev=taskCloudRevision(expectedRevision);
  const payload=taskCloudSnapshot(id,input);
  const encrypted=encryptTaskCloud(id,payload),sql=database();
  const rows=await sql.query(
    'SELECT * FROM public.vetogram_task_cloud_write($1::bigint,$2::integer,$3::text,$4::boolean)',
    [id,rev,encrypted,false]);
  if(rows.length!==1)throw Error('TASK_CLOUD_VERSION_CONFLICT');
  return {revision:taskCloudRevision(rows[0].next_revision),tasks:payload,
    updatedAt:rows[0].next_updated_at??null};
}
export async function eraseTaskCloud(owner,expectedRevision){
  const id=String(owner),rev=taskCloudRevision(expectedRevision);
  if(rev===0)throw Error('TASK_CLOUD_VERSION_CONFLICT');
  // Keep only revision tombstone to prevent stale device resurrection.
  const rows=await database().query(
    'SELECT * FROM public.vetogram_task_cloud_write($1::bigint,$2::integer,$3::text,$4::boolean)',
    [id,rev,null,true]);
  if(rows.length!==1)throw Error('TASK_CLOUD_VERSION_CONFLICT');
  return {deleted:true,revision:taskCloudRevision(rows[0].next_revision)};
}
