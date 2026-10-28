import assert from 'node:assert/strict';
import test from 'node:test';
import booksApi,{bookSummary} from '../api/books.js';

function response(){
  return {
    headers:{},code:200,data:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this;},
    json(v){this.data=v;return this;}
  };
}
const fixture={
  id:11,title:"Alice's Adventures in Wonderland",
  authors:[{name:'Carroll, Lewis'}],languages:['en'],copyright:false,media_type:'Text',
  formats:{'image/jpeg':'https://www.gutenberg.org/cover.jpg','text/plain; charset=utf-8':'https://www.gutenberg.org/ebooks/11.txt.utf-8'},
  download_count:1234
};
test('book summary includes readable status and source',()=>{
  const b=bookSummary(fixture);
  assert.equal(b.readable,true);
  assert.equal(b.id,11);
  assert.match(b.sourceUrl,/gutenberg.org\/ebooks\/11$/);
  assert.equal(bookSummary({...fixture,copyright:true}).readable,false);
});
test('catalog uses server-side filters and excludes copyrighted books',async()=>{
  const original=global.fetch;
  try{
    global.fetch=async url=>{
      const u=new URL(url);
      assert.equal(u.hostname,'gutendex.com');
      assert.equal(u.searchParams.get('copyright'),'false');
      assert.equal(u.searchParams.get('languages'),'ru');
      return new Response(JSON.stringify({count:2,next:null,results:[fixture,{...fixture,id:12,copyright:true}]}),{status:200});
    };
    const res=response();
    await booksApi({method:'GET',query:{lang:'ru',page:'1'}},res);
    assert.equal(res.code,200);
    assert.equal(res.data.books.length,1);
    assert.equal(res.data.books[0].id,11);
  }finally{global.fetch=original;}
});
test('text endpoint reads only verified Gutenberg URLs',async()=>{
  const original=global.fetch;
  const text='*** START OF THE PROJECT GUTENBERG EBOOK ALICE ***\n\n'+'Alice and her cat. '.repeat(100)+'\n*** END OF THE PROJECT GUTENBERG EBOOK ALICE ***';
  try{
    global.fetch=async url=>{
      if(String(url).startsWith('https://gutendex.com/books/11'))return new Response(JSON.stringify(fixture),{status:200});
      if(String(url).startsWith('https://www.gutenberg.org/ebooks/11.txt'))return new Response(text,{status:200});
      throw new Error('Unexpected URL '+url);
    };
    const res=response();
    await booksApi({method:'GET',query:{mode:'text',id:'11'}},res);
    assert.equal(res.code,200);
    assert.equal(res.data.ok,true);
    assert.equal(res.data.book.id,11);
    assert.ok(res.data.text.includes('Alice and her cat.'));
  }finally{global.fetch=original;}
});
test('text endpoint rejects malicious redirects',async()=>{
  const original=global.fetch;
  try{
    global.fetch=async url=>{
      if(String(url).startsWith('https://gutendex.com/books/11'))return new Response(JSON.stringify(fixture),{status:200});
      return new Response('',{status:302,headers:{Location:'https://example.org/private'}});
    };
    const res=response();
    await booksApi({method:'GET',query:{mode:'text',id:'11'}},res);
    assert.equal(res.code,502);
    assert.equal(res.data.ok,false);
  }finally{global.fetch=original;}
});
test('invalid input rejected before calling upstream',async()=>{
  const original=global.fetch;
  global.fetch=()=>{throw new Error('must not fetch');};
  try{
    const res=response();
    await booksApi({method:'GET',query:{mode:'text',id:'-10'}},res);
    assert.equal(res.code,400);
    const res2=response();
    await booksApi({method:'POST',query:{}},res2);
    assert.equal(res2.code,405);
  }finally{global.fetch=original;}
});
