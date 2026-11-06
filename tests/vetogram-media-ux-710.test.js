import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../public/vetogram-media-next-78.js',import.meta.url),'utf8');
const cinema=readFileSync(new URL('../public/cinema.html',import.meta.url),'utf8');
const music=readFileSync(new URL('../public/music-module.html',import.meta.url),'utf8');
const books=readFileSync(new URL('../public/books.html',import.meta.url),'utf8');
function el(){
 return {textContent:'',hidden:false,src:'',paused:true,value:0,max:100,
   attrs:{},style:{},children:[],handlers:{},dataset:{},disabled:false,calls:0,
   setAttribute(k,v){this.attrs[k]=v;},
   addEventListener(k,fn){this.handlers[k]=fn;},
   append(...values){this.children.push(...values);},
   appendChild(value){this.children.push(value);},
   replaceChildren(...values){this.children=values;},
   click(){this.calls++;this.handlers.click?.();},
   focus(){this.focused=true;},
   scrollIntoView(){}
 };
}
function create(module){
 const root=el(),documentEvents={};
 root.dataset.v78Module=module;
 const keys=['v78MediaHub','v78MediaStatus','v710CinemaResume','v710CinemaResumeItems',
   'cinemaVideo','audio','v78NowTitle','v78NowArtist','v78NowToggle','miniPlay',
   'v710AudioProgress','v710AudioElapsed','v710AudioDuration','v710ReadingSummary',
   'v710ReadingTitle','v710ReadingPosition','continueShelf','continueTitle','continueDetails',
   'continueAction','readerBack','heroReadNow'];
 const nodes=new Map(keys.map(key=>[key,el()]));nodes.set('v78MediaHub',root);
 const buttons=['continue','series','search','library','discover','import','radio'].map(key=>{
   const n=el();n.dataset.v78Action=key;return n;
 });
 root.querySelectorAll=sel=>sel==='[data-v78-action]'?buttons:[];
 const document={
   getElementById:id=>nodes.get(id)||null,
   createElement:()=>el(),
   addEventListener:(k,fn)=>{documentEvents[k]=fn},
   querySelector:()=>null,hidden:false
 };
 const window={};
 const ctx={document,window,Number,String,Array,Set,Math};
 runInNewContext(code,ctx);
 return {nodes,document,window,documentEvents,buttons,
   click:action=>buttons.find(x=>x.dataset.v78Action===action).click()};
}
test('all three actual module pages declare genuine media continuity elements',()=>{
 assert.match(cinema,/id="v710CinemaResume"/);
 assert.match(cinema,/id="v710CinemaResumeItems"/);
 assert.match(music,/id="v710AudioProgress"/);
 assert.match(music,/id="v710AudioElapsed"/);
 assert.match(music,/id="v710AudioDuration"/);
 assert.match(books,/id="v710ReadingSummary"/);
 assert.match(books,/id="v710ReadingTitle"/);
 assert.match(books,/id="v710ReadingPosition"/);
});
test('cinema shelf lists only actual unfinished saved films and does not open unavailable ones',()=>{
 const ui=create('cinema'),shelf=ui.nodes.get('v710CinemaResume'),
   items=ui.nodes.get('v710CinemaResumeItems'),video=ui.nodes.get('cinemaVideo');
 const records=[
   {id:'inprogress',title:'Current film',progress:.42,at:30},
   {id:'complete',title:'Fully watched',progress:1,at:100},
   {id:'older',title:'Earlier film',progress:.2,at:20},
   {id:'newer',title:'Later film',progress:.15,at:40},
   {id:'fourth',title:'Fourth film',progress:.3,at:10}
 ];
 const opened=[];
 ui.window.VetogramCinema={getLibrary:()=>records,openFilm:id=>{opened.push(id);return id!=='newer';},openTab(){}};
 video.handlers.pause();
 assert.equal(shelf.hidden,false);
 assert.equal(items.children.length,3);
 assert.match(items.children[0].children[0].textContent,/Later film/);
 assert.match(items.children[0].children[1].textContent,/15%/);
 items.children[0].click();
 assert.equal(opened[0],'newer');
 assert.match(ui.nodes.get('v78MediaStatus').textContent,/недоступен/);
 items.children[1].click();
 assert.equal(opened[1],'inprogress');
 assert.match(ui.nodes.get('v78MediaStatus').textContent,/сведения/);
 ui.window.VetogramCinema.getLibrary=()=>[];
 video.handlers.ended();
 assert.equal(shelf.hidden,true);
 assert.equal(items.children.length,0);
});
test('music now-playing shows native audio time and only uses original play control',()=>{
 const ui=create('music'),audio=ui.nodes.get('audio'),
   progress=ui.nodes.get('v710AudioProgress'),toggle=ui.nodes.get('v78NowToggle');
 ui.window.VetogramMusic={now:()=>({title:'Song',artist:'Artist'})};
 audio.src='blob:original-audio';audio.duration=192;audio.currentTime=64;audio.paused=false;
 audio.handlers.timeupdate();
 assert.equal(progress.value,100/3);
 assert.equal(progress.attrs['aria-valuetext'],'1:04 из 3:12');
 assert.equal(ui.nodes.get('v710AudioElapsed').textContent,'1:04');
 assert.equal(ui.nodes.get('v710AudioDuration').textContent,'3:12');
 assert.equal(toggle.disabled,false);
 toggle.click();
 assert.equal(ui.nodes.get('miniPlay').children.length,0);
 // The original player button, not a second audio.play(), is the controller.
 let presses=0;ui.nodes.get('miniPlay').click=()=>{presses++};
 toggle.click();assert.equal(presses,1);
 audio.src='';audio.handlers.emptied();
 assert.equal(progress.value,0);
 assert.equal(toggle.disabled,true);
 ui.documentEvents['vetogram:audio-error']();
 assert.match(ui.nodes.get('v78MediaStatus').textContent,/Источник не отдал/);
});
test('books reading summary mirrors real Continue shelf only when a saved book exists',()=>{
 const ui=create('books'),panel=ui.nodes.get('v710ReadingSummary');
 const shelf=ui.nodes.get('continueShelf');
 shelf.hidden=true;
 ui.documentEvents['vetogram:book-progress']();
 assert.equal(panel.hidden,true);
 shelf.hidden=false;
 ui.nodes.get('continueTitle').textContent='A real book';
 ui.nodes.get('continueDetails').textContent='Часть 4 · 8 стр.';
 ui.documentEvents['vetogram:book-progress']();
 assert.equal(panel.hidden,false);
 assert.equal(ui.nodes.get('v710ReadingTitle').textContent,'A real book');
 assert.equal(ui.nodes.get('v710ReadingPosition').textContent,'Часть 4 · 8 стр.');
 ui.click('continue');
 assert.equal(ui.nodes.get('continueAction').calls,1);
 shelf.hidden=true;
 ui.nodes.get('readerBack').click();
 assert.equal(panel.hidden,true);
});

