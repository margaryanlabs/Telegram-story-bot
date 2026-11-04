import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,runInNewContext} from 'node:vm';

const source=await readFile(new URL('../v10/constellation-system.js',import.meta.url),'utf8');
const css=await readFile(new URL('../v10/explainable-constellations-v11.css',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');

function setup(){
  class Element {
    constructor(tag){
      this.tagName=tag;this.children=[];this.attributes={};this.style={};this.className='';
      this.classList={add:name=>{this.className=[...new Set([...this.className.split(' '),name].filter(Boolean))].join(' ')},
        toggle:(name,value)=>{const a=new Set(this.className.split(' ').filter(Boolean));if(value)a.add(name);else a.delete(name);this.className=[...a].join(' ');return value;}};
      this.textContent='';
    }
    setAttribute(name,value){this.attributes[name]=String(value)}
    append(...items){this.children.push(...items)}
    prepend(...items){this.children.unshift(...items)}
    replaceChildren(...items){this.children=[...items]}
  }
  const host=new Element('section');const visits=[];
  const fakeDocument={
    querySelector:selector=>selector==='.v77-threads'?host:null,
    createElement:tag=>new Element(tag),
    createElementNS:(_,tag)=>new Element(tag)
  };
  const ctx={window:{MarketV10:{data:{
    themes:{Risk:'Риск',Discipline:'Дисциплина',Patience:'Терпение',FOMO:'FOMO'},
    provenance:record=>record.local?'Локально':'Проверяемый тип: '+record.type
  }}},document:fakeDocument};
  runInNewContext(source,ctx);
  const star={id:'origin',alias:'ORBIT',market:'BTC',category:'Risk',type:'fictional'};
  const same={id:'same',alias:'ALPHA',market:'BTC',category:'Risk',type:'fictional'};
  const next={id:'next',alias:'BRAVO',market:'ETH',category:'Discipline',type:'editorial'};
  const other={id:'other',alias:'CHARLIE',market:'SOL',category:'FOMO',type:'editorial'};
  const records=[
    {story:same,index:1,relation:'Общая тема'},
    {story:next,index:2,relation:'Следующий урок'},
    {story:other,index:3,relation:'Редакционный взгляд'}
  ];
  const api={guided:()=>false,related:()=>records,follow:(i,relation)=>visits.push([i,relation])};
  function find(cls){
    const found=[];
    const visit=item=>{if(item.className?.split(' ').includes(cls))found.push(item);item.children.forEach(visit)};
    visit(host);return found;
  }
  return {host,star,same,next,other,records,api,visits,find,component:ctx.window.MarketV10.constellations};
}

test('V11.7 loads the explainable constellation layer on top of the existing reader',()=>{
  assert.doesNotThrow(()=>new Script(source));
  assert.match(html,/EXPLAINABLE CONSTELLATIONS \/ OBSERVATORY № 11\.7/);
  assert.match(html,/v10\/explainable-constellations-v11\.css/);
  assert.match(html,/v10\/memory-trails\.js/);
  assert.match(css,/@media\(max-width:819px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Explanations use only supported category relations and never real-world ties',()=>{
  const {component,star,same,next,other}=setup();
  const sameEvidence=component.explain(star,same,'Общая тема');
  assert.match(sameEvidence,/одной редакционной категории: «Риск»/);
  assert.match(sameEvidence,/рынок «BTC»/);
  const seq=component.explain(star,next,'Следующий урок');
  assert.match(seq,/Редакционная последовательность/);
  assert.match(seq,/Риск/);
  assert.match(seq,/Дисциплина/);
  assert.match(seq,/не причинно-следственная связь/);
  assert.match(component.explain(star,other,'Редакционный взгляд'),/Персонаж и сюжет вымышлены/);
  assert.match(component.explain(star,other,'Другой опыт'),/Связь навигационная/);
});

test('Selecting a link updates evidence and visual focus without opening a story',()=>{
  const {component,star,api,find,visits}=setup();
  component.mount(star,api);
  assert.equal(find('v117-star').length,3);
  assert.equal(find('v117-inspect').length,3);
  assert.equal(find('v117-follow').length,3);
  assert.equal(find('v117-link-row').length,3);
  const evidence=find('v117-evidence-body')[0];
  assert.match(evidence.textContent,/Риск/);
  const inspectors=find('v117-inspect');
  inspectors[1].onclick();
  assert.equal(visits.length,0);
  assert.match(evidence.textContent,/Дисциплина/);
  assert.equal(inspectors[1].attributes['aria-pressed'],'true');
  assert.equal(inspectors[0].attributes['aria-pressed'],'false');
  assert.match(find('v117-star')[1].className,/is-highlighted/);
  assert.equal(find('v117-constellation-map')[0].children[0].children.filter(x=>x.className.includes('is-active')).length,1);
});

test('Clicking the highlighted star or its Open button calls only the existing route',()=>{
  const {component,star,api,find,visits}=setup();
  component.mount(star,api);
  find('v117-star')[2].onclick();
  find('v117-follow')[0].onclick();
  assert.deepEqual(visits,[[3,'Редакционный взгляд'],[1,'Общая тема']]);
});

test('Guided mode cannot be redirected and user-supplied local content is not published',()=>{
  const {component,star,api,host,find}=setup();
  api.guided=()=>true;component.mount(star,api);
  assert.equal(host.children.length,0);
  assert.equal(find('v117-star').length,0);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage/);
  assert.doesNotMatch(source,/\.innerHTML\s*=/);
});
