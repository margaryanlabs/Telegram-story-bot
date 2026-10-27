import assert from 'node:assert/strict';
import test from 'node:test';
import wikisource,{htmlToReaderText} from '../api/books-wikisource.js';

const fakeResponse=()=>({
  code:0,payload:null,headers:{},
  setHeader(key,val){this.headers[key]=val;return this;},
  status(value){this.code=value;return this;},
  json(value){this.payload=value;return this;}
});
const bookPage={
  pageid:110,title:'Русская книга',ns:0,
  snippet:'Русская книга',size:1300,wordcount:100
};
const root={
  title:'Русская книга',pageid:110,revid:1234,ns:0,
  text:'<div><p>Вступление к русской книге. Здесь начинается наш длинный классический текст и продолжается чтение.</p></div>',
  links:[
    {ns:0,title:'Русская книга/Глава 1'},
    {ns:0,title:'Сторонняя книга/Глава 2'},
    {ns:4,title:'Русская книга/Другое'},
  ]
};
const chapter={
  title:'Русская книга/Глава 1',ns:0,revid:1235,
  text:'<div><h2>Глава первая</h2><p>Текст первой главы. Литература на русском языке доступна внутри читалки Telegram.</p></div>',
  links:[]
};
const originalFetch=global.fetch;
async function withFetch(handler,fn){
  global.fetch=handler;
  try{await fn();}finally{global.fetch=originalFetch;}
}
test('HTML to text keeps Cyrillic and Armenian but drops active markup',()=>{
  const output=htmlToReaderText('<p>Привет &amp; Բարեւ</p><script>alert(42)</script><p>Вторая часть&#33;</p>');
  assert.match(output,/Привет & Բարեւ/);
  assert.match(output,/Вторая часть!/);
  assert.doesNotMatch(output,/alert|<p>/);
});
test('Russian Wikisource: searching returns main-namespace entries with attribution',async()=>{
  await withFetch(async url=>{
    const parsed=new URL(url);
    assert.equal(parsed.hostname,'ru.wikisource.org');
    assert.equal(parsed.searchParams.get('srsearch'),'Пушкин');
    assert.equal(parsed.searchParams.get('srnamespace'),'0');
    return Response.json({query:{searchinfo:{totalhits:1},search:[bookPage]}});
  },async()=>{
    const res=fakeResponse();
    await wikisource({method:'GET',query:{wiki:'ru'}},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.books[0].key,'ws-ru-110');
    assert.equal(res.payload.books[0].language,'ru');
    assert.match(res.payload.books[0].sourceUrl,/ru.wikisource.org/);
  });
});
test('Armenian Wikisource: request is restricted to HY project',async()=>{
  await withFetch(async url=>{
    const parsed=new URL(url);
    assert.equal(parsed.hostname,'hy.wikisource.org');
    assert.equal(parsed.searchParams.get('srsearch'),'Թումանյան');
    return Response.json({query:{searchinfo:{totalhits:0},search:[]}});
  },async()=>{
    const res=fakeResponse();
    await wikisource({method:'GET',query:{wiki:'hy'}},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.wiki,'hy');
  });
});
test('reader returns root text, chapter list and chosen chapter; rejects non-book links',async()=>{
  let requests=0;
  await withFetch(async url=>{
    requests++;
    const parsed=new URL(url);
    assert.equal(parsed.searchParams.get('action'),'parse');
    if(parsed.searchParams.get('pageid')==='110') return Response.json({parse:root});
    if(parsed.searchParams.get('page')==='Русская книга/Глава 1')return Response.json({parse:chapter});
    throw Error('Unexpected upstream request');
  },async()=>{
    const first=fakeResponse();
    await wikisource({method:'GET',query:{wiki:'ru',mode:'text',id:'110'}},first);
    assert.equal(first.code,200);
    assert.equal(first.payload.chapters.length,1);
    assert.match(first.payload.text,/Вступление/);
    const second=fakeResponse();
    await wikisource({method:'GET',query:{wiki:'ru',mode:'text',id:'110',chapter:'0'}},second);
    assert.equal(second.code,200);
    assert.match(second.payload.text,/Глава первая/);
    assert.equal(second.payload.attribution.revision,1235);
  });
  assert.equal(requests,3);
});
test('bad input and other hosts are rejected without a network request',async()=>{
  await withFetch(async()=>{throw Error('network must never be reached');},async()=>{
    for(const query of [
      {wiki:'evil.example'},
      {wiki:'ru',mode:'text',id:'https://127.0.0.1/'},
      {wiki:'hy',page:'0'}
    ]){
      const res=fakeResponse();
      await wikisource({method:'GET',query},res);
      assert.equal(res.code,400);
    }
    const res=fakeResponse();
    await wikisource({method:'POST',query:{wiki:'ru'}},res);
    assert.equal(res.code,405);
  });
});


test('foreign literature discovery uses Russian translation categories, with source attribution',async()=>{
  await withFetch(async url=>{
    const req=new URL(url);
    assert.equal(req.hostname,'ru.wikisource.org');
    assert.equal(req.searchParams.get('list'),'categorymembers');
    assert.equal(req.searchParams.get('cmtitle'),'Категория:Переводы с французского языка');
    assert.equal(req.searchParams.get('cmnamespace'),'0');
    return Response.json({continue:{cmcontinue:'page|414243|98765',continue:'-||'},
      query:{categorymembers:[{pageid:765,ns:0,title:'Три мушкетёра (Дюма)'}]}});
  },async()=>{
    const res=fakeResponse();
    await wikisource({method:'GET',query:{collection:'translations',original:'fr',page:'1'}},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.collection,'translations');
    assert.equal(res.payload.count,null);
    assert.equal(res.payload.nextCursor,'page|414243|98765');
    assert.equal(res.payload.books[0].language,'ru');
    assert.equal(res.payload.books[0].originalLanguage,'fr');
    assert.equal(res.payload.books[0].isTranslation,true);
    assert.equal(res.payload.books[0].key,'ws-ru-765');
  });
});
test('foreign translations use server-side category-restricted full-text search',async()=>{
  await withFetch(async url=>{
    const req=new URL(url);
    const search=req.searchParams.get('srsearch');
    assert.match(search,/incategory:"Переводы с английского языка"/);
    assert.match(search,/Дойль/);
    assert.equal(req.searchParams.get('srnamespace'),'0');
    return Response.json({query:{searchinfo:{totalhits:1},search:[
      {pageid:110,ns:0,title:'Приключения Шерлока Холмса (Дойль)'}
    ]}});
  },async()=>{
    const res=fakeResponse();
    await wikisource({method:'GET',query:{collection:'translations',original:'en',q:'Дойль',page:'1'}},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.count,1);
    assert.equal(res.payload.books[0].isTranslation,true);
  });
});
test('category browsing forwards an opaque next cursor only to the pinned Wikisource host',async()=>{
  await withFetch(async url=>{
    const req=new URL(url);
    assert.equal(req.hostname,'ru.wikisource.org');
    assert.equal(req.searchParams.get('cmcontinue'),'page|414243|98765');
    return Response.json({query:{categorymembers:[]}});
  },async()=>{
    const res=fakeResponse();
    await wikisource({method:'GET',query:{
      collection:'translations',original:'de',page:'2',cursor:'page|414243|98765'
    }},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.nextCursor,null);
  });
});
test('invalid original languages are rejected before calling Wikisource',async()=>{
  await withFetch(async()=>{throw Error('unexpected network');},async()=>{
    const res=fakeResponse();
    await wikisource({method:'GET',query:{collection:'translations',original:'ru'}},res);
    assert.equal(res.code,400);
  });
});
