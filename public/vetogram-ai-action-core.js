// VETO AI Action: pure local recipient hinting, no MTProto access or model calls.
// Never silently resolve a model-supplied name to a Telegram recipient.
export function actionRecipientCandidates(dialogs,rawQuery,limit=8){
  const clean=value=>String(value??'').normalize('NFKC').toLocaleLowerCase()
    .replace(/[@\u200b-\u200d]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const hint=clean(rawQuery);
  if(hint.length<2)return [];
  const queryWords=hint.split(' ').filter(Boolean),matches=[];
  for(const chat of Array.isArray(dialogs)?dialogs:[]){
    if(!chat||!/^-?\d{1,22}$/.test(String(chat.id))||
       chat.serverCanSend===false||chat.archiveOnly||
       !['private','group','bot','saved'].includes(chat.type))continue;
    const title=clean(chat.title),username=clean(chat.username);
    if(!title&&!username)continue;
    let score=0;
    if(hint===title||hint===username)score=100;
    else if(title.startsWith(hint+' ')||username.startsWith(hint))score=80;
    else if(title.includes(hint)||username.includes(hint))score=65;
    else if(queryWords.every(word=>
      title.split(' ').some(t=>t===word||t.startsWith(word))||
      username.split(' ').some(t=>t===word||t.startsWith(word))))score=35;
    if(score>0)matches.push({id:String(chat.id),title:String(chat.title||'Telegram'),
      username:chat.username||null,score});
  }
  return matches.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title))
    .slice(0,Math.max(1,Math.min(8,Math.trunc(Number(limit)||8))));
}
export function actionDraftValid(action){
  return Boolean(action&&action.intent==='draft_message'&&
    typeof action.recipientQuery==='string'&&action.recipientQuery.trim()&&
    typeof action.message==='string'&&action.message.trim()&&action.message.length<=4096);
}

export function isExplicitActionCommand(value){
  const text=String(value??'').trim();
  if(/^\/(?:msg|message|написать)\s+\S[\s\S]{2,}$/iu.test(text))return true;
  const match=text.match(/^(?:напиши|отправь|сообщи)\s+(?:сообщение\s+)?([^\s,:]{2,45})[,:]?\s+(?:что|чтобы)(?:\s|$)/iu);
  if(!match)return false;
  // Do not turn requests for AI-written content or help into chat sending.
  return !new Set(['мне','текст','код','пост','рассказ','историю','эссе','ответ']).has(
    match[1].toLocaleLowerCase());
}
