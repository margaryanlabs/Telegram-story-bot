import assert from 'node:assert/strict';
import test from 'node:test';
import handler,{normalizeVolume,normalizeOpenLibrary} from '../api/books-discover.js';
const oldFetch=global.fetch;
function mockRes(){
  return {headers:{},statusCode:0,setHeader(name,value){this.headers[name]=value;},
    status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
}
async function using(mock,fn){global.fetch=mock;try{await fn();}finally{global.fetch=oldFetch;}}
const book={
  id:'abc_123',volumeInfo:{
    title:'Русская книга зарубежного автора',
    subtitle:'Новый фантастический роман',
    authors:['Современный писатель'],language:'ru',
    publisher:'Издательство',publishedDate:'2025-04',pageCount:440,
    imageLinks:{thumbnail:'http://books.google.com/books/content?id=abc_123'},
    previewLink:'https://books.google.com/books?id=abc_123',
    infoLink:'https://books.google.com/books?id=abc_123',
    description:'Фантастика на русском языке.'
  },accessInfo:{viewability:'PARTIAL',accessViewStatus:'SAMPLE'},
  saleInfo:{buyLink:'https://play.google.com/store/books/details?id=abc_123'}
};
test('normalizes real Russian metadata and official preview without inventing full text',()=>{
  const result=normalizeVolume(book);
  assert.equal(result.language,'ru');
  assert.equal(result.provider,'googlebooks');
  assert.equal(result.readable,false);
  assert.equal(result.access,'official-preview');
  assert.match(result.cover,/^https:\/\/books\.google\.com/);
  assert.match(result.buyUrl,/^https:\/\/play\.google\.com/);
  assert.equal(result.title,book.volumeInfo.title);
});
test('rejects non-Russian editions and unsupported source domains',()=>{
  assert.equal(normalizeVolume({...book,volumeInfo:{...book.volumeInfo,language:'en'}}),null);
  const bad=normalizeVolume({...book,volumeInfo:{...book.volumeInfo,
    imageLinks:{thumbnail:'https://bad.example/attack'},infoLink:'https://bad.example/go'}});
  assert.equal(bad.cover,'');
  assert.match(bad.sourceUrl,/^https:\/\/books\.google\.com/);
});
test('limits search to RU books and caps results',async()=>{
  await using(async url=>{
    const u=new URL(url);
    assert.equal(u.hostname,'www.googleapis.com');
    assert.equal(u.searchParams.get('langRestrict'),'ru');
    assert.equal(u.searchParams.get('maxResults'),'24');
    assert.equal(u.searchParams.get('q'),'Фантастика');
    return Response.json({totalItems:2,items:[book,{...book,id:'english',volumeInfo:{...book.volumeInfo,language:'en'}}]});
  },async()=>{
    const res=mockRes();
    await handler({method:'GET',query:{q:'Фантастика',collection:'fantasy',page:'1'}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.books.length,1);
    assert.equal(res.body.books[0].readable,false);
    assert.equal(res.body.count,2);
  });
});
test('rejects malicious collection and method without contacting provider',async()=>{
  await using(async()=>{throw Error('Network should not be called');},async()=>{
    for(const params of [
      {method:'POST',query:{collection:'now'}},
      {method:'GET',query:{collection:'../etc/secret'}},
      {method:'GET',query:{collection:'now',page:'0'}},
      {method:'GET',query:{collection:'now',page:'NaN'}}
    ]){
      const res=mockRes();
      await handler(params,res);
      assert.equal(res.statusCode,params.method==='POST'?405:400);
    }
  });
});


test('Open Library fallback recognizes only Russian-language work identifiers',()=>{
  const work={key:'/works/OL12345W',title:'Мировая литература',
    author_name:['Автор'],language:['rus','eng'],cover_i:123,first_publish_year:1991};
  const book=normalizeOpenLibrary(work);
  assert.equal(book.provider,'openlibrary');
  assert.equal(book.readable,false);
  assert.equal(book.language,'ru');
  assert.equal(book.id,'OL12345W');
  assert.match(book.cover,/^https:\/\/covers\.openlibrary\.org/);
  assert.equal(book.sourceUrl,'https://openlibrary.org/works/OL12345W');
  assert.equal(normalizeOpenLibrary({...work,language:['eng']}),null);
  assert.equal(normalizeOpenLibrary({...work,key:'/authors/OL12345A'}),null);
});
test('Google upstream failure falls back to bounded Russian Open Library metadata lookup',async()=>{
  const hits=[];
  await using(async url=>{
    const u=new URL(url);
    hits.push(u.hostname);
    if(u.hostname==='www.googleapis.com'){
      return Response.json({error:'key not configured'},{status:403});
    }
    assert.equal(u.hostname,'openlibrary.org');
    assert.match(u.searchParams.get('q'),/language:rus/);
    assert.equal(u.searchParams.get('fields'),'key,title,author_name,language,cover_i,first_publish_year');
    assert.equal(u.searchParams.get('limit'),'24');
    return Response.json({numFound:1,docs:[
      {key:'/works/OL9876W',title:'Книга с русским изданием',language:['rus'],
        author_name:['Писатель'],cover_i:4567,first_publish_year:1990}
    ]});
  },async()=>{
    const res=mockRes();
    await handler({method:'GET',query:{collection:'classics',page:'1'}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.source,'openlibrary');
    assert.equal(res.body.books.length,1);
    assert.equal(res.body.books[0].readable,false);
    assert.equal(res.body.books[0].title,'Книга с русским изданием');
  });
  assert.deepEqual(hits,['www.googleapis.com','openlibrary.org']);
});
