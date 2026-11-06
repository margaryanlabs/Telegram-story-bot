import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const catalog=readFileSync(new URL('../public/vetogram-music-catalog.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-editorial-80.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/music-module.html',import.meta.url),'utf8');
function setup(){
 const actions=['covers','list'].map(x=>({
   dataset:{v83View:x},
   attrs:{},
   toggled:null,handlers:{},
   addEventListener(k,fn){this.handlers[k]=fn},
   click(){this.handlers.click?.()},
   setAttribute(k,v){this.attrs[k]=v},
   classList:{toggle(k,v){this.owner.toggled=v;}}
 }));
 actions.forEach(b=>b.classList.owner=b);
 const layout={querySelectorAll:()=>actions};
 const list={dataset:{}};
 const $=id=>id==='v83CatalogLayout'?layout:null;
 const first=catalog.indexOf('const layout=$("v83CatalogLayout")');
 const end=catalog.indexOf('function textNode(tag,cls,value)',first);
 assert.ok(first>=0&&end>first);
 const script=catalog.slice(first,end)+';({setCatalogMode,mode:()=>displayMode});';
 const {setCatalogMode,mode}=runInNewContext(script,{$,list});
 return {actions,layout,list,setCatalogMode,mode};
}
test('music catalog uses its existing actual artist/artwork data, not generated songs',()=>{
 assert.match(catalog,/track\.artwork/);
 assert.match(catalog,/img\.src=track\.artwork/);
 assert.match(catalog,/V\.play\(track,items\.filter/);
 assert.match(catalog,/V\.toggleLike\(track\)/);
 assert.match(catalog,/window\.VetogramMusicSocial\?\.shareTrack/);
 assert.doesNotMatch(catalog,/new Audio\(/);
 assert.match(html,/id="v83CatalogLayout"/);
 assert.equal((html.match(/data-v83-view="/g)||[]).length,2);
});
test('initial catalog layout displays cover grid and exposes active accessibility state',()=>{
 const x=setup();
 assert.equal(x.mode(),'covers');
 assert.equal(x.list.dataset.viewMode,'covers');
 assert.equal(x.actions[0].attrs['aria-pressed'],'true');
 assert.equal(x.actions[1].attrs['aria-pressed'],'false');
});
test('switching modes changes only presentation and keeps each track DOM in place',()=>{
 const x=setup();
 assert.equal(x.setCatalogMode('list'),true);
 assert.equal(x.list.dataset.viewMode,'list');
 assert.equal(x.actions[0].attrs['aria-pressed'],'false');
 assert.equal(x.actions[1].attrs['aria-pressed'],'true');
 assert.equal(x.setCatalogMode('covers'),true);
 assert.equal(x.list.dataset.viewMode,'covers');
 assert.equal(x.setCatalogMode('evil'),false);
 assert.equal(x.list.dataset.viewMode,'covers');
});
test('cover gallery has true square artwork and readable responsive two-column mobile grid',()=>{
 assert.match(css,/\.catalog-list\[data-view-mode="covers"\]/);
 assert.match(css,/aspect-ratio:1\/1/);
 assert.match(css,/object-fit:cover/);
 assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.catalog-list\[data-view-mode="list"\]/);
 assert.match(css,/:focus-visible/);
 assert.equal(css.split('{').length,css.split('}').length);
});
