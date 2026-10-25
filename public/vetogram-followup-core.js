// VETOGRAM Follow-up Focus. Only bounded, owner-verified dialog previews
// already fetched into this WebView are considered. No background polling,
// message bodies, contacts, provider requests, Telegram read flags or sends.
export const FOLLOWUP_FOCUS_LIMIT=8;
const eligibleTypes=new Set(['private','group']);

export function followupCandidates(dialogs,{hiddenIds=[],limit=FOLLOWUP_FOCUS_LIMIT}={}){
  const excluded=new Set(Array.isArray(hiddenIds)?hiddenIds.map(String):[]);
  const byId=new Map();
  for(const chat of Array.isArray(dialogs)?dialogs:[]){
    const id=String(chat?.id||'');
    // Unknown/outgoing/archive previews are never treated as inbound evidence.
    if(!/^-?\d{1,22}$/.test(id)||id==='0'||excluded.has(id)||
      !eligibleTypes.has(chat?.type)||chat.archiveOnly||
      chat.previewFromArchive===true||chat.serverCanSend===false||
      chat.lastMessageOut!==false||chat.inbox?.needsAttention!==true)continue;
    const unread=Number(chat.unreadCount);
    if(!Number.isSafeInteger(unread)||unread<1)continue;
    const preview=String(chat.preview||'').trim().slice(0,180);
    const title=String(chat.title||'').trim().slice(0,100);
    if(preview.length<3||!title)continue;
    const flags={
      question:chat.inbox?.question===true,
      action:chat.inbox?.action===true
    };
    if(!flags.question&&!flags.action)continue;
    const score=Math.max(0,Math.min(100,Number(chat.inbox?.score)||0));
    const at=Date.parse(String(chat.date||'')),timestamp=Number.isFinite(at)?at:0;
    const next={id,title,preview,unread:Math.min(9999,unread),flags,score,timestamp,
      reason:flags.question&&flags.action?'Возможны вопрос и действие':
        flags.action?'Возможен срок или действие':'Возможен вопрос'};
    const earlier=byId.get(id);
    if(!earlier||next.timestamp>earlier.timestamp)byId.set(id,next);
  }
  return [...byId.values()].sort((a,b)=>
    b.score-a.score||b.timestamp-a.timestamp||a.id.localeCompare(b.id))
    .slice(0,Math.max(0,Math.min(FOLLOWUP_FOCUS_LIMIT,Math.trunc(Number(limit)||FOLLOWUP_FOCUS_LIMIT))));
}
