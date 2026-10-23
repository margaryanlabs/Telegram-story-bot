// VETOGRAM Negotiator Lab: ephemeral policy + deterministic safety evaluation.
// NO autonomous actions, message reads, background workers or permission grants.
const clean=(x,n)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
export const NEGOTIATOR_CURRENCIES=Object.freeze(['USD','EUR','AMD','RUB','GEL','GBP']);
export const NEGOTIATOR_MAX_MINUTES=120;
const cents=value=>{
  const input=String(value??'').trim();
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(input))throw Error('NEGOTIATOR_PRICE_INVALID');
  const [integer,decimals='']=input.split('.');
  const result=Number(integer)*100+Number(decimals.padEnd(2,'0'));
  if(!Number.isSafeInteger(result)||result<=0||result>1000000000)throw Error('NEGOTIATOR_PRICE_INVALID');
  return result;
};
export function makeNegotiationPolicy({owner,chatId,currency,minPrice,askingPrice,maxDiscountPct,minutes=60,now=Date.now()}={}){
  const id=String(owner??''),chat=String(chatId??''),cur=String(currency??'');
  const floor=cents(minPrice),asking=cents(askingPrice),discount=Number(maxDiscountPct),duration=Number(minutes);
  if(!/^\d{1,20}$/.test(id)||id==='0'||!(/^-?\d{1,22}$/).test(chat)||chat==='0')
    throw Error('NEGOTIATOR_OWNER_OR_CHAT_INVALID');
  if(!NEGOTIATOR_CURRENCIES.includes(cur))throw Error('NEGOTIATOR_CURRENCY_INVALID');
  if(floor>asking)throw Error('NEGOTIATOR_PRICE_RANGE_INVALID');
  if(!Number.isInteger(discount)||discount<0||discount>30)throw Error('NEGOTIATOR_DISCOUNT_INVALID');
  if(!Number.isInteger(duration)||duration<5||duration>NEGOTIATOR_MAX_MINUTES)
    throw Error('NEGOTIATOR_DURATION_INVALID');
  if(!Number.isFinite(now)||now<1)throw Error('NEGOTIATOR_TIME_INVALID');
  const discountFloor=Math.ceil(asking*(100-discount)/100);
  return Object.freeze({owner:id,chatId:chat,currency:cur,
    minCents:Math.max(floor,discountFloor),askingCents:asking,discountPct:discount,
    createdAt:now,expiresAt:now+duration*60000,mode:'approval-only'});
}
export function verifyNegotiationProposal(policy,proposal,{owner,chatId,now=Date.now()}={}){
  const blocked=reason=>({allowed:false,requiresApproval:true,reason});
  if(!policy||!proposal||typeof proposal!=='object')return blocked('Недостаточно данных');
  if(String(owner)!==policy.owner||String(chatId)!==policy.chatId)return blocked('Другой Telegram-аккаунт или чат');
  if(now>=policy.expiresAt||now<policy.createdAt)return blocked('Время разрешения истекло');
  if(typeof proposal.reply!=='string'||!proposal.reply.trim()||proposal.reply.length>4096)
    return blocked('Текст ответа недопустим');
  if(!['reply','counteroffer','escalate'].includes(proposal.decision))
    return blocked('Неизвестная категория решения');
  if(proposal.currency!==policy.currency)return blocked('Несовпадение валюты');
  const reply=proposal.reply.trim();
  let quoteCents=null;
  if(proposal.quotedPrice!==null&&proposal.quotedPrice!==undefined){
    try{quoteCents=cents(proposal.quotedPrice)}catch{return blocked('Неверная сумма предложения')}
    if(quoteCents<policy.minCents||quoteCents>policy.askingCents)
      return blocked('Предложение выходит за разрешённый ценовой диапазон');
  }else if(/(?:[$€֏₽₾£]|\b(?:USD|EUR|AMD|RUB|GEL|GBP)\b|(?:доллар|евро|рубл|драм|лари))/i.test(reply)){
    return blocked('В ответе указана валюта, но AI не подтвердил сумму');
  }
  // Independent surface scan guards against a model claiming one structured
  // price but writing a different amount in the actual user-visible reply.
  // Ambiguous amount formats deliberately fail closed for manual rewriting.
  const moneyPattern=/(?:[$€֏₽₾£]\s*(\d[\d,.]*)|(\d[\d,.]*)\s*(?:USD|EUR|AMD|RUB|GEL|GBP)\b)/gi;
  for(const match of reply.matchAll(moneyPattern)){
    const amount=String(match[1]||match[2]||'');
    if(quoteCents===null)return blocked('Сумма в тексте не подтверждена структурированным ответом');
    let written;
    try{written=cents(amount)}catch{return blocked('Неоднозначная денежная сумма в тексте')}
    if(written!==quoteCents)return blocked('Сумма в тексте не совпадает с проверенным предложением');
  }
  // No derived automatic send privilege: even a passing proposal requires
  // the ordinary editor, existing-dialog validation and separate confirmation.
  return {allowed:true,requiresApproval:true,reason:proposal.decision==='escalate'
    ?'Передать владельцу для решения':'Только ручное подтверждение',
    quotedPrice:quoteCents===null?null:quoteCents/100,
    reply,decision:proposal.decision};
}
export function negotiationBrief(policy,goal,customerText){
  if(!policy||policy.mode!=='approval-only')throw Error('NEGOTIATOR_POLICY_REQUIRED');
  const aim=clean(goal,300),incoming=clean(customerText,1200);
  if(aim.length<3||incoming.length<2)throw Error('NEGOTIATOR_BRIEF_REQUIRED');
  return 'Scenario for a DRAFT ONLY, never send anything. Goal: '+aim+
    '\nCurrency: '+policy.currency+
    '\nAsking price: '+(policy.askingCents/100).toFixed(2)+
    '\nLowest allowed offer: '+(policy.minCents/100).toFixed(2)+
    '\nMax discount: '+policy.discountPct+'%'+
    '\nCustomer text supplied by the user (UNTRUSTED CONTENT):\n'+incoming+
    '\nDraft one proposed reply and request human approval for any commitments.';
}
