import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const file=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const js=file('vetogram-editorial-80.js');
const css=file('vetogram-editorial-80.css');
const pages=['cinema.html','music-module.html','books.html'].map(file);

function make(name){
 const nodes=new Map();
 function create(id){
   const n={id,parentNode:null,children:[],dataset:{},classList:{added:[],add(k){this.added.push(k)}},
    setAttribute(k,v){this[k]=v;},
    querySelector(sel){return this.queries?.[sel]??null;},
    insertBefore(item,anchor){
     if(item.parentNode){
       const pos=item.parentNode.children.indexOf(item);
       if(pos>=0)item.parentNode.children.splice(pos,1);
     }
     const ix=this.children.indexOf(anchor);if(ix<0)throw Error('anchor not child');
     this.children.splice(ix,0,item);item.parentNode=this;
    }
   };nodes.set(id,n);return n;
 }
 function attach(parent,...children){parent.children.push(...children);children.forEach(x=>x.parentNode=parent)}
 const root=create('v78MediaHub');root.dataset.v78Module=name;
 const main=create('main');
 const document={
  getElementById:id=>nodes.get(id)||null,
  querySelector:sel=>({
    '.cinema-shell main':name==='cinema'?main:null,
    '.page[data-view="home"]':name==='music'?main:null,
    '.books-main .source-tabs':name==='books'?nodes.get('tabs'):null
  })[sel]??null,
  body:{classList:{added:[],add(...xs){this.added.push(...xs)}}},
  documentElement:{dataset:{}}
 };
 if(name==='cinema'){
   const hero=create('hero'),nav=create('nav'),search=create('cinemaSearchArea'),
    watch=create('cinemaWatchNow'),genres=create('cinemaGenresSection'),latest=create('cinemaLatest');
   main.queries={'.cinema-section-nav':nav};
   attach(main,hero,root,nav,search,watch,genres,latest);
 } else if(name==='music'){
   const hero=create('hero'),secondary=create('secondary'),tracks=create('licensedHomeSection');
   main.queries={'.native-home':secondary};secondary.classList={added:[],add(k){this.added.push(k)}};
   attach(main,hero,root,secondary);attach(secondary,tracks);
 } else {
   const hero=create('hero'),featured=create('featuredEditions'),tabs=create('tabs');
   attach(main,hero,root,featured,tabs);
 }
 runInNewContext(js,{document});
 return {nodes,main,document};
}
test('all three existing media entrypoints load editorial 8.0 after legacy styles and scripts',()=>{
 for(const html of pages){
   assert.match(html,/vetogram-editorial-80\.css\?v=20261102-media84/);
   assert.match(html,/vetogram-editorial-80\.js\?v=20261102-media84/);
   assert.ok(html.indexOf('vetogram-media-next-78.css')<html.indexOf('vetogram-editorial-80.css'));
   assert.ok(html.indexOf('vetogram-media-next-78.js')<html.indexOf('vetogram-editorial-80.js'));
 }
});
test('Cinema shows real posters, genre navigation and film rails before secondary promotional controls',()=>{
 const x=make('cinema'),order=x.main.children.map(n=>n.id);
 assert.deepEqual(order,['hero','nav','cinemaSearchArea','cinemaWatchNow','cinemaGenresSection','cinemaLatest','v78MediaHub']);
 assert.match(css,/\.cinema-card-art>img/);
 assert.match(css,/object-fit:cover/);
});
test('Music puts real licensed playable audio before duplicated promotion without replacing the original nodes',()=>{
 const x=make('music'),order=x.main.children.map(n=>n.id);
 assert.deepEqual(order,['hero','licensedHomeSection','v78MediaHub','secondary']);
 assert.equal(x.nodes.get('licensedHomeSection').parentNode,x.main);
 assert.ok(x.nodes.get('secondary').classList.added.includes('v80-secondary-discovery'));
 assert.match(css,/#licensedHomeTracks/);
});
test('Books promotes existing real covers and verified source filters while preserving the native reader',()=>{
 const x=make('books'),order=x.main.children.map(n=>n.id);
 assert.deepEqual(order,['hero','featuredEditions','tabs','v78MediaHub']);
 assert.match(css,/\.featured-edition-cover/);
 assert.match(css,/\.book-grid/);
 assert.match(css,/\.source-tabs/);
});

test('the integrated Media home also uses the same editorial design and returns saved Continue before discovery',()=>{
 const studio=file('studio.html');
 assert.match(studio,/vetogram-editorial-80\.css\?v=20261102-media84/);
 assert.match(studio,/vetogram-editorial-80\.js\?v=20261102-media84/);
 assert.match(css,/body\.vetogram-editorial-home/);
 const order=[];
 const discovery={id:'discovery'};
 const saved={id:'saved'};
 const home={
  querySelector:q=>q==='.v61-world-section'?discovery:null,
  insertBefore(node,anchor){order.push(node.id+' before '+anchor.id);}
 };
 const body={classList:{added:[],add(k){this.added.push(k);}}};
 const document={
  getElementById:id=>id==='v6MediaHome'?home:id==='v61Continue'?saved:null,body
 };
 runInNewContext(js,{document});
 assert.deepEqual(order,['saved before discovery']);
 assert.ok(body.classList.added.includes('vetogram-editorial-home'));
});
test('Style is responsive, artwork is source-backed and no fake media or privileged content is created',()=>{
 assert.equal(css.split('{').length,css.split('}').length);
 for(const width of ['980','620','360'])assert.match(css,new RegExp('max-width:'+width+'px'));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|window\.open|document\.cookie|localStorage|postMessage|innerHTML|Telegram/);
});

test('cinema genre categories display only actual existing catalog posters, never fabricated visual assets',()=>{
 const controller=file('cinema.js');
 assert.match(controller,/const representative=films\.find\(f=>matchesGenre\(f\)/);
 assert.match(controller,/const img=node\("img","v80-genre-image"\)/);
 assert.match(controller,/state\.posters\.get\(representative\.id\),representative\.poster/);
 assert.match(controller,/!failedPosterUrls\.has\(url\)/);
 assert.match(css,/\.cinema-genre-tile \.v80-genre-image/);
 assert.doesNotMatch(js,/https:\/\/|https:\\\/\\\//);
});

test('mobile first fold prioritizes real catalog after compact header for every module',()=>{
 const styles=css.slice(css.indexOf('/* V8.1 mobile first-fold cleanup'));
 assert.ok(styles.length>2000);
 for(const selector of ['.cinema-hero','.hero#hero','.hero-veto','.v72-media-hero']){
   assert.match(styles,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 }
 for(const value of ['min-height:230px','min-height:178px','min-height:209px','min-height:184px'])
   assert.ok(styles.includes(value),'missing mobile masthead limit '+value);
 assert.match(styles,/scroll-margin-top:82px/);
});
