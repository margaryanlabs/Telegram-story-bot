import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const [html,reader,trails,css,pkg]=await Promise.all([
  read('index.html'),read('v10/story-experience.js'),read('v10/memory-trails.js'),
  read('v10/v12-reading-polish.css'),read('package.json')
]);

class Element{
  constructor(tag,className=''){
    this.tagName=tag;this.className=className;this.children=[];this.parent=null;
    this.attributes={};this.style={};this.open=false;
    this.classList={
      add:name=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),name])].join(' ')},
      remove:name=>{this.className=this.className.split(' ').filter(part=>part!==name).join(' ')}
    };
  }
  append(...els){for(const el of els){el.remove();el.parent=this;this.children.push(el)}}
  prepend(...els){for(const el of [...els].reverse()){el.remove();el.parent=this;this.children.unshift(el)}}
  after(el){if(!this.parent)throw Error('orphan');el.remove();const siblings=this.parent.children;const i=siblings.indexOf(this);siblings.splice(i+1,0,el);el.parent=this.parent}
  remove(){if(this.parent){const c=this.parent.children;const i=c.indexOf(this);if(i>=0)c.splice(i,1);this.parent=null}}
  setAttribute(name,value){this.attributes[name]=String(value)}
  querySelector(selector){const cls=selector.startsWith('.')?selector.slice(1):null;const match=el=>cls&&el.className.split(' ').includes(cls);const q=[...this.children];while(q.length){const el=q.shift();if(match(el))return el;q.unshift(...el.children)}return null}
}

function setup(){
  const article=new Element('article','memory-experience');
  const top=new Element('div','memory-topline');
  const hero=new Element('section','v12-memory-hero');
  const old=new Element('section','v93-observatory');
  article.append(top,hero,old);
  const drawer={querySelector:selector=>selector==='.memory-experience'?article:null};
  const document={
    getElementById:id=>id==='drawer'?drawer:null,
    createElement:tag=>new Element(tag)
  };
  const context={document,window:{localStorage:null,MarketV10:{data:{themes:{Risk:'Риск'}}}}};
  runInNewContext(trails,context);
  const record={id:'record-one',type:'fictional',alias:'SIGNAL',category:'Risk'};
  const api={stories:[record],travel(){},toast(){}};
  return {article,context,record,api};
}

test('V12 RC3 provides one clear story entry point and preserves trusted controls',()=>{
  assert.equal(JSON.parse(pkg).version,'12.0.0-rc.6');
  assert.match(html,/v10\/v12-reading-polish\.css/);
  assert.ok(html.indexOf('v10/v12-reading-polish.css')>html.indexOf('v10/v12-cinematic.css'));
  assert.match(reader,/start\.textContent='Читать историю ↓'/);
  assert.match(reader,/start\.onclick=\(\)=>jumpToChapter\(0\)/);
  assert.match(reader,/read\.textContent='Читать источник ↓'/);
  assert.match(reader,/legendHero\.append\(read\)/);
  assert.match(reader,/actions\.append\(returnButton\)/);
  assert.match(reader,/actions\.append\(link\)/);
  assert.doesNotThrow(()=>new Script(reader));
});

test('Exploration trail is actually inserted after artifact, never over its headline',()=>{
  const {article,context,record,api}=setup();
  context.window.MarketV10.trails.onStory(record,api);
  assert.deepEqual(article.children.map(el=>el.className),[
    'memory-topline','v12-memory-hero','v116-trail','v93-observatory'
  ]);
  const panel=article.querySelector('.v116-trail');
  assert.equal(panel.children[0].tagName,'summary');
  assert.match(panel.children[0].textContent,/МАРШРУТ ИССЛЕДОВАНИЯ/);
  assert.equal(panel.children[3].children[0].disabled,true);
});

test('Legacy story layouts still receive routes without requiring a V12 artifact',()=>{
  const {article,context,record,api}=setup();
  article.querySelector('.v12-memory-hero').remove();
  context.window.MarketV10.trails.onStory(record,api);
  assert.deepEqual(article.children.map(el=>el.className),[
    'memory-topline','v116-trail','v93-observatory'
  ]);
});

test('Duplicated old visual identity is removed only when V12 artifact exists',()=>{
  assert.match(reader,/article\.classList\.toggle\('v12-artifact-active',!!article\.querySelector\('\.v12-memory-hero'\)\)/);
  assert.match(css,/\.memory-experience\.v12-artifact-active \.v93-observatory/);
  assert.match(css,/display:none!important/);
  assert.match(css,/\.v12-start-reading:focus-visible/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(max-width:370px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Reader navigation scroll stays inside drawer and respects reduced motion',()=>{
  assert.match(reader,/panel\.scrollTo\(\{top:Math\.max\(0,offset\),behavior:window\.MarketV10\.motion\.reduced/);
  assert.match(reader,/contextSection\.focus\(\{preventScroll:true\}\)/);
  assert.match(reader,/drawer\.scrollTo\(\{top:Math\.max\(0,offset\),behavior:window\.MarketV10\.motion\.reduced/);
});
