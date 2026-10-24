/* VETOGRAM 3.0 · Human-controlled Creative Deck.
 * No AI call, persistence, auto-send, recipient access or Telegram API.
 * A preset only annotates text that a user must review and submit themselves.
 */
export const CREATIVE_PRESETS=Object.freeze({
  reply:Object.freeze([
    {id:'clear',symbol:'↗',title:'Уверенно',description:'Чётко, без давления',instruction:'Напиши уверенный, уважительный ответ. Вырази основную мысль прямо, без агрессии и ложных обещаний.'},
    {id:'warm',symbol:'♡',title:'Теплее',description:'Человечно и тактично',instruction:'Напиши тёплый, тактичный ответ. Сохрани смысл, не добавляй несуществующих фактов.'},
    {id:'short',symbol:'≡',title:'Коротко',description:'Максимум ясности',instruction:'Ответь кратко, в 1–3 предложениях. Убери лишние слова, не потеряв главную мысль.'},
    {id:'business',symbol:'▣',title:'Деловой',description:'Структура и уважение',instruction:'Подготовь профессиональный ответ с понятным следующим шагом. Не обещай то, чего нет в исходном тексте.'}
  ]),
  story:Object.freeze([
    {id:'cinema',symbol:'✧',title:'Cinematic',description:'Сильный первый кадр',instruction:'Подготовь Story с цепляющим началом, коротким основным текстом и выразительной концовкой. Не выдумывай цифры и отзывы.'},
    {id:'luxury',symbol:'◇',title:'Quiet luxury',description:'Минимум слов, статус',instruction:'Напиши лаконичную премиальную Story с точной лексикой, без громких штампов и неправдивой эксклюзивности.'},
    {id:'launch',symbol:'↗',title:'Запуск',description:'Ясная ценность и CTA',instruction:'Создай Story для запуска: проблема, реальная ценность, один конкретный призыв к действию. Не придумывай скидки и сроки.'},
    {id:'personal',symbol:'♡',title:'Личная история',description:'Эмоция без клише',instruction:'Создай искреннюю Story от первого лица, используя только предоставленные факты, без выдуманных событий.'}
  ]),
  campaign:Object.freeze([
    {id:'offer',symbol:'✳',title:'Оффер',description:'Товар → выгода → шаг',instruction:'Создай Story-to-Sale: укажи реальную ценность предложения и один понятный CTA. Не изобретай цену или наличие.'},
    {id:'lead',symbol:'⌁',title:'Заявки',description:'Диалог вместо шума',instruction:'Создай Story-to-Sale для заявок: кому подходит, зачем написать, один CTA. Не выдавай сбор заявок за действующую интеграцию.'},
    {id:'trust',symbol:'◈',title:'Доверие',description:'Факты, без хайпа',instruction:'Составь Story для доверия: конкретные проверяемые преимущества и аккуратный CTA. Не придумывай кейсы, отзывы и гарантии.'},
    {id:'teaser',symbol:'⊙',title:'Интрига',description:'Интерес без обмана',instruction:'Создай тизер Story, который вызывает интерес без обмана и раскрывает один реальный факт о предложении.'}
  ])
});
export function buildCreativeDraft(mode,id,existing,max=3000){
  const set=CREATIVE_PRESETS[mode];
  const preset=set?.find(item=>item.id===id);
  if(!preset)return {ok:false,reason:'unknown-preset'};
  const text=typeof existing==='string'?existing.trim():'';
  const instruction='СТИЛЬ ОТВЕТА (черновик, не отправлять автоматически): '+preset.instruction;
  const next=text?instruction+'\n\nМОЙ ИСХОДНЫЙ ЗАПРОС:\n'+text:instruction+'\n\nТЕМА И ДЕТАЛИ:\n';
  if(next.length>max)return {ok:false,reason:'too-long'};
  return {ok:true,value:next,mode,presetId:preset.id};
}
