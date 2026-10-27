/**
 * Vetogram Books: Russian and Armenian Wikisource catalog + reader gateway.
 * Only preselected Wikimedia hosts, known page ids, and main-namespace works.
 * Text is returned as text, never as remote HTML; links to source/attribution retained.
 */
const WIKIS = Object.freeze({ru:'ru.wikisource.org',hy:'hy.wikisource.org'});
const AGENT = 'VetogramBooks/1.2 (https://vtrg-telegram.vercel.app/books.html)';
const MAX_BYTES = 2_600_000;
const PAGE_SIZE = 20;
const PREFILL = Object.freeze({ru:'Пушкин',hy:'Թումանյան'});
const MAX_CHAPTERS = 60;
const TRANSLATION_CATEGORIES = Object.freeze({
  en:'Переводы с английского языка',
  fr:'Переводы с французского языка',
  de:'Переводы с немецкого языка',
  it:'Переводы с итальянского языка',
  es:'Переводы с испанского языка'
});
const TRANSLATION_PAGE_SIZE = 24;
const TRANSLATION_SEARCH_SIZE = 24;

const send = (res,status,value) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control',status===200?'public, s-maxage=900, stale-while-revalidate=1800':'no-store');
  return res.status(status).json(value);
};
const boundedInt = (value,min,max) => {
  if (!/^\d+$/.test(String(value??'')))return null;
  const n=Number(value);
  return Number.isSafeInteger(n) && n>=min && n<=max ? n : null;
};
const limited = (value,max) => typeof value==='string' ? value.trim().slice(0,max) : '';
function apiUrl(wiki,params) {
  const url=new URL('https://'+WIKIS[wiki]+'/w/api.php');
  url.searchParams.set('format','json');
  url.searchParams.set('formatversion','2');
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  return url;
}
async function wikiGet(wiki,params) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),13500);
  try {
    const response=await fetch(apiUrl(wiki,params),{
      headers:{'User-Agent':AGENT,'Api-User-Agent':AGENT,'Accept':'application/json'},
      redirect:'error',signal:controller.signal
    });
    if (!response.ok) {
      const err=new Error('Wikisource response '+response.status);
      err.upstreamStatus=response.status;
      throw err;
    }
    const declared=Number(response.headers.get('content-length')||0);
    if(declared>MAX_BYTES)throw new Error('Page exceeds response size limit');
    // Bound actual transferred bytes as well, rather than trusting Content-Length.
    const reader=response.body?.getReader();
    if(!reader)throw new Error('Empty API response');
    const blocks=[];let len=0;
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      len+=value.byteLength;
      if(len>MAX_BYTES){await reader.cancel();throw new Error('Upstream payload too large');}
      blocks.push(value);
    }
    const merged=new Uint8Array(len);let offset=0;
    for(const block of blocks){merged.set(block,offset);offset+=block.byteLength;}
    const json=JSON.parse(new TextDecoder().decode(merged));
    if(json?.error)throw new Error('Wikisource API error: '+String(json.error.code||'unknown'));
    return json;
  } finally {clearTimeout(timeout);}
}
function sourceUrl(wiki,title) {
  return 'https://'+WIKIS[wiki]+'/wiki/'+String(title).replace(/ /g,'_').split('/').map(encodeURIComponent).join('/');
}
function decodeEntities(html) {
  return String(html).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,raw)=>{
    const number=raw.toLowerCase().startsWith('x')?parseInt(raw.slice(1),16):parseInt(raw,10);
    return number>0 && number<=0x10ffff && !(number>=0xd800 && number<=0xdfff)?String.fromCodePoint(number):'';
  }).replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|laquo|raquo|hellip|bull|copy|rsquo|lsquo);/gi,(_,name)=>({
    amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',
    laquo:'«',raquo:'»',hellip:'…',bull:'•',copy:'©',rsquo:'’',lsquo:'‘'
  })[name.toLowerCase()]);
}
export function htmlToReaderText(html) {
  return decodeEntities(String(html||'')
    .replace(/<\!--[\s\S]*?-->/g,'')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<sup\b[^>]*class=["'][^"']*(?:reference|mw-ref)[^"']*["'][^>]*>[\s\S]*?<\/sup>/gi,'')
    .replace(/<(?:br|hr)\b[^>]*\/?\s*>/gi,'\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section|pre|dd|dt)>/gi,'\n\n')
    .replace(/<[^>]+>/g,'')
  ).replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim();
}
function bookFromEntry(entry,wiki) {
  const title=limited(entry.title,220);
  const id=Number(entry.pageid);
  const excerpt=htmlToReaderText(limited(entry.snippet,700)).slice(0,400);
  return {
    id,title,authors:[],language:wiki,cover:'',summary:excerpt,
    subjects:[],downloads:0,readable:true,
    provider:'wikisource',wiki,source:'Викитека · '+(wiki==='ru'?'Русский':'Հայերեն'),
    sourceUrl:sourceUrl(wiki,title),
    licenseUrl:'https://'+WIKIS[wiki]+'/wiki/Special:Copyright',
    rightsNotice:'Лицензия и статус авторских прав проверяются на странице произведения.',
    key:'ws-'+wiki+'-'+id
  };
}
/**
 * Search Russian translations by *source category*, not by matching foreign
 * author names in unsorted Russian pages. The MediaWiki category is an
 * editorial assertion of translation language, not a guarantee that a specific
 * edition can be redistributed under a country's copyright law.
 */
export async function translationsCatalog(req,res) {
  const from=limited(req.query.original,2)||'en';
  if(!Object.prototype.hasOwnProperty.call(TRANSLATION_CATEGORIES,from))
    return send(res,400,{ok:false,error:'Unsupported original language'});
  const q=limited(req.query.q,100);
  const page=boundedInt(req.query.page??'1',1,300);
  if(!page)return send(res,400,{ok:false,error:'Invalid page'});
  const category=TRANSLATION_CATEGORIES[from];
  const categoryTitle='Категория:'+category;
  let rows=[], nextCursor=null, total=null;
  if(q){
    // CirrusSearch incategory restricts the result set to certified source
    // category membership, unlike general full-text author search.
    const search=await wikiGet('ru',{
      action:'query',list:'search',srsearch:'incategory:"'+category+'" '+q,
      srnamespace:'0',srlimit:TRANSLATION_SEARCH_SIZE,
      sroffset:(page-1)*TRANSLATION_SEARCH_SIZE,srwhat:'text',srinfo:'totalhits'
    });
    rows=Array.isArray(search.query?.search)?search.query.search:[];
    total=Math.max(0,Number(search.query?.searchinfo?.totalhits)||0);
  }else{
    const cursor=limited(req.query.cursor,260);
    // A continuation token is opaque upstream, passed only as a query
    // parameter to the hard-coded ru.wikisource.org endpoint.
    const params={action:'query',list:'categorymembers',cmtitle:categoryTitle,
      cmnamespace:'0',cmtype:'page',cmlimit:TRANSLATION_PAGE_SIZE};
    if(cursor)params.cmcontinue=cursor;
    const result=await wikiGet('ru',params);
    rows=Array.isArray(result.query?.categorymembers)?result.query.categorymembers:[];
    nextCursor=typeof result.continue?.cmcontinue==='string'
      ? result.continue.cmcontinue.slice(0,260):null;
  }
  const books=rows.filter(x=>x.ns===0 && Number.isSafeInteger(x.pageid) && x.pageid>0)
    .map(row=>({
      ...bookFromEntry(row,'ru'),
      isTranslation:true,
      originalLanguage:from,
      source:'Русский перевод · Викитека',
      rightsNotice:'Русский перевод зарубежного произведения. Проверьте права переводчика и издания на странице оригинала.',
      sourceCategory:sourceUrl('ru',categoryTitle)
    }));
  return send(res,200,{
    ok:true,source:'wikisource',collection:'translations',wiki:'ru',
    originalLanguage:from,categoryUrl:sourceUrl('ru',categoryTitle),
    page,count:total,nextPage:q && rows.length===TRANSLATION_SEARCH_SIZE && page*TRANSLATION_SEARCH_SIZE<total?page+1:null,
    nextCursor,books
  });
}
export async function catalog(req,res,wiki) {
  const q=limited(req.query.q,100) || PREFILL[wiki];
  const page=boundedInt(req.query.page??'1',1,300);
  if(!page)return send(res,400,{ok:false,error:'Invalid page'});
  const offset=(page-1)*PAGE_SIZE;
  const data=await wikiGet(wiki,{
    action:'query',list:'search',srsearch:q,srnamespace:'0',srlimit:PAGE_SIZE,
    sroffset:offset,srwhat:'text',srinfo:'totalhits'
  });
  const rows=Array.isArray(data.query?.search)?data.query.search:[];
  const count=Math.max(0,Number(data.query?.searchinfo?.totalhits)||0);
  const books=rows.filter(row=>row.ns===0 && Number.isSafeInteger(row.pageid) && row.pageid>0)
    .map(row=>bookFromEntry(row,wiki));
  return send(res,200,{
    ok:true,source:'wikisource',wiki,
    featuredQuery:req.query.q?'':PREFILL[wiki],page,count,
    nextPage:rows.length===PAGE_SIZE && (offset+PAGE_SIZE)<count ? page+1:null,books
  });
}
function chaptersFromLinks(links,title,allowEditions=false){
  const normalized=value=>String(value).replace(/_/g,' ').replace(/ё/gi,'е').trim().toLowerCase();
  const prefix=normalized(title);
  const stem=prefix.split('(')[0].trim();
  const author=prefix.match(/\(([^);]+)[);]/)?.[1]||'';
  const seen=new Set();
  return (Array.isArray(links)?links:[])
    .filter(link=>link.ns===0 && typeof(link.title||link['*'])==='string')
    .map(link=>String(link.title||link['*']))
    .filter(linkTitle=>{
      const candidate=normalized(linkTitle);
      const nested=candidate.startsWith(prefix+'/');
      // Translation indexes may link to versions whose titles add a
      // translator inside parentheses. Do not treat random unrelated
      // links as chapters, and only allow sibling versions for known indexes.
      const edition=allowEditions && stem.length>=4 && candidate.startsWith(stem+' (')
        && (!author || candidate.includes(author)) && candidate!==prefix;
      return (nested || edition) && candidate.length<280;
    })
    .filter(link=>{const key=normalized(link);if(seen.has(key))return false;seen.add(key);return true;})
    .slice(0,MAX_CHAPTERS).map(link=>{
      const label=normalized(link).startsWith(prefix+'/')
        ? link.slice(String(title).length+1):link;
      return {title:link,label:label.replace(/_/g,' ').slice(0,120)};
    });
}
async function parsed(wiki,opts) {
  const json=await wikiGet(wiki,{action:'parse',prop:'text|links|revid|categories',redirects:'1',...opts});
  if(!json?.parse || typeof json.parse.text!=='string') {
    const e=new Error('Page missing or inaccessible');e.upstreamStatus=404;throw e;
  }
  if(json.parse.ns!==undefined && json.parse.ns!==0)throw new Error('Not a book page');
  return json.parse;
}
export async function fullText(req,res,wiki) {
  const id=boundedInt(req.query.id,1,999999999);
  if(!id)return send(res,400,{ok:false,error:'Invalid book id'});
  const root=await parsed(wiki,{pageid:id});
  const title=limited(root.title,220);
  if(!title)return send(res,404,{ok:false,error:'Book unavailable'});
  const isTranslationIndex=wiki==='ru' && (root.categories||[]).some(category=>
    String(category.title||category.category||category['*']||'').includes('Списки переводов'));
  const chapters=chaptersFromLinks(root.links,title,isTranslationIndex);
  const chapterId=req.query.chapter===undefined?null:boundedInt(req.query.chapter,0,MAX_CHAPTERS-1);
  if(req.query.chapter!==undefined && chapterId===null) return send(res,400,{ok:false,error:'Invalid chapter'});
  if(chapterId!==null && chapterId>=chapters.length)return send(res,404,{ok:false,error:'Chapter unavailable'});
  const part=chapterId===null?root:await parsed(wiki,{page:chapters[chapterId].title});
  const text=htmlToReaderText(part.text);
  if((!text || text.length<60) && chapters.length===0)return send(res,422,{ok:false,error:'На этой странице нет читаемого текста. Попробуйте другую книгу или главу.'});
  const book=bookFromEntry({pageid:id,title,ns:0},wiki);
  return send(res,200,{
    ok:true,book,
    text:chapterId===null && isTranslationIndex && chapters.length
      ? 'У этого зарубежного произведения есть несколько русских переводов. Откройте настройки Aa и выберите конкретный перевод или издание.'
      :text.length>=60?text:'Выберите главу в настройках чтения.',
    chapters,chapter:chapterId,isTranslationIndex,
    attribution:{
      title:part.title||title,source:sourceUrl(wiki,part.title||title),revision:Number(part.revid)||null,
      licenseUrl:book.licenseUrl,modified:'Текст адаптирован для читалки, исходное форматирование упрощено.'
    }
  });
}
export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const wiki=req.query.collection==='translations'?'ru':limited(req.query.wiki,3);
  if(!Object.prototype.hasOwnProperty.call(WIKIS,wiki))
    return send(res,400,{ok:false,error:'Unsupported wiki'});
  try {
    if(req.query.collection==='translations')return await translationsCatalog(req,res);
    if(req.query.mode==='text')return await fullText(req,res,wiki);
    return await catalog(req,res,wiki);
  }catch(error){
    console.error('[Books Wikisource]',wiki,error?.message);
    const status=error.upstreamStatus===429?503:error.upstreamStatus===404?404:502;
    return send(res,status,{ok:false,error:status===503?'Библиотека перегружена. Попробуйте позже.':status===404?'Произведение не найдено.':'Библиотека временно недоступна.'});
  }
}
