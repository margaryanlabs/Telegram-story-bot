import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_TASKS,makeOwnerTask,ownerTasks,addOwnerTask,updateOwnerTask,taskOverview}
  from '../public/vetogram-task-center-core.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const task=(n,owner='123',props={})=>makeOwnerTask({
  owner,id:uuid(n),title:'Подтвердить встречу '+n,kind:'meeting',
  sourceQuote:'Подтверди встречу в пятницу',deadlineText:'в пятницу',
  certainty:'explicit',createdAt:1000+n,...props
});
test('Task Center creates only owner-tagged, valid source-backed candidates',()=>{
  const a=task(1);
  assert.equal(a.owner,'123');assert.equal(a.status,'open');assert.equal(a.dueAt,null);
  assert.equal(a.deadlineText,'в пятницу');
  assert.throws(()=>task(1,'0'),/TASK_INVALID/);
  assert.throws(()=>task(1,'123',{sourceQuote:'short'}),/TASK_INVALID/);
  assert.throws(()=>task(1,'123',{kind:'delete_messages'}),/TASK_INVALID/);
  assert.throws(()=>task(1,'123',{dueAt:'tomorrow'}),/TASK_DATE_INVALID/);
});
test('Task Center is session owner-only and duplicates cannot multiply tasks',()=>{
  const items=[task(1,'123'),task(2,'999')];
  assert.deepEqual(ownerTasks(items,'123').map(x=>x.id),[uuid(1)]);
  assert.equal(ownerTasks(items,'999').length,1);
  assert.deepEqual(ownerTasks(items,'0'),[]);
  assert.throws(()=>addOwnerTask(items,task(3,'999'),'123'),/TASK_OWNER_MISMATCH/);
  assert.throws(()=>addOwnerTask([task(1)],task(1),'123'),/TASK_DUPLICATE/);
  assert.throws(()=>addOwnerTask([task(1)],task(5,'123',{
    title:'Подтвердить встречу 1',sourceQuote:'Подтверди встречу в пятницу'
  }),'123'),/TASK_DUPLICATE/);
});
test('Only editable task fields are status and manually confirmed ISO due date',()=>{
  const initial=[task(1,'123')];
  const date='2026-11-04T14:00:00.000Z';
  let items=updateOwnerTask(initial,'123',uuid(1),{status:'deferred',dueAt:date});
  assert.equal(items[0].status,'deferred');assert.equal(items[0].dueAt,date);
  items=updateOwnerTask(items,'123',uuid(1),{status:'done'});
  assert.equal(items[0].status,'done');
  items=updateOwnerTask(items,'123',uuid(1),{status:'open',dueAt:null});
  assert.equal(items[0].dueAt,null);
  assert.throws(()=>updateOwnerTask(items,'999',uuid(1),{status:'done'}),/TASK_NOT_FOUND/);
  assert.throws(()=>updateOwnerTask(items,'123',uuid(1),{title:'Hacked'}),/TASK_UPDATE_INVALID/);
  assert.throws(()=>updateOwnerTask(items,'123',uuid(1),{status:'sent'}),/TASK_INVALID/);
});
test('Capacity and status overview are bounded and honest about manual dates',()=>{
  let items=[];
  for(let n=1;n<=MAX_TASKS;n++)items=addOwnerTask(items,task(n),'123');
  assert.equal(items.length,24);
  assert.throws(()=>addOwnerTask(items,task(50),'123'),/TASK_LIMIT/);
  items=updateOwnerTask(items,'123',uuid(1),{dueAt:'2026-10-21T08:00:00.000Z'});
  items=updateOwnerTask(items,'123',uuid(2),{status:'done'});
  items=updateOwnerTask(items,'123',uuid(3),{status:'deferred'});
  const summary=taskOverview(items,'123',Date.parse('2026-10-23T00:00:00.000Z'));
  assert.equal(summary.total,24);
  assert.equal(summary.done,1);assert.equal(summary.deferred,1);
  assert.equal(summary.open,22);assert.equal(summary.overdue,1);
  assert.equal(summary.tasks[0].id,uuid(1));
});
test('UI keeps task saves local and gates Telegram reminders behind explicit consent',()=>{
  const ui=read('public/vetogram-ai.js'),html=read('public/studio.html');
  for(const id of ['vtaiTasksPanel','vtaiTaskCount','vtaiTasksOpen','vtaiTasksDeferred',
    'vtaiTasksDone','vtaiTasksAll','vtaiTasksList','vtaiTasksCopy','vtaiTasksClear'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(ui,/state\.tasks=\[\];state\.taskFilter='open'/);
  assert.match(ui,/state\.tasks=addOwnerTask\(state\.tasks,task,owner\(\)\)/);
  assert.match(ui,/makeOwnerTask\(\{owner:owner\(\)/);
  assert.match(ui,/date\.type='datetime-local'/);
  assert.match(ui,/state\.suggestedChatId=null; \/\/ A task does not verify any recipient/);
  assert.match(ui,/vtaiConsent'\)\.checked=false/);
  assert.match(ui,/Подготовить follow-up/);
  // Reminders are now an explicit opt-in feature; they must never be
  // scheduled by saving or editing a task.
  assert.match(ui,/Дата задачи записана только в память окна\. Напоминание не создавалось/);
  assert.match(ui,/state\.reminderSchedulingConfigured!==true/);
  assert.match(ui,/window\.confirm\('Создать одноразовое Telegram-напоминание лично тебе/);
  assert.match(ui,/request\('\/api\/vetogram-reminders',\{action:'schedule'/);
  assert.match(ui,/schedule\.addEventListener\('click',\(\)=>void scheduleReminder\(task,Number\(lead\.value\)\)\)/);
  assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB|setInterval|autoSend/);
});
