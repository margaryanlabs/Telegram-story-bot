// Keyless, first-party multilingual concept scoring. NOT embeddings, an LLM,
// or an inference that a message proves a promise, debt or legal obligation.
// Accepts only text already returned to this owner from their own Telegram/Vault.
const families={
  repayment:['верн','верну','вернем','вернём','возврат','отдам','отдад','погас','долг','задолж','repay','refund','owe','return','payback','borrow'],
  payment:['оплат','оплач','платеж','платёж','перевод','перевед','заплат','payment','invoice','transfer','paid','поступ'],
  housing:['квартир','жиль','апартамент','недвижим','аренд','купл','продаж','apartment','property','rent','flat','realestate'],
  meeting:['встреч','созвон','звон','поговор','обсуд','meeting','call','schedule','зум','zoom'],
  promise:['обещ','обязую','согласовал','договорил','сделаю','обещан','promise','commit','agreed'],
  deadline:['дедлайн','срок','дат','завтра','пятниц','сегодня','послезавтра','deadline','due','tomorrow'],
  location:['адрес','локаци','местонахожд','улиц','address','location','street'],
  travel:['перелет','перелёт','билет','рейс','аэропорт','flight','ticket','airport','travel'],
};
const skip=new Set(['когда','какой','какая','какие','почему','найди','покажи','все','было','были','переписка','сообщение','сообщения','пожалуйста','about','where','which','when','what','find','show']);
const clean=v=>String(v||'').toLocaleLowerCase('ru').replace(/ё/g,'е');
export function meaningfulTokens(value){
  return (clean(value).match(/[\p{L}\p{N}]+/gu)||[])
    .filter(t=>t.length>=4&&!skip.has(t)).slice(0,50);
}
export function conceptFamilies(value){
  const text=clean(value);
  return Object.entries(families).filter(([,stems])=>stems.some(s=>text.includes(clean(s))))
    .map(([key])=>key);
}
export function localSemanticScore(query,snippet='',title=''){
  const words=meaningfulTokens(query);
  const hay=clean(snippet),headline=clean(title);
  const exact=words.reduce((n,w)=>n+(hay.includes(w.slice(0,Math.min(5,w.length)))?3:
    headline.includes(w.slice(0,Math.min(5,w.length)))?1:0),0);
  const qFamilies=conceptFamilies(query),mFamilies=conceptFamilies(snippet+' '+title);
  const concepts=qFamilies.filter(k=>mFamilies.includes(k));
  // Each matched topic adds bounded support; unrelated concepts don't score.
  const semantic=concepts.length*4;
  return {score:Math.min(40,exact+semantic),lexical:exact,concepts};
}
