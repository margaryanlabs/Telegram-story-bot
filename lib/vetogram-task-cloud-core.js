import {makeOwnerTask,MAX_TASKS} from '../public/vetogram-task-center-core.js';

const validOwner=v=>/^\d{1,20}$/.test(String(v))&&String(v)!=='0';
export function taskCloudRevision(value){
  if(!Number.isSafeInteger(value)||value<0||value>2147483646)
    throw Error('TASK_CLOUD_REVISION_INVALID');
  return value;
}
export function taskCloudSnapshot(owner,input){
  if(!validOwner(owner))throw Error('TASK_CLOUD_OWNER_INVALID');
  if(!Array.isArray(input)||input.length>MAX_TASKS)throw Error('TASK_CLOUD_COUNT_INVALID');
  const ids=new Set(),matches=new Set(),items=[];
  for(const row of input){
    if(!row||typeof row!=='object'||Array.isArray(row)||
       typeof row.title!=='string'||typeof row.sourceQuote!=='string'||
       typeof row.id!=='string'||typeof row.kind!=='string'||
       typeof row.createdAt!=='number'||typeof row.status!=='string'||
       (row.deadlineText!==null&&typeof row.deadlineText!=='string')||
       !['explicit','unclear'].includes(row.certainty))
      throw Error('TASK_CLOUD_ITEM_INVALID');
    // Owner is supplied only by validated Telegram initData, never by browser.
    let task;
    try{
      task=makeOwnerTask({...row,owner:String(owner)});
    }catch{throw Error('TASK_CLOUD_ITEM_INVALID')}
    const signature=task.title.toLocaleLowerCase()+'\x00'+task.sourceQuote.toLocaleLowerCase();
    if(ids.has(task.id)||matches.has(signature))throw Error('TASK_CLOUD_DUPLICATE');
    ids.add(task.id);matches.add(signature);
    const {owner:unused,...payload}=task;
    items.push(payload);
  }
  if(Buffer.byteLength(JSON.stringify(items),'utf8')>32000)throw Error('TASK_CLOUD_TOO_LARGE');
  return items;
}
