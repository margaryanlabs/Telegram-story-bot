/* Vetogram V9.8 regression: accurate poster sources and accessible modal return. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const code=read('cinema.js');
function extract(begin,end){
 const a=code.indexOf(begin),b=code.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,begin+' is missing');
 return code.slice(a,b);
}

test('Cinema detail sheet uses existing HTTPS catalog artwork and retries broken posters',()=>{
 const posterFunction=new Function('state','failedPosterUrls',
  extract('  function detailPosterUrl(f){','  function openDetails(f){')+';return detailPosterUrl;');
 const cache=new Map([['a','https://assets.test/verified.png']]);
 const failed=new Set();
 const choose=posterFunction({posters:cache},failed);
 assert.equal(choose({id:'a',poster:'https://assets.test/fallback.jpg'}),'https://assets.test/verified.png');
 failed.add('https://assets.test/verified.png');
 assert.equal(choose({id:'a',poster:'https://assets.test/fallback.jpg'}),'https://assets.test/fallback.jpg');
 assert.equal(choose({id:'other',poster:'javascript:alert(1)'}),null);
 assert.equal(choose({id:'other',poster:'http://example.test/poster.png'}),null);
 assert.equal(choose({id:'other',poster:'https://assets.test/real.png'}),'https://assets.test/real.png');
 const filmSheet=extract('  function openDetails(f){','  function closeDetails(){');
 assert.match(filmSheet,/const poster=detailPosterUrl\(f\)/);
 assert.match(filmSheet,/art\.prepend\(image\)/);
 assert.match(filmSheet,/if\(!f\.discoveryOnly&&!f\.externalRutube\)requestPoster\(f\)/);
 const css=read('vetogram-v9-explore.css');
 assert.match(css,/cinema-sheet-art img\{[^}]*object-fit:contain/s);
});

test('Cinema restores focus to original opener or a valid fallback',()=>{
 const restore=new Function('$',
  extract('  function restoreFocus(target,fallback){','  function detailPosterUrl(f){')+
  ';return restoreFocus;')(id=>id==='cinemaHeroWatch'?{
   isConnected:true,focus(){this.called=true}
  }:null);
 let opens=0;
 const opener={isConnected:true,focus(opts){opens++;assert.equal(opts.preventScroll,true)}};
 restore(opener,'cinemaHeroWatch');
 assert.equal(opens,1);
 const cinema=read('cinema.js');
 assert.match(cinema,/detailReturnFocus=document\.activeElement/);
 assert.match(cinema,/restoreFocus\(origin,"cinemaHeroWatch"\)/);
 assert.match(cinema,/restoreFocus\(playerReturnFocus,state\.selected\?"cinemaDetailsWatch":"cinemaHeroWatch"\)/);
 assert.match(cinema,/cinemaDetailsClose"\)\.focus/);
});

test('Reader returns focus after closing and never targets hidden Continue shelf',()=>{
 const books=read('books.js');
 assert.match(books,/readerReturnFocus=document\.activeElement/);
 assert.match(books,/readerBack'\)\.focus/);
 assert.match(books,/const target=previous\?\.isConnected\?previous:\(!\$\('continueShelf'\)\?\.hidden\?\$\('continueAction'\):\$\('bookSearch'\)\)/);
 assert.match(books,/target\.focus\(\{preventScroll:true\}\)/);
 const page=read('books.html');
 assert.match(page,/id="readerBack"/);
 assert.match(page,/id="continueShelf"[^>]*hidden/);
});
