import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const reader=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/books.css',import.meta.url),'utf8');

const start=reader.indexOf('  function parseBookmarkToken(token){');
const end=reader.indexOf('  async function jumpToReadingPoint(',start);
assert.ok(start>=0&&end>start,'Reading bookmark parser missing');
const parseBookmarkToken=new Function(reader.slice(start,end)+'return parseBookmarkToken;')();

test('VETO Compass opens offsets and legacy page bookmarks',()=>{
  assert.deepEqual(parseBookmarkToken('root:@1234'),{chapter:null,offset:1234,page:null});
  assert.deepEqual(parseBookmarkToken('0:@401'),{chapter:0,offset:401,page:null});
  assert.deepEqual(parseBookmarkToken('2:8'),{chapter:2,offset:null,page:8});
  assert.deepEqual(parseBookmarkToken('root:0'),{chapter:null,offset:null,page:0});
});
test('VETO Compass rejects corrupt or injected bookmarks',()=>{
  for(const key of ['','broken','0:-1','root:abc','0:@x','9000:missing','1:2;alert(1)'])
    assert.equal(parseBookmarkToken(key),null,key);
});
test('Compass has real reader controls and text-only search renderer',()=>{
  assert.match(html,/id="readerCompassButton"/);
  assert.match(reader,/function showReaderCompass\(\)/);
  assert.match(reader,/function jumpToReadingPoint\(target\)/);
  assert.match(reader,/function highlightReadingMatch\(value\)/);
  assert.match(reader,/textContent/);
  assert.match(reader,/document\.createTextNode/);
  assert.match(css,/\.compass-section/);
  assert.match(css,/\.reader-search-mark/);
});
test('offline EPUB pager does not disable Next while another chapter remains',()=>{
  const next=reader.match(/const nextChapter=chaptersAvailable[\s\S]{0,230};/)?.[0]||'';
  assert.match(next,/state\.activeChapter<state\.chapters\.length-1/);
  assert.match(reader,/const previousChapter=chaptersAvailable/);
  assert.match(reader,/isLocal\(state\.current\)/);
});
