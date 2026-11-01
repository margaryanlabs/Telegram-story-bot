import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const jackets=read('books-jacket-studio.css');
const embedded=read('vetogram-media-embedded.css');
const noir=read('vetogram-black-universe.css');
const universe=read('vetogram-universe-61.css');
const cinema=read('cinema.js');

test('books remain exactly two columns from 320px through 600px',()=>{
 assert.match(jackets,/@media\(max-width:600px\)\{\.book-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(jackets,/@media\(min-width:601px\) and \(max-width:699px\)\{\.book-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.doesNotMatch(jackets,/@media\(min-width:450px\) and \(max-width:699px\)/);
 assert.doesNotMatch(read('books-art-direction.css'),/\.book:first-child/);
});

test('books keep a real subtle surface and scroll past bottom host chrome',()=>{
 assert.match(jackets,/background:#0f0f12!important;border:1px solid #ffffff17!important/);
 assert.match(embedded,/html\.v6-embedded \.books-main\{padding:16px 16px calc\(115px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/);
});

test('cinema source-less poster titles remain readable without fake art',()=>{
 assert.match(noir,/\.cinema-card-art:not\(:has\(img\)\) \.cinema-card-art-title\{/);
 assert.match(noir,/display:-webkit-box!important/);
 assert.match(noir,/\.cinema-card-art:has\(img\) \.cinema-card-art-title\{[\s\S]*?display:none!important/);
});

test('mobile media tiles have room for recognisable illustrations',()=>{
 assert.match(universe,/\.v6-world-art\{height:78px;width:100%;min-height:78px/);
 assert.match(universe,/\.v6-world\{display:flex;flex-direction:column;min-height:190px/);
 assert.match(universe,/\.v6-media-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('movie cards do not claim unverified dubbing or playback',()=>{
 assert.match(cinema,/f\.player\?\.licensed===true\|\|Boolean\(f\.file\)\)\?"В ПЛЕЕРЕ":"ОПИСАНИЕ"/);
 assert.match(cinema,/f\.russianAudio===true\?"РУССКАЯ ДОРОЖКА ЗАЯВЛЕНА":"ЯЗЫК У ИСТОЧНИКА"/);
 assert.doesNotMatch(cinema,/meta\.textContent=\[f\.year\|\|"Русский"/);
});

test('previously duplicated featured-grid patch comments are gone',()=>{
 const css=read('books-art-direction.css');
 assert.doesNotMatch(css,/Featured cards now use the same predictable grid as every other book/);
 assert.match(css,/All books share the responsive grid/);
});
