import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/books-jacket-studio.css',import.meta.url),'utf8');

function element(tag,classes='',text=''){
  return {tag,classes,textContent:text,children:[],dataset:{},attributes:{},
    classList:{add(...values){this.values=[...(this.values||[]),...values];}},
    replaceChildren(...items){this.children=items},
    append(...items){this.children.push(...items)},
    setAttribute(name,value){this.attributes[name]=value}};
}
const start=js.indexOf('  const jacketProfiles=Object.freeze(');
const end=js.indexOf('  function updateSavedCount()',start);
assert.ok(start>=0 && end>start,'Editorial cover generator absent');
const code=js.slice(start,end);
const build=new Function('node','compactTitle','fullName',
  code+'\nreturn {jacketProfile,coverArtwork};')(
    element,title=>String(title).slice(0,160),
    book=>(book.authors||[]).join(', '));
const book=(id,title)=>({id,title,authors:['Автор'],language:'ru'});

test('hand-designed visual profile respects actual curated works',()=>{
  assert.deepEqual(build.jacketProfile(book(17623,'Белые ночи')),{motif:'moon',tone:'night'});
  assert.deepEqual(build.jacketProfile(book(1012811,'Золотой вулкан')),{motif:'volcano',tone:'amber'});
  assert.deepEqual(build.jacketProfile(book(1002606,'Дама с камелиями')),{motif:'bloom',tone:'rose'});
  assert.notDeepEqual(build.jacketProfile(book(17623,'Белые ночи')),build.jacketProfile(book(1012811,'Золотой вулкан')));
});
test('other books receive stable original artwork without a paid image dependency',()=>{
  const sample=book(800091,'История из далёкой страны');
  const chosen=build.jacketProfile(sample);
  assert.deepEqual(chosen,build.jacketProfile(sample));
  const target=element('div');
  build.coverArtwork(target,sample);
  assert.equal(target.dataset.motif,chosen.motif);
  assert.equal(target.dataset.tone,chosen.tone);
  assert.equal(target.children.length,5);
  assert.ok(target.children.some(n=>n.classes==='jacket-title'&&n.textContent===sample.title));
  assert.ok(!target.children.some(n=>String(n.textContent).includes('LIBRARY EDITION')));
});
test('real source images overlay rather than replace local covers',()=>{
  assert.match(js,/coverArtwork\(cover,book\)/);
  assert.match(js,/source-edition-cover/);
  assert.match(js,/img\.onerror=\(\)=>img\.remove\(\)/);
  assert.match(css,/\.book-cover\.editorial-cover \.source-edition-cover/);
  assert.match(css,/data-motif="volcano"/);
  assert.match(css,/data-motif="bloom"/);
  assert.match(css,/data-motif="fortress"/);
});
test('hero and featured shelf use real readable works and real logo',()=>{
  assert.match(html,/src="\/veto-telegram-mark\.svg"/);
  assert.match(html,/id="heroShowcase"/);
  assert.match(html,/id="featuredEditionGrid"/);
  assert.match(html,/books-jacket-studio\.css\?v=2/);
  assert.match(js,/function renderHeroShowcase\(\)/);
  assert.match(js,/function renderFeaturedEditions\(\)/);
  assert.match(js,/openBook\(book\)/);
  assert.doesNotMatch(html,/THE<br>UNKNOWN|NO<br>LIMITS/);
});
test('mobile layout and reduced-motion styles are available',()=>{
  assert.match(css,/@media\(max-width:449px\)/);
  assert.match(css,/@media\(max-width:690px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/focus-visible/);
});
