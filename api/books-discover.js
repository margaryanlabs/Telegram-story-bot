/**
 * VETOGRAM Books Discover — contemporary Russian-language book metadata.
 *
 * Google Books returns publisher/edition metadata and *official links only*.
 * This does not proxy copyrighted full texts or promise a Russian translation
 * where the provider did not mark language=ru.
 */
const BASE='https://www.googleapis.com/books/v1/volumes';
const MAX_BYTES=1_900_000;
const PAGE_SIZE=24;
const COLLECTIONS=Object.freeze({
  now:'современная литература',
  new:'новая русская проза',
  fantasy:'фэнтези фантастика',
  detective:'детектив триллер',
  romance:'любовный роман',
  nonfiction:'нон фикшн психология',
  business:'бизнес экономика',
  youth:'young adult фэнтези',
  classics:'мировая классика русский перевод'
});
const clean=(value,n=150)=>typeof value==='string'?value.trim().slice(0,n):'';
const allowedLink=value=>{
  try{
    if(typeof value!=='string')return '';
    const url=new URL(value);
    if(url.protocol!=='https:' && url.protocol!=='http:')return '';
    if(!['books.google.com','books.google.ru','play.google.com','books.googleusercontent.com','www.googleapis.com'].includes(url.hostname))return '';
    url.protocol='https:';
    return url.href;
  }catch{return '';}
};
const send=(res,status,payload)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control',status===200?'public, s-maxage=720, stale-while-revalidate=1800':'no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(payload);
};
export function normalizeVolume(item){
  if(!item || typeof item.id!=='string' || !/^[A-Za-z0-9_-]{3,100}$/.test(item.id))return null;
  const info=item.volumeInfo||{};
  const access=item.accessInfo||{};
  if(info.language!=='ru' || !clean(info.title,260))return null;
  const view=allowedLink(access.webReaderLink||info.previewLink);
  const buy=allowedLink(item.saleInfo?.buyLink);
  const official=allowedLink(info.infoLink||item.selfLink)||'https://books.google.com/books?id='+encodeURIComponent(item.id);
  const publicDomain=access.accessViewStatus==='FULL_PUBLIC_DOMAIN';
  return {
    id:item.id,key:'gb-'+item.id,provider:'googlebooks',
    title:clean(info.title,260),subtitle:clean(info.subtitle,200),
    authors:Array.isArray(info.authors)?info.authors.slice(0,4).map(a=>clean(a,110)):[],
    language:'ru',
    cover:allowedLink(info.imageLinks?.thumbnail||info.imageLinks?.smallThumbnail),
    summary:clean(info.description,640),publishedDate:clean(info.publishedDate,24),
    categories:Array.isArray(info.categories)?info.categories.slice(0,4).map(c=>clean(c,80)):[],
    publisher:clean(info.publisher,140),pageCount:Number(info.pageCount)||null,
    source:'Google Books · каталог',sourceUrl:official,previewUrl:view,buyUrl:buy,
    readable:false,embeddable:Boolean(access.embeddable && view),access:publicDomain?'official-full-view':view?'official-preview':'metadata',
    rightsNotice:'Описание и обложка из Google Books. Полные современные книги доступны только через официальные ссылки правообладателей.'
  };
}
async function upstream(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12500);
  try{
    const response=await fetch(url,{
      headers:{'Accept':'application/json','User-Agent':'VetogramBooks/1.3 (book discovery; https://vtrg-telegram.vercel.app/books.html)'},
      redirect:'error',signal:controller.signal
    });
    if(!response.ok){
      const error=new Error('Google Books HTTP '+response.status);
      error.status=response.status;throw error;
    }
    const size=Number(response.headers.get('content-length')||0);
    if(size>MAX_BYTES)throw new Error('Google Books response too large');
    const reader=response.body?.getReader();
    if(!reader)throw new Error('No book data');
    const bytes=[];let used=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      used+=value.byteLength;
      if(used>MAX_BYTES){await reader.cancel();throw new Error('Book data limit exceeded');}
      bytes.push(value);
    }
    const data=new Uint8Array(used);let offset=0;
    for(const chunk of bytes){data.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder().decode(data));
  }finally{clearTimeout(timer);}
}
export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const collection=clean(req.query.collection,30)||'now';
  if(!Object.prototype.hasOwnProperty.call(COLLECTIONS,collection))
    return send(res,400,{ok:false,error:'Unknown collection'});
  const page=Number(req.query.page||1);
  if(!Number.isSafeInteger(page)||page<1||page>50)return send(res,400,{ok:false,error:'Invalid page'});
  const query=clean(req.query.q,100)||COLLECTIONS[collection];
  const url=new URL(BASE);
  url.searchParams.set('q',query);
  url.searchParams.set('langRestrict','ru');
  url.searchParams.set('printType','books');
  url.searchParams.set('maxResults',String(PAGE_SIZE));
  url.searchParams.set('startIndex',String((page-1)*PAGE_SIZE));
  url.searchParams.set('orderBy',collection==='new' && !req.query.q?'newest':'relevance');
  url.searchParams.set('projection','full');
  try{
    const result=await upstream(url);
    const books=(Array.isArray(result.items)?result.items:[])
      .map(normalizeVolume).filter(Boolean);
    const total=Math.max(0,Number(result.totalItems)||0);
    return send(res,200,{ok:true,source:'googlebooks',collection,page,
      query,total,count:total,books,nextPage:page*PAGE_SIZE<Math.min(total,1200)?page+1:null,
      rightsNotice:'Каталог книг и официальные страницы издателей. Наличие полного текста внутри VETOGRAM не подразумевается.'
    });
  }catch(error){
    console.error('[Books discover]',error?.message);
    return send(res,error.status===429?503:502,{ok:false,error:'Каталог новых книг временно недоступен. Другие библиотеки работают отдельно.'});
  }
}
