
/**
 * VETO Story Engine: dependency-free, deterministic model shared by browser and tests.
 * Drafts are intentionally device-local until a permissioned cloud vault ships.
 */
export const STORY_TEMPLATES = Object.freeze([
  {id:'noir',name:'NOIR',mood:'Luxury',start:'#09090d',end:'#421322',accent:'#ff687c',layout:'center',title:'OWN THE MOMENT',subtitle:'The night is yours.'},
  {id:'editorial',name:'EDITORIAL',mood:'Minimal',start:'#171a20',end:'#43434b',accent:'#ededed',layout:'bottom',title:'A NEW PERSPECTIVE',subtitle:'Less noise. More meaning.'},
  {id:'voyage',name:'VOYAGE',mood:'Travel',start:'#09141e',end:'#1b6070',accent:'#9ce9dd',layout:'bottom',title:'BEYOND THE MAP',subtitle:'Every destination has a story.'},
  {id:'birthday',name:'AFTERGLOW',mood:'Birthday',start:'#231018',end:'#b84a77',accent:'#ffe3a7',layout:'center',title:'TONIGHT IS YOURS',subtitle:'Another year. Another beautiful chapter.'},
  {id:'invitation',name:'INVITATION',mood:'Event',start:'#0e0d13',end:'#58424b',accent:'#e7c59b',layout:'center',title:'YOU ARE INVITED',subtitle:'An evening worth remembering.'},
  {id:'launch',name:'LAUNCH',mood:'Business',start:'#05070a',end:'#252d49',accent:'#94bdff',layout:'bottom',title:'SOMETHING NEW',subtitle:'The next chapter starts here.'},
  {id:'product',name:'OBJECT',mood:'Product',start:'#101119',end:'#654632',accent:'#ffd5ab',layout:'bottom',title:'MADE TO MATTER',subtitle:'Thoughtfully designed.'},
  {id:'romance',name:'AMOUR',mood:'Romantic',start:'#211019',end:'#915966',accent:'#ffcdca',layout:'center',title:'ONLY US',subtitle:'A thousand little moments.'},
  {id:'midnight',name:'MIDNIGHT',mood:'Party',start:'#0d0922',end:'#502575',accent:'#e1afff',layout:'center',title:'AFTER HOURS',subtitle:'Meet us where the lights begin.'},
  {id:'signal',name:'SIGNAL',mood:'Link',start:'#080c0e',end:'#124a4c',accent:'#82f2d0',layout:'bottom',title:'OPEN THE NEXT',subtitle:'There is more to this story.'}
]);
export const PORTAL_TYPES=Object.freeze([
  {id:'invite',name:'Приглашение',cta:'Принять приглашение'},
  {id:'offer',name:'Предложение',cta:'Открыть предложение'},
  {id:'links',name:'Ссылки',cta:'Перейти'},
  {id:'waitlist',name:'Лист ожидания',cta:'Узнать больше'},
  {id:'poll',name:'Вопрос',cta:'Ответить'}
]);
export const RETENTION_DAYS=Object.freeze([7,30,90,180,365]);
export const PHOTO_EFFECTS=Object.freeze(['original','cinema','mono','warm','cool','vivid']);
export const STORY_LAYER_STYLES=Object.freeze(['plain','pill','outline']);
const clamp=(value,min,max,fallback)=>{
  const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
export function normalizeStoryLayer(input){
  if(!input||typeof input!=='object')throw Error('INVALID_STORY_LAYER');
  const id=String(input.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);
  if(!id)throw Error('STORY_LAYER_ID_REQUIRED');
  const style=STORY_LAYER_STYLES.includes(input.style)?input.style:'plain';
  return {id,text:trimText(input.text,90),style,
    x:clamp(input.x,.09,.91,.5),y:clamp(input.y,.09,.91,.55),
    size:Math.round(clamp(input.size,17,45,27))};
}
export function normalizeStoryLayers(value){
  if(!Array.isArray(value))return [];
  const seen=new Set(),out=[];
  for(const raw of value.slice(0,20)){
    try {
      const layer=normalizeStoryLayer(raw);
      if(seen.has(layer.id)||!layer.text)continue;
      seen.add(layer.id);out.push(layer);
      if(out.length>=6)break;
    }catch{}
  }
  return out;
}
export const MAX_TITLE=90,MAX_SUBTITLE=180,MAX_PORTAL_TEXT=300;
export const templateById=id=>STORY_TEMPLATES.find(t=>t.id===id)||STORY_TEMPLATES[0];
export function trimText(text,limit=180){return String(text??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit);}
export function safeExternalUrl(text) {
  try{
    const v=new URL(String(text||'').trim());
    return v.protocol==='https:' && !v.username && !v.password && v.hostname && !['localhost','127.0.0.1','0.0.0.0','::1'].includes(v.hostname.toLowerCase()) ? v.toString() : '';
  }catch{return ''}
}
export function newStoryDraft({templateId='noir',ownerId,now=Date.now(),id=globalThis.crypto?.randomUUID?.() }={}){
  if(!/^\d{1,20}$/.test(String(ownerId||''))) throw new Error('TELEGRAM_OWNER_REQUIRED');
  const t=templateById(templateId);
  return {version:1,id:id||String(now),ownerId:String(ownerId),templateId:t.id,
    title:t.title,subtitle:t.subtitle,caption:'',imageDataUrl:'',imageMime:'',
    portal:null,remixable:false,branding:false,textY:t.layout==='center'?388:675,fontSize:51,
    photoEffect:'original',photoZoom:1,photoX:0,photoY:0,layers:[],
    retentionDays:30,createdAt:now,updatedAt:now,status:'draft'};
}
export function normalizeDraft(input,ownerId,now=Date.now()){
  if(!input||String(input.ownerId)!==String(ownerId))throw new Error('DRAFT_OWNER_MISMATCH');
  const base=newStoryDraft({ownerId,templateId:input.templateId,now,id:String(input.id||now)});
  const retentionDays=RETENTION_DAYS.includes(Number(input.retentionDays))?Number(input.retentionDays):30;
  const portal=input.portal?normalizePortal(input.portal):null;
  const imageDataUrl=typeof input.imageDataUrl==='string' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(input.imageDataUrl) && input.imageDataUrl.length<=15000000
    ? input.imageDataUrl:'';
  return {...base,title:trimText(input.title,MAX_TITLE),subtitle:trimText(input.subtitle,MAX_SUBTITLE),
    caption:trimText(input.caption,800),retentionDays,portal,
    photoEffect:PHOTO_EFFECTS.includes(input.photoEffect)?input.photoEffect:'original',
    photoZoom:clamp(input.photoZoom,1,2.5,1),
    photoX:clamp(input.photoX,-1,1,0),photoY:clamp(input.photoY,-1,1,0),
    layers:normalizeStoryLayers(input.layers),
    textY:Math.max(260,Math.min(740,Math.round(Number(input.textY)||base.textY))),
    fontSize:Math.max(32,Math.min(66,Math.round(Number(input.fontSize)||51))),
    imageDataUrl,imageMime:imageDataUrl?String(input.imageMime||'image/jpeg'):'',
    remixable:input.remixable===true,branding:input.branding===true,createdAt:Number(input.createdAt)||now,
    updatedAt:Number(input.updatedAt)||now,status:'draft'};
}
export function isExpired(draft,now=Date.now()){
  const retention=RETENTION_DAYS.includes(Number(draft?.retentionDays))?Number(draft.retentionDays):30;
  return Number(draft?.updatedAt||0) + retention*86400000 <= now;
}
export function normalizePortal(input){
  if(!input||!PORTAL_TYPES.some(p=>p.id===input.type))throw Error('INVALID_PORTAL_TYPE');
  const type=PORTAL_TYPES.find(p=>p.id===input.type);
  const link=trimText(input.link,400);
  if(link&&!safeExternalUrl(link))throw Error('PORTAL_HTTPS_LINK_REQUIRED');
  const rawOptions=Array.isArray(input.options)?input.options:String(input.optionsText||'').split(String.fromCharCode(10));
  const options=[...new Set(rawOptions.map(v=>trimText(v,65)).filter(Boolean))].slice(0,5);
  const rawLinks=Array.isArray(input.links)?input.links:
    String(input.linksText||'').split(String.fromCharCode(10)).filter(Boolean).map(row=>{
      const cut=row.indexOf('|');
      return cut<0?{label:'Ссылка',url:row.trim()}:
        {label:row.slice(0,cut).trim(),url:row.slice(cut+1).trim()};
    });
  const links=[];
  if(type.id==='links'){
    for(const raw of rawLinks.slice(0,4)){
      const target=trimText(raw?.url,400);
      if(!safeExternalUrl(target))throw Error('PORTAL_HTTPS_LINK_REQUIRED');
      links.push({label:trimText(raw?.label,42)||'Ссылка',url:safeExternalUrl(target)});
    }
  }
  return {type:type.id,title:trimText(input.title,90),description:trimText(input.description,MAX_PORTAL_TEXT),
    cta:trimText(input.cta,42)||type.cta,link:link?safeExternalUrl(link):'',
    options:type.id==='poll'?(options.length>=2?options:['Да','Нет']):[],links};
}
export function remixDraft(source,ownerId,{now=Date.now(),id=globalThis.crypto?.randomUUID?.()}={}){
  if(String(source?.ownerId)!==String(ownerId))throw Error('REMIX_OWNER_MISMATCH');
  if(source.remixable!==true)throw Error('REMIX_NOT_ALLOWED');
  const base=normalizeDraft(source,ownerId,now);
  // A remix is a fresh independent draft. Never inherit a prior Portal response URL.
  return {...base,id:id||String(now),imageDataUrl:'',imageMime:'',portal:null,
    layers:base.layers.map(layer=>({...layer,text:'EDIT YOUR TEXT'})),
    createdAt:now,updatedAt:now};
}
/** Offline composition assistant. No AI model is used and no image is generated. */
export function draftFromBrief(brief,ownerId,{now=Date.now(),id=globalThis.crypto?.randomUUID?.()}={}){
  const query=trimText(brief,500).toLowerCase();
  const keys=[['birthday',/birthday|день рожден|поздрав|ծնունդ/],
    ['voyage',/travel|путешеств|отдых|поездк|ճանապարհ/],
    ['launch',/business|launch|бизнес|запуск|стартап/],
    ['romance',/love|роман|любов|свадьб|սեր/],
    ['invitation',/invite|приглаш|вечерин|event/],
    ['product',/product|товар|продукт|магазин/]];
  const chosen=keys.find(([,pattern])=>pattern.test(query))?.[0]||'noir';
  const d=newStoryDraft({ownerId,templateId:chosen,now,id});
  return {...d,subtitle:trimText(brief,MAX_SUBTITLE)||d.subtitle};
}
