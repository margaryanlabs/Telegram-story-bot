// Evidence retrieval and chronology for the owner-approved VETO Vault.
// No AI API, vectors, persistent index or speculative commitments.
const PROMISE_QUERY=/обещ|договор|верн|долг|оплат|перевест|перевод|срок|обязательств|promis|repay|owe|deadline/i;
const PROMISE_CUE=/обещ|договорил|обязуюсь|верну|вернём|вернем|возвращ|переведу|оплачу|отдам|выплачу|до\s+\d{1,2}[.\/\s]|by\s+(?:monday|tuesday|friday)|i\s+will\s+(?:pay|send|return)|promise/i;
const STOP=new Set(['обещание','обещания','последние','последний','месяца','месяцев','деньги','деньгами','найди','найти','переписка','переписке','когда','кто','какие','мне','что','наш','наша','если','были','говорил','все','messages','find']);
const digits=v=>/^[-]?\d{1,22}$/.test(String(v||''));
const lower=value=>String(value||'').toLocaleLowerCase('ru');
const dateNum=value=>{const num=Date.parse(String(value||''));return Number.isFinite(num)?num:0};
function termsFor(plan){
  const tokens=(String(plan?.query||'').match(/[\p{L}\p{N}]+/gu)||[])
    .filter(x=>x.length>=4&&!STOP.has(lower(x)));
  const variants=[...(plan?.terms||[]),...tokens];
  return [...new Set(variants.map(t=>lower(t).slice(0,5)).filter(t=>t.length>=3))].slice(0,12);
}
export function isCommitmentQuestion(query=''){
  return PROMISE_QUERY.test(String(query||''));
}
export function possibleCommitment(snippet=''){
  return PROMISE_CUE.test(String(snippet||''));
}
export function archiveEvidenceScore(snippet='',title='',plan={}){
  const hay=lower(String(snippet||'')+' '+String(title||''));
  const terms=termsFor(plan);
  const hits=terms.filter(t=>hay.includes(t)).length;
  const commitment=isCommitmentQuestion(plan.query)&&possibleCommitment(snippet);
  // A cue can find "верну завтра" when user searches for "обещания".
  return hits*3+(commitment?4:0);
}
export function normalizeOwnerArchive(row,thread,plan={},afterMs=0){
  const messageId=Number(row?.message_id);
  const chatId=String(thread?.chatId||'');
  if(!digits(chatId)||!Number.isSafeInteger(messageId)||messageId<1)return null;
  const snippet=String(row?.text_content||row?.caption||'').trim().slice(0,700);
  if(!snippet)return null;
  const date=row?.sent_at||row?.created_at||null;
  const timestamp=dateNum(date);
  if(afterMs&&(!timestamp||timestamp<afterMs))return null;
  const chatTitle=String(thread?.title||'Сохранённый чат').slice(0,90);
  const score=archiveEvidenceScore(snippet,chatTitle,plan);
  if(score<3)return null;
  const out=row?.direction==='outgoing';
  return {
    chatId,messageId,chatTitle,
    snippet,date:timestamp?new Date(timestamp).toISOString():null,
    out,kind:'copy',source:'veto-vault',saved:true,deleted:Boolean(row?.deleted_at),
    sender:out?'Вы':String(row?.sender_display_name||chatTitle).slice(0,90),
    score,possibleCommitment:possibleCommitment(snippet),
  };
}
export function prioritizeArchiveThreads(rows=[],max=6){
  return (Array.isArray(rows)?rows:[])
    .filter(row=>digits(row?.chatId)&&Number(row?.messageCount||0)>0)
    .sort((a,b)=>dateNum(b.lastAt)-dateNum(a.lastAt))
    .slice(0,Math.max(1,Math.min(6,max)));
}
export function mergeEvidence(cloud=[],vault=[],plan={},max=30){
  const all=new Map();
  for(const item of [...cloud,...vault]){
    if(!item?.chatId||!Number.isSafeInteger(Number(item.messageId))||!item.snippet)continue;
    const key=String(item.chatId)+'/'+String(item.messageId);
    const previous=all.get(key);
    if(!previous){
      all.set(key,{...item,source:item.source||'telegram-cloud',
        possibleCommitment:item.possibleCommitment===true||possibleCommitment(item.snippet)});
    }else if(item.source==='veto-vault'){
      // Retain the actual original Telegram quote, add only confirmed Vault
      // deletion/saved evidence from the owner's existing snapshot.
      all.set(key,{...previous,saved:true,deleted:Boolean(item.deleted),
        vaultAvailable:true,source:'telegram-cloud+veto-vault',
        sender:previous.sender||item.sender,
        possibleCommitment:previous.possibleCommitment||item.possibleCommitment});
    }
  }
  return [...all.values()].sort((a,b)=>
    (Number(b.score||0)-Number(a.score||0))||
    dateNum(b.date)-dateNum(a.date))
    .slice(0,Math.max(1,Math.min(30,max)));
}
export function evidenceTimeline(items=[],plan={},max=18){
  if(!isCommitmentQuestion(plan.query))return [];
  return (Array.isArray(items)?items:[])
    .filter(item=>item?.possibleCommitment===true&&item?.date)
    .sort((a,b)=>dateNum(a.date)-dateNum(b.date))
    .slice(0,Math.max(1,Math.min(18,max)))
    .map(item=>({
      chatId:item.chatId,messageId:item.messageId,chatTitle:item.chatTitle,
      date:item.date,snippet:item.snippet,source:item.source,
      deleted:Boolean(item.deleted),sender:item.sender|| (item.out?'Вы':item.chatTitle),
      label:'Возможное обещание · проверь контекст',
    }));
}
