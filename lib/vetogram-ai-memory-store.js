import {neon} from '@neondatabase/serverless';
import {encryptAiMemory,decryptAiMemory} from './vetogram-ai-memory-crypto.js';
import {normalizeMemorySnapshot,normalizeMemoryRevision} from './vetogram-ai-memory-core.js';

const ownerId=value=>{
  const id=String(value??'');
  if(!/^\d{1,20}$/.test(id)||id==='0')throw Error('AI_MEMORY_INVALID_OWNER');
  return id;
};
function connection(){
  if(process.env.VETOGRAM_AI_MEMORY_ENABLED!=='true')throw Error('AI_MEMORY_DISABLED');
  const url=String(process.env.VETO_NEON_DATABASE_URL||'');
  if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('AI_MEMORY_DATABASE_UNAVAILABLE');
  return neon(url);
}
export async function readAiMemory(owner){
  const id=ownerId(owner),sql=connection();
  const rows=await sql.query(
    'SELECT encrypted_snapshot,revision,updated_at FROM public.vetogram_ai_memory_store WHERE owner_id=$1::bigint LIMIT 1',
    [id]);
  const row=rows[0];
  if(!row)return {revision:0,notes:[],updatedAt:null};
  const notes=normalizeMemorySnapshot(decryptAiMemory(id,row.encrypted_snapshot));
  return {revision:normalizeMemoryRevision(row.revision),notes,
    updatedAt:row.updated_at??null};
}
export async function saveAiMemory(owner,expectedRevision,userNotes){
  const id=ownerId(owner),revision=normalizeMemoryRevision(expectedRevision),
    notes=normalizeMemorySnapshot(userNotes),snapshot=encryptAiMemory(id,notes);
  const sql=connection();
  let rows=[];
  if(revision===0){
    rows=await sql.query(
      `INSERT INTO public.vetogram_ai_memory_store(owner_id,encrypted_snapshot,revision,updated_at)
        VALUES($1::bigint,$2,1,now()) ON CONFLICT(owner_id) DO NOTHING
        RETURNING revision,updated_at`,[id,snapshot]);
  }else{
    rows=await sql.query(
      `UPDATE public.vetogram_ai_memory_store
          SET encrypted_snapshot=$2,revision=revision+1,updated_at=now()
        WHERE owner_id=$1::bigint AND revision=$3::integer
        RETURNING revision,updated_at`,[id,snapshot,revision]);
  }
  if(rows.length!==1)throw Error('AI_MEMORY_VERSION_CONFLICT');
  return {revision:normalizeMemoryRevision(rows[0].revision),notes,
    updatedAt:rows[0].updated_at??null};
}

// Real deletion, not a replacement with an empty encrypted snapshot.
// The revision guard prevents stale tabs from deleting newer notes.
export async function eraseAiMemory(owner,expectedRevision){
  const id=ownerId(owner),revision=normalizeMemoryRevision(expectedRevision);
  if(revision===0)throw Error('AI_MEMORY_VERSION_CONFLICT');
  const rows=await connection().query(
    'DELETE FROM public.vetogram_ai_memory_store WHERE owner_id=$1::bigint AND revision=$2::integer RETURNING owner_id',
    [id,revision]);
  if(rows.length!==1)throw Error('AI_MEMORY_VERSION_CONFLICT');
  return {deleted:true,revision:0,notes:[],updatedAt:null};
}