test('live radio shows LIVE instead of inventing a duration, and clears recovered errors',()=>{
 const ui=create('music'),audio=ui.nodes.get('audio');
 audio.src='https://example.org/permitted-radio';
 audio.duration=Infinity;audio.currentTime=0;audio.paused=false;
 ui.window.VetogramMusic={now:()=>({title:'Radio',artist:'Live',source:'radio'})};
 audio.handlers.timeupdate();
 assert.equal(ui.nodes.get('v710AudioElapsed').textContent,'LIVE');
 assert.equal(ui.nodes.get('v710AudioProgress').value,0);
 assert.match(ui.nodes.get('v710AudioProgress').attrs['aria-valuetext'],/Прямой эфир/);
 ui.documentEvents['vetogram:audio-error']();
 assert.match(ui.nodes.get('v78MediaStatus').textContent,/Источник не отдал/);
 audio.handlers.playing();
 assert.match(ui.nodes.get('v78MediaStatus').textContent,/воспроизводится/);
});

test('Cinema Continue shelf refreshes on real library changes without reloading the page',()=>{
 const ui=create('cinema'),shelf=ui.nodes.get('v710CinemaResume'),items=ui.nodes.get('v710CinemaResumeItems');
 let library=[];
 ui.window.VetogramCinema={getLibrary:()=>library,openFilm:()=>true};
 assert.equal(shelf.hidden,true);
 library=[{id:'new-watch',title:'Saved progress',progress:.47,at:101}];
 ui.documentEvents['vetogram:cinema-library-change']();
 assert.equal(shelf.hidden,false);
 assert.equal(items.children.length,1);
 assert.match(items.children[0].children[1].textContent,/47%/);
 library=[];
 ui.documentEvents['vetogram:cinema-library-change']();
 assert.equal(shelf.hidden,true);
 assert.equal(items.children.length,0);
});
test('reader page turn refreshes genuine Continue shelf before notifying the media ribbon',()=>{
 const source=readFileSync(new URL('../public/books.js',import.meta.url),'utf8');
 const begin=source.indexOf('  function showPage(page, scroll=true){');
 const end=source.indexOf('  function renderChapters()',begin);
 assert.ok(begin>=0 && end>begin);
 const segment=source.slice(begin,end);
 const persist=segment.indexOf("persist('progress',progress);");
 const render=segment.indexOf('renderContinueShelf();',persist);
 const notify=segment.indexOf("new CustomEvent('vetogram:book-progress'",persist);
 assert.ok(persist>=0 && render>persist && notify>render,
   'a page change must refresh the visible Continue shelf before its notification fires');
});
