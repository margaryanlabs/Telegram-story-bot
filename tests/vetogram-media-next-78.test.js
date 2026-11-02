import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../public/vetogram-media-next-78.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-media-next-78.css',import.meta.url),'utf8');
const pages=Object.fromEntries(['cinema','music-module','books'].map(x=>[x,readFileSync(new URL('../public/'+x+'.html',import.meta.url),'utf8')]));
function node(id=''){
  return {id,hidden:false,src:'',paused:true,value:'',textContent:'',attrs:{},dataset:{},calls:0,events:{},
    addEventListener(name,fn){const previous=this.events[name];this.events[name]=previous?(...args)=>{previous(...args);fn(...args);}:fn;},
    setAttribute(k,v){this.attrs[k]=v;},
    focus(){this.focused=true;},
    scrollIntoView(){this.scrolled=true;},
    click(){this.calls++;this.events.click?.();},
    appendChild(child){this.children??=[];this.children.push(child);},
    append(...children){this.children??=[];this.children.push(...children);},
    insertBefore(child){this.inserted=child;},
    replaceChildren(){this.children=[];}
  };
}
function make(which){
  const root=node('v78MediaHub');root.dataset.v78Module=which;
  const actionNames=which==='cinema'?['continue','series','search','library']:which==='music'?['search','library','radio','import']:['continue','discover','library','import'];
  const buttons=actionNames.map(x=>{const b=node();b.dataset.v78Action=x;return b;});
  root.querySelectorAll=q=>q==='[data-v78-action]'?buttons:[];
  const ids=['v78MediaHub','v78MediaStatus','continueShelf','continueAction','heroReadNow','myLibrary','bookSearch','cinemaSearch','audio','v78NowTitle','v78NowArtist','v78NowToggle','miniPlay','searchInput'];
  const elements=new Map(ids.map(x=>[x,node(x)]));elements.set('v78MediaHub',root);
  elements.get('v78NowToggle').disabled=true;
  const chosen=node();
  const document={getElementById:k=>elements.get(k)??null,querySelector:q=>q==='[data-books-source="complete"]'?chosen:null,addEventListener(){},createElement:()=>node()};
  const window={};
  runInNewContext(src,{document,window,Set,String,Number,Array});
  return {root,buttons,document,window,elements,chosen,act:name=>buttons.find(b=>b.dataset.v78Action===name).click()};
}
test('three real module documents contain complete navigation and the shared responsive style',()=>{
 for(const [page,html] of Object.entries(pages)){
  assert.match(html,/id="v78MediaHub"/,page);
  assert.equal((html.match(/id="v78MediaHub"/g)||[]).length,1);
  for(const name of page==='music-module'?['search','library']:['continue','library'])assert.match(html,new RegExp('data-v78-action="'+name+'"'),page);
  assert.match(html,/vetogram-media-next-78\.css\?v=20261102-media85/);
  assert.match(html,/vetogram-media-next-78\.js\?v=20261102-media85/);
 }
 for(const mode of ['cinema','music','books'])assert.match(css,new RegExp('v78-'+mode+'-portal'));
 assert.match(css,/max-width:600px/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.equal(css.split('{').length,css.split('}').length,'unbalanced CSS braces');
});
test('Cinema resumes an unfinished favorite from actual saved progress only',()=>{
 const ui=make('cinema');const calls=[];
 ui.window.VetogramCinema={
  openTab:x=>calls.push(['tab',x]),
  getLibrary:()=>[
    {id:'finished',title:'Finished',source:'progress',progress:1,at:50},
    {id:'older',title:'Old',source:'progress',progress:.4,at:10},
    {id:'favorite',title:'Saved film',source:'saved',progress:.35,at:20},
  ],
  openFilm:id=>{calls.push(['film',id]);return true;}
 };
 ui.act('continue');
 assert.equal(calls[0][0],'film');assert.equal(calls[0][1],'favorite');
 assert.match(ui.elements.get('v78MediaStatus').textContent,/Saved film/);
 ui.act('series');ui.act('library');ui.act('search');
 assert.equal(calls.at(-1)[1],'search');
 assert.equal(ui.elements.get('cinemaSearch').focused,true);
});
test('Cinema offers discovery without pretending to resume when history is empty',()=>{
 const ui=make('cinema'),tabs=[];
 ui.window.VetogramCinema={getLibrary:()=>[],openTab:x=>tabs.push(x)};
 ui.act('continue');
 assert.deepEqual(tabs,['catalog']);
 assert.match(ui.elements.get('v78MediaStatus').textContent,/пока нет/);
 const unloaded=make('cinema');unloaded.act('series');
 assert.match(unloaded.elements.get('v78MediaStatus').textContent,/загружается/);
});
test('Music action hub delegates navigation to the existing module',()=>{
 const ui=make('music');const calls=[];
 ui.window.VetogramMusic={showPage:p=>calls.push(p),now:()=>null};
 for(const id of ['search','library','radio','import'])ui.act(id);
 assert.deepEqual(calls,['search','library','radio','import']);
 assert.equal(ui.elements.get('searchInput').focused,true);
 assert.equal(ui.elements.get('v78NowToggle').disabled,true);
 assert.equal(ui.elements.get('miniPlay').calls,0);
});
test('Music play button reuses existing native player and never starts empty audio',()=>{
 const ui=make('music'),a=ui.elements.get('audio');
 let track=null;
 ui.window.VetogramMusic={now:()=>track,showPage(){}};
 const toggle=ui.elements.get('v78NowToggle');
 toggle.click();assert.equal(ui.elements.get('miniPlay').calls,0);
 track={title:'My tune',artist:'Author'};a.src='blob:owned-music';a.paused=false;
 a.events.playing();
 assert.equal(toggle.disabled,false);
 assert.equal(toggle.textContent,'Ⅱ');
 assert.equal(ui.elements.get('v78NowTitle').textContent,'My tune');
 toggle.click();
 assert.equal(ui.elements.get('miniPlay').calls,1);
 a.paused=true;a.events.pause();
 assert.equal(toggle.textContent,'▶');
});
test('Books continue opens a real saved page, or falls back to catalog when absent',()=>{
 const ui=make('books');
 ui.elements.get('continueShelf').hidden=false;
 ui.act('continue');assert.equal(ui.elements.get('continueAction').calls,1);
 ui.elements.get('continueShelf').hidden=true;
 ui.act('continue');assert.equal(ui.elements.get('heroReadNow').calls,1);
 assert.match(ui.elements.get('v78MediaStatus').textContent,/Нет сохранённой страницы/);
 ui.act('library');assert.equal(ui.elements.get('myLibrary').calls,1);
 ui.act('discover');assert.equal(ui.chosen.calls,1);assert.equal(ui.elements.get('bookSearch').focused,true);
 ui.window.VetogramBooks={showImport:()=>{ui.imported=true;}};
 ui.act('import');assert.equal(ui.imported,true);
});
test('Shared module has no fabricated remote sources or Telegram chat access',()=>{
 assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|document\.cookie|initData|telegram-chats|sendMessage|eval\s*\(/);
 assert.match(src,/window\.parent\.postMessage\(/);assert.match(src,/window\.location\.origin/);
 assert.match(src,/VetogramCinema/);assert.match(src,/VetogramMusic/);assert.match(src,/VetogramBooks/);
});

test('embedded module switcher navigates only to allowlisted same-origin Vetogram targets',()=>{
 const hub=node('v78MediaHub');hub.dataset.v78Module='cinema';
 const navButtons=[];
 const makeButton=()=>{
  const n=node();n.setAttribute=function(k,v){this.attrs[k]=v;};
  return n;
 };
 const document={
  getElementById:id=>id==='v78MediaHub'?hub:id==='v78MediaStatus'?node(id):null,
  createElement:tag=>{
   const el=makeButton();
   if(tag==='nav')el.appendChild=child=>navButtons.push(child);
   return el;
  },
  addEventListener(){}
 };
 let inserted=null;
 hub.querySelectorAll=()=>[];
 hub.insertBefore=(child)=>{inserted=child;};
 const sent=[];
 const parent={postMessage:(msg,origin)=>sent.push({msg,origin})};
 const window={parent,location:{origin:'https://vetogram.example'},VetogramMediaContext:{embedded:true}};
 runInNewContext(src,{document,window,Set,String,Number,Array});
 assert.ok(inserted,'navigation is added in the integrated context');
 assert.equal(navButtons.length,4);
 assert.equal(navButtons[0].attrs['aria-current'],'page');
 navButtons[0].click();
 assert.equal(sent.length,0,'active module must not reload itself');
 navButtons[1].click();
 navButtons[2].click();
 navButtons[3].click();
 assert.deepEqual(sent.map(x=>x.msg.module),['music','books',undefined]);
 assert.deepEqual(sent.map(x=>x.msg.target),['module','module','hub']);
 assert.ok(sent.every(x=>x.origin==='https://vetogram.example'));
 assert.match(css,/\.v79-media-switcher/);
});
test('standalone Cinema, Music and Books never post navigation to the parent',()=>{
 const hub=node('v78MediaHub');hub.dataset.v78Module='music';
 hub.querySelectorAll=()=>[];
 let called=false;
 const window={parent:{postMessage:()=>{called=true;}},VetogramMediaContext:{embedded:false}};
 const links=[];
 hub.insertBefore=nav=>{nav.inserted=true;};
 const document={getElementById:id=>id==='v78MediaHub'?hub:id==='v78MediaStatus'?node(id):null,addEventListener(){},
  createElement:tag=>{const n=node();if(tag==='nav')n.appendChild=link=>links.push(link);return n;}};
 runInNewContext(src,{document,window,Set,String,Number,Array});
 assert.equal(called,false);
 assert.equal(links.length,4,'standalone modules offer real media routes');
 assert.deepEqual(links.map(x=>x.href),['/cinema.html','/music-module.html','/books.html','/studio.html?screen=media']);
 links[0].click();links[2].click();links[3].click();
 assert.equal(called,false,'standalone links do not send parent messages');
 assert.equal(links[1].attrs['aria-current'],'page');
});
