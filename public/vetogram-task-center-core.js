// VETO Task Center: explicit owner-approved session-only task workspace.
// No timers, storage, background reminders, Telegram sends or network access.
export const MAX_TASKS=24;
export const TASK_STATUSES=Object.freeze(['open','done','deferred']);
const allowedKinds=new Set(['task','followup','meeting','payment']);
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ownerId=x=>/^\d{1,20}$/.test(String(x||''))&&String(x)!=='0';
const trim=(v,max)=>String(v??'').trim().slice(0,max);
export function makeOwnerTask({owner,id,title,kind,sourceQuote,deadlineText=null,
    certainty='unclear',createdAt=Date.now(),status='open',dueAt=null}={}){
  const o=String(owner||''),t=trim(title,131),quote=trim(sourceQuote,181),
    rawDue=deadlineText===null?null:trim(deadlineText,81),
    ts=Number(createdAt);
  if(!ownerId(o)||!uuid.test(String(id||''))||
      t.length<3||t.length>130||t!==String(title??'').trim()||
      !allowedKinds.has(kind)||quote.length<8||quote.length>180||
      quote!==String(sourceQuote??'').trim()||
      !['explicit','unclear'].includes(certainty)||
      (rawDue!==null&&(!rawDue||rawDue.length>80||rawDue!==String(deadlineText).trim()))||
      !TASK_STATUSES.includes(status)||!Number.isSafeInteger(ts)||ts<1)
    throw Error('TASK_INVALID');
  let due=null;
  if(dueAt!==null){
    if(typeof dueAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dueAt)||
      !Number.isFinite(Date.parse(dueAt))||new Date(dueAt).toISOString()!==dueAt)
      throw Error('TASK_DATE_INVALID');
    due=dueAt;
  }
  return {owner:o,id:String(id),title:t,kind,sourceQuote:quote,deadlineText:rawDue,
    certainty,createdAt:ts,status,dueAt:due};
}
export function ownerTasks(items,owner){
  const o=String(owner||'');
  if(!ownerId(o))return [];
  const unique=new Set(),result=[];
  for(const item of Array.isArray(items)?items:[]){
    if(item?.owner!==o||result.length>=MAX_TASKS)continue;
    let task;try{task=makeOwnerTask(item)}catch{continue}
    if(unique.has(task.id))continue;
    unique.add(task.id);result.push(task);
  }
  return result;
}
export function addOwnerTask(items,newTask,owner){
  const active=ownerTasks(items,owner),candidate=makeOwnerTask(newTask);
  if(candidate.owner!==String(owner))throw Error('TASK_OWNER_MISMATCH');
  if(active.length>=MAX_TASKS)throw Error('TASK_LIMIT');
  if(active.some(t=>t.id===candidate.id||
      (t.title.toLocaleLowerCase()===candidate.title.toLocaleLowerCase()&&
        t.sourceQuote.toLocaleLowerCase()===candidate.sourceQuote.toLocaleLowerCase())))
    throw Error('TASK_DUPLICATE');
  return [...active,candidate];
}
export function updateOwnerTask(items,owner,id,changes){
  const o=String(owner),match=ownerTasks(items,o),target=match.find(t=>t.id===String(id));
  if(!target)throw Error('TASK_NOT_FOUND');
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||
    Object.keys(changes).some(key=>!['status','dueAt'].includes(key)))
    throw Error('TASK_UPDATE_INVALID');
  const next=makeOwnerTask({...target,...changes});
  return match.map(t=>t.id===next.id?next:t);
}
export function taskOverview(items,owner,now=Date.now()){
  const tasks=ownerTasks(items,owner),clock=Number(now)||Date.now();
  const open=tasks.filter(t=>t.status==='open');
  const overdue=open.filter(t=>t.dueAt!==null&&Date.parse(t.dueAt)<clock);
  return {total:tasks.length,open:open.length,done:tasks.filter(t=>t.status==='done').length,
    deferred:tasks.filter(t=>t.status==='deferred').length,overdue:overdue.length,
    tasks:[...tasks].sort((a,b)=>{
      const rank=x=>x.status==='open'?0:x.status==='deferred'?1:2;
      return rank(a)-rank(b)||
        (a.dueAt===null?Infinity:Date.parse(a.dueAt))-
        (b.dueAt===null?Infinity:Date.parse(b.dueAt))||
        a.createdAt-b.createdAt;
    })};
}
