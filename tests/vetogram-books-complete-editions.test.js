import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/books-art-direction.css',import.meta.url),'utf8');
const importer=readFileSync(new URL('../public/books-import.js',import.meta.url),'utf8');

function readCurated(){
  const first=js.indexOf('  const verifiedWholeEditions=');
  const last=js.indexOf('  function setSourceInfo(){',first);
  assert.ok(first>0 && last>first, 'Curated editions module not found');
  const code=js.slice(first,last);
  return new Function(code+'\nreturn {verifiedWholeEditions,completeEditionBooks,filterCompleteEditionBooks};')();
}
test('reader first shelf is real complete-source books, not excerpt search results',()=>{
  const {verifiedWholeEditions,completeEditionBooks,filterCompleteEditionBooks}=readCurated();
  assert.equal(verifiedWholeEditions.length,18);
  assert.equal(new Set(verifiedWholeEditions.map(x=>x[0])).size,verifiedWholeEditions.length);
  assert.ok(verifiedWholeEditions.every(([id,title,author,chars])=>
    Number.isSafeInteger(id)&&id>0&&title.length>4&&author.length>2&&chars>100000));
  assert.ok(completeEditionBooks.every(b=>
    b.provider==='wikisource'&&b.language==='ru'&&b.curatedWholeText&&b.readable));
  assert.equal(filterCompleteEditionBooks('Дюма').length,6);
  assert.equal(filterCompleteEditionBooks('Жюль Верн')[0].id,1012811);
  assert.equal(filterCompleteEditionBooks('несуществующий автор').length,0);
});
test('brand is the original real split-V Vetogram SVG in book cover and navbar',()=>{
  assert.match(html,/class="brand-symbol"><img src="\/veto-telegram-mark\.svg"/);
  assert.match(html,/class="world-book-logo"><img src="\/veto-telegram-mark\.svg"/);
  assert.match(html,/data-books-source="complete"/);
  assert.match(html,/books-art-direction\.css/);
  assert.match(css,/\.book:first-child/);
  assert.match(css,/\.world-book-logo img/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
test('whole book source offers both native offline pack and official WS Export',()=>{
  assert.match(html,/id="readerSaveAllChapters"/);
  assert.match(html,/id="readerOfficialEpub"/);
  assert.match(js,/function officialWikisourceEpubUrl\(book\)/);
  assert.match(js,/async function saveWholeEditionOffline\(\)/);
  assert.match(js,/if\(!response\.ok\|\|!payload\.ok\|\|!payload\.text\)/);
  assert.match(importer,/async function saveWikisourceEdition\(sourceBook,chapters,contents\)/);
  assert.match(importer,/saveWikisourceEdition,get,list,remove/);
});
