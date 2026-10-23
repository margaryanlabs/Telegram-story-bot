// Pure validation shared by memory API and tests. No Telegram chat access.
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
export function normalizeMemorySnapshot(input){
  if(!Array.isArray(input)||input.length>8)throw Error('AI_MEMORY_COUNT_INVALID');
  const seen=new Set();
  return input.map(entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('AI_MEMORY_ITEM_INVALID');
    const id=String(entry.id||''),label=clean(entry.label,55),content=clean(entry.content,450);
    const date=Number(entry.createdAt);
    if(!/^[a-f0-9]{8}-[a-f0-9-]{27,28}$/i.test(id)||!label||!content||seen.has(id)||
      !Number.isSafeInteger(date)||date<1)throw Error('AI_MEMORY_ITEM_INVALID');
    // Reject silent truncation (important when memory goes to a model).
    if(label!==String(entry.label).trim()||content!==String(entry.content).trim())
      throw Error('AI_MEMORY_ITEM_TOO_LONG');
    seen.add(id);
    return {id,label,content,createdAt:date};
  });
}
export function normalizeMemoryRevision(value){
  if(!Number.isSafeInteger(value)||value<0||value>2147483646)throw Error('AI_MEMORY_REVISION_INVALID');
  return value;
}
