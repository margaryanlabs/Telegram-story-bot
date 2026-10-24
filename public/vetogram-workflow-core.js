/* VETOGRAM 3.0 · explicit, local workflow entry points.
 * Navigation only: no automatic AI, Telegram data access, publishing or consent.
 */
const FLOWS=Object.freeze({
  reply:Object.freeze({screen:'ai',mode:'reply',label:'AI-ответ'}),
  campaign:Object.freeze({screen:'ai',mode:'campaign',label:'Story-to-Sale'}),
  privacy:Object.freeze({screen:'privacy',mode:null,label:'Anti-Delete'}),
  voice:Object.freeze({screen:'voice',mode:null,label:'Voice Studio'})
});
export function vetogramWorkflow(id){
  return Object.hasOwn(FLOWS,String(id||''))?FLOWS[id]:null;
}
export function vetogramWorkflowResult(flow,navigated,modeReady=true){
  if(!flow||navigated!==true)return {ok:false,reason:'screen_unavailable'};
  if(flow.mode&&modeReady!==true)return {ok:false,reason:'mode_unavailable'};
  return {ok:true,reason:'opened_only'};
}
