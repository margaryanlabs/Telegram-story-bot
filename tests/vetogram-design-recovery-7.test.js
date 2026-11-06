import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('mobile Books does not supersize its first product card',()=>{
  const styles=read('books-art-direction.css');
  assert.doesNotMatch(styles,/body\[data-books-source="complete"\] \.book:first-child/);
  assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  const source=read('books.js');
  assert.match(source,/node\('span','jacket-folio','VETOGRAM'\)/);
  assert.doesNotMatch(source,/ДИЗАЙН ЧИТАЛКИ|VETOGRAM READING/);
});

test('one obsidian background replaces the second blue messenger',()=>{
  const messenger=read('vetogram-messenger-calm.css');
  const embed=read('vetogram-media-embedded.css');
  const brand=read('vetogram-black-universe.css');
  assert.doesNotMatch(messenger,/#0c111b/i);
  assert.match(messenger,/body\.veto-chat-active\{\s*background:#000000!important/);
  assert.match(embed,/html\.v6-embedded\{--bg:#000;--shell:#000;/);
  assert.match(brand,/--vet-black:#000/);
});

test('music uses a single persistent host controller without duplicate embedded bar',()=>{
  const native=read('vetogram-music-native.css');
  const radio=read('vetogram-music-audio-only.css');
  const embed=read('vetogram-media-embedded.css');
  const host=read('vetogram-universe.js');
  assert.match(native,/\.native-home\{[^}]+background:#0f0f12/);
  assert.match(radio,/\.audio-home-panel\{[^}]+background:#111114/);
  assert.match(embed,/html\.v6-embedded \.player-bar\{display:none!important\}/);
  assert.match(host,/const show=!!lastAudio;/);
  assert.doesNotMatch(read('vetogram-black-universe.css'),/Nested music uses its own viewport/);
});

test('media navigation has four balanced desktop cards and two columns on phones',()=>{
  const css=read('vetogram-universe-61.css');
  assert.match(css,/\.v61-home \.v6-media-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.v61-home \.v6-media-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('games do not link to unsupported external Lovable deployments',()=>{
  const shell=read('studio.html');
  const registry=read('vetogram-play-registry.js');
  assert.doesNotMatch(shell,/https:\/\/[^"'\s]+lovable\.app/);
  assert.match(shell,/Скоро внутри Vetogram/);
  assert.match(shell,/В разработке для Vetogram/);
  assert.match(registry,/kind:'upcoming'/);
  assert.doesNotMatch(registry,/kind:'external'/);
  for(const id of ['reaction','pairs','tic','2048']){
    const pattern=new RegExp('vp-game-art vp-game-art-'+id+'["]');
    assert.match(shell,pattern);
  }
});

test('Cinema defaults to new-year-first and preserves original source metadata',()=>{
  const shell=read('cinema.html'),source=read('cinema.js');
  assert.match(shell,/<option value="year" selected>/);
  assert.match(source,/sort:"year"/);
  assert.match(source,/function displayFilmTitle\(f\)/);
  assert.match(source,/text\("cinemaDetailsTitle",displayFilmTitle\(f\)\)/);
  assert.match(source,/raw source title intact for attribution\/search/);
});

test('reader appearance changes do not alter user-selected light and sepia modes',()=>{
  const css=read('vetogram-black-universe.css');
  assert.match(css,/reader:not\(\[data-theme="light"\]\):not\(\[data-theme="sepia"\]\)/);
  assert.match(read('books.css'),/reader\[data-theme="light"\]/);
});
