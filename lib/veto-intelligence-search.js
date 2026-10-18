// Query planning and evidence formatting ONLY. This is keyless lexical/concept
// retrieval, not a neural embedding model or an LLM-generated answer.
const generic=new Set([
  'найди','найти','где','когда','кто','что','какие','какой','какая','было','были','был',
  'обсуждали','обсуждаем','говорили','говорил','сказал','скажите','покажи','все',
  'сообщения','сообщение','переписку','переписке','чат','чатах','переписках','наш',
  'мне','мы','нас','этого','того','про','для','это','эти','как','могу','пожалуйста',
  'последние','последний','месяца','месяцев','трех','три','двух','два','один',
  'show','find','where','when','what','the','we','about','our','messages','please','me'
]);
const concepts=[
  {match:/дуба[йяею]|dubai/i,terms:['Дубай','Dubai']},
  {match:/квартир|недвижим|апартамен|apartment|property/i,terms:['квартира','недвижимость','apartment']},
  {match:/обеща|обязат|договор|promis|commitment/i,terms:['обещал','обещание','договорились']},
  {match:/встреч|созвон|звон|meeting|call/i,terms:['встреча','созвон','meeting']},
  {match:/деньг|оплат|перевод|платеж|payment|transfer/i,terms:['оплата','перевод','payment']},
  {match:/срок|дедлайн|deadline|due date/i,terms:['срок','дедлайн','deadline']},
  {match:/адрес|локаци|address|location/i,terms:['адрес','location']},
];
export function cleanSearchQuery(value){
  if(typeof value!=='string')throw Object.assign(new Error('Введи текст запроса'),{status:400});
  const valueClean=value.trim().replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ');
  if(valueClean.length<3||valueClean.length>180)
    throw Object.assign(new Error('Запрос должен содержать от 3 до 180 символов'),{status:400});
  return valueClean;
}
export function planSearch(value){
  const q=cleanSearchQuery(value);
  const words=(q.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu)||[])
    .filter(x=>x.length>=3&&!generic.has(x.toLocaleLowerCase()));
  const variants=[];
  const add=t=>{
    const v=String(t||'').trim();
    if(v.length>2&&!variants.some(x=>x.toLocaleLowerCase()===v.toLocaleLowerCase()))
      variants.push(v);
  };
  // Prefer different concepts over duplicates from the same topic. For
  // "квартира в Дубае", search "Дубае" AND "квартира", not "Дубае"/"Дубай".
  const matched=concepts.filter(concept=>concept.match.test(q));
  for(const concept of matched){
    const present=words.find(word=>concept.match.test(word));
    add(present||concept.terms[0]);
  }
  const others=words.filter(word=>!matched.some(concept=>concept.match.test(word)));
  others.sort((a,b)=>b.length-a.length).forEach(add);
  for(const concept of matched)concept.terms.forEach(add);
  const bounded=variants.slice(0,2);
  if(!bounded.length)add(q.slice(0,80));
  // Explicit relative time spans; used only when the user says them.
  const monthMatch=q.match(/(?:за\s+)?последн[а-яё]*\s+(\d{1,2}|один|два|три|четыре|пять|шесть)\s+месяц/i);
  const numerals={один:1,два:2,три:3,четыре:4,пять:5,шесть:6};
  const months=monthMatch?(numerals[monthMatch[1]?.toLowerCase()]||Number(monthMatch[1])):0;
  return {query:q,terms:(bounded.length?bounded:variants.slice(0,1)),months:
    Number.isInteger(months)&&months>0&&months<=12?months:0,mode:'lexical-concept'};
}
const id=v=>String(v?.toString?.()||v||'');
export function peerChatId(peer){
  if(peer?.channelId)return '-100'+id(peer.channelId);
  if(peer?.chatId)return '-'+id(peer.chatId);
  if(peer?.userId)return id(peer.userId);
  return '';
}
export function searchResultsFromTelegram(response,term=''){
  const users=new Map((response?.users||[]).map(x=>[id(x.id),x]));
  const chats=new Map((response?.chats||[]).map(x=>[id(x.id),x]));
  const results=[];
  for(const msg of response?.messages||[]){
    const chatId=peerChatId(msg.peerId),messageId=Number(msg.id);
    if(!chatId||!Number.isSafeInteger(messageId)||messageId<1||msg.className&&msg.className!=='Message')
      continue;
    const isUser=Boolean(msg.peerId?.userId);
    const peer=isUser?users.get(id(msg.peerId.userId)):
      chats.get(id(msg.peerId.channelId||msg.peerId.chatId));
    const text=String(msg.message||msg.text||'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,700);
    if(!text)continue;
    const name=isUser?[peer?.firstName,peer?.lastName].filter(Boolean).join(' '):
      peer?.title||'';
    const fromUser=msg.fromId?.userId?users.get(id(msg.fromId.userId)):null;
    const fromName=fromUser?[fromUser.firstName,fromUser.lastName].filter(Boolean).join(' '):'';
    const sender=msg.out?'Вы':
      isUser?String(name||peer?.username||'Собеседник'):
      String(fromName||fromUser?.username||'Автор не определён');
    const date=Number(msg.date||0);
    results.push({chatId,messageId,chatTitle:String(name||peer?.username||'Telegram чат').slice(0,90),
      snippet:text,term:String(term||'').slice(0,50),sender:sender.slice(0,90),
      date:date>0&&date<5000000000?new Date(date*1000).toISOString():null,
      out:Boolean(msg.out),kind:isUser?'private':msg.peerId?.channelId?'channel':'group'});
  }
  return results;
}
export function mergeSearchResults(sets,plan,max=30){
  const all=new Map();
  for(const group of sets||[])for(const item of group||[]){
    const key=item.chatId+'/'+item.messageId;
    if(!all.has(key))all.set(key,item);
  }
  // Rank evidence, never generate a purported quote or invent message content.
  const words=(plan.query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[])
    .filter(w=>w.length>3&&!generic.has(w));
  return [...all.values()].map(x=>{
    const hay=(x.snippet+' '+x.chatTitle).toLocaleLowerCase();
    const score=words.reduce((total,w)=>total+(hay.includes(w.slice(0,Math.min(w.length,5)))?2:0),0)+
      (hay.includes(x.term.toLocaleLowerCase())?3:0);
    return {...x,score};
  }).sort((a,b)=>b.score-a.score||(Date.parse(b.date||'')||0)-(Date.parse(a.date||'')||0))
    .slice(0,Math.max(1,Math.min(30,max)));
}
