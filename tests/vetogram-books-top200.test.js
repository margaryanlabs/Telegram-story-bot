import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('../public/books-top200.json',import.meta.url),'utf8'));
const js=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/books.css',import.meta.url),'utf8');

test('VETOGRAM top-200 contains exactly 200 individually identified works, not repeated placeholders',()=>{
  assert.equal(catalog.version,'1.0');
  assert.equal(catalog.isRanked,false);
  assert.equal(catalog.count,200);
  assert.equal(catalog.books.length,200);
  assert.equal(new Set(catalog.books.map(book=>book.id)).size,200);
  assert.equal(new Set(catalog.books.map(book=>book.title+'|'+book.authors.join(','))).size,200);
  assert.ok(catalog.books.every(book=>
    book.title&&book.authors.length&&book.provider==='editorial'&&
    book.language==='ru'&&book.readable===false&&book.access==='metadata'
  ));
});
test('exactly ten editorial genre rails with 20 works per genre',()=>{
  const genres=Object.keys(catalog.genres);
  assert.equal(genres.length,10);
  for(const genre of genres){
    assert.equal(catalog.books.filter(book=>book.genre===genre).length,20,genre);
  }
});
test('high-profile translated books are covered without asserting a fake sales ranking',()=>{
  for(const title of ['Четвёртое крыло','Ониксовый шторм','Дюна',
    'Гарри Поттер и философский камень','1984','Безмолвный пациент',
    'Зелёная миля','Дневник памяти','Убийство в «Восточном экспрессе»','Атомные привычки']){
    assert.ok(catalog.books.some(book=>book.title===title),title);
  }
  assert.match(catalog.disclaimer,/не статистический рейтинг/);
});
test('collection is a real frontend tab with pagination and limited network use',()=>{
  assert.match(html,/data-books-source="hot200"/);
  assert.match(html,/id="hotFilters"/);
  assert.match(html,/data-hot-genre="romantasy"/);
  assert.match(html,/data-hot-genre="nonfiction"/);
  assert.match(js,/function loadHotEditorial\(/);
  assert.match(js,/books-top200\.json/);
  assert.match(js,/matches\.slice\(start,start\+24\)/);
  assert.match(js,/state\.hotGenre===/);
  assert.match(css,/\.hot-filters/);
});
test('modern hits open bibliographic discovery, not unauthorized full text',()=>{
  assert.match(js,/function showEditorialBook\(book\)/);
  assert.match(js,/Найти русское издание|НАЙТИ РУССКОЕ ИЗДАНИЕ/);
  assert.match(js,/правообладателям/);
  assert.match(js,/provider==='editorial'/);
  assert.match(js,/books\.google\.com\/books\?q=/);
  assert.ok(catalog.books.every(book=>book.readable===false));
});
