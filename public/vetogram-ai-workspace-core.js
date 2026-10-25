// VETOGRAM AI workspace is intentionally session-only. No persistence,
// auto-reads or autonomous sends. Used by the Mini App and Node tests.
const text=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
export const APPROVAL_TTL_MS=30*60*1000;
export const MAX_PENDING_APPROVALS=12;
export const MAX_MEMORY_NOTES=8;
const ownerId=value=>{const id=String(value||'');if(!/^\d{1,20}$/.test(id)||id==='0')throw Error('WORKSPACE_OWNER_INVALID');return id;};
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
export function makeApproval({owner,chatId,chatTitle,message,nonce,id,now=Date.now()}){
  const account=ownerId(owner),recipient=String(chatId||''),body=text(message,4096);
  if(!/^-?\d{1,22}$/.test(recipient)||!body||!validId(id)||!validId(nonce))
    throw Error('APPROVAL_INVALID');
  if(!Number.isFinite(now)||now<=0)throw Error('APPROVAL_INVALID_TIME');
  return {id,owner:account,chatId:recipient,chatTitle:text(chatTitle,90)||'Telegram',
    message:body,nonce,createdAt:now,expiresAt:now+APPROVAL_TTL_MS};
}
export function activeApprovals(entries,owner,now=Date.now()){
  const account=ownerId(owner);
  return (Array.isArray(entries)?entries:[]).filter(row=>
    row?.owner===account&&validId(row.id)&&validId(row.nonce)&&
    /^-?\d{1,22}$/.test(row.chatId||'')&&
    Number.isFinite(row.expiresAt)&&row.expiresAt>now&&row.expiresAt-now<=APPROVAL_TTL_MS
  ).slice(-MAX_PENDING_APPROVALS);
}
export function queueApproval(entries,newItem,now=Date.now()){
  const current=activeApprovals(entries,newItem.owner,now);
  if(current.some(x=>x.id===newItem.id))throw Error('APPROVAL_DUPLICATE');
  return [...current,newItem].slice(-MAX_PENDING_APPROVALS);
}
export function makeMemoryNote({owner,id,label,content,now=Date.now()}){
  const account=ownerId(owner);
  if(!validId(id)||!Number.isFinite(now)||now<=0)throw Error('MEMORY_INVALID');
  const title=text(label,55),body=text(content,450);
  if(!title||!body)throw Error('MEMORY_EMPTY');
  return {id,owner:account,label:title,content:body,createdAt:now};
}
export function activeMemoryNotes(notes,owner){
  const account=ownerId(owner);
  return (Array.isArray(notes)?notes:[]).filter(note=>
    note?.owner===account&&validId(note.id)&&
    typeof note.label==='string'&&typeof note.content==='string'
  ).slice(-MAX_MEMORY_NOTES);
}
export function buildMemoryContext(notes,selectedIds,owner){
  const approved=new Set(Array.isArray(selectedIds)?selectedIds:[]);
  return activeMemoryNotes(notes,owner)
    .filter(note=>approved.has(note.id))
    .slice(0,3)
    .map(note=>text(note.label,55)+': '+text(note.content,450));
}
