/* Vetogram V9.7 regression: source honesty, real reading resume. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');

function cinemaClassifier(){
 const code=read('cinema.js');
 const begin=code.indexOf('  function movieAccess(f){');
 const end=code.indexOf('  function filmCard(f){',begin);
 assert.ok(begin>=0&&end>begin,'availability classification must precede film cards');
 const failedEmbeds=new Set(['bad-provider']);
 const approvedSources=f=>(f.approvedSources||[]).filter(src=>src?.licensed===true);
 return {movieAccess:new Function('approvedSources','failedEmbeds',
  code.slice(begin,end)+';return movieAccess;')(approvedSources,failedEmbeds),
  failedEmbeds,code};
}

test('Cinema never presents unlicensed metadata or failed videos as playable',()=>{
 const {movieAccess}=cinemaClassifier();
 const cases=[
  [{id:'rutube',externalRutube:true},'external'],
  [{id:'metadata',discoveryOnly:true},'external'],
  [{id:'blocked',discoveryOnly:true,watchAvailability:'unavailable'},'unavailable'],
  [{id:'licensed',player:{licensed:true},approvedSources:[{licensed:true}]},'embedded'],
  [{id:'file',file:'public.webm'},'archive'],
  [{id:'not-licensed',player:{licensed:false}},'unavailable'],
  [{id:'bad-provider',player:{licensed:true},approvedSources:[{}]},'unavailable']
 ];
 for(const [movie,kind] of cases){
  const actual=movieAccess(movie);
  assert.equal(actual.kind,kind,movie.id);
  assert.ok(actual.label.length>0&&actual.explanation.length>20);
 }
});

test('Cinema playable-only filter returns actual embedded records, not catalog covers',()=>{
 const {movieAccess,failedEmbeds,code}=cinemaClassifier();
 const begin=code.indexOf('  function selectedFilms(){');
 const end=code.indexOf('  function artElement(f,wide){',begin);
 assert.ok(begin>=0&&end>begin);
 const films=[
  {id:'playable',title:'Play',year:2026,genres:['Драма'],player:{licensed:true},approvedSources:[{licensed:true}]},
  {id:'archive',title:'Archive',year:2025,genres:['Драма'],file:'public.webm'},
  {id:'metadata',title:'Metadata',year:2024,externalRutube:true},
  {id:'broken',title:'Broken',year:2023,player:{licensed:true},approvedSources:[{}]}
 ];
 const state={tab:'catalog',query:'',genre:'Все',sort:'year',onlyPlayable:true,library:{favorites:[]}};
 const selectedFilms=new Function('films','state','movieAccess','failedEmbeds',
  'isWorldSpotlight','worldPriority','uploadTime',
  code.slice(begin,end)+';return selectedFilms;')(
   films,state,movieAccess,failedEmbeds,()=>false,()=>0,()=>0);
 assert.deepEqual(selectedFilms().map(f=>f.id),['playable']);
 state.onlyPlayable=false;
 assert.deepEqual(selectedFilms().map(f=>f.id),['playable','archive','broken']);
 const html=read('cinema.html');
 assert.match(html,/id="cinemaPlayableOnly"/);
 assert.match(html,/id="cinemaDetailsAvailability"/);
 assert.match(code,/cinemaDetailsSource"\);/);
 assert.match(code,/state\.onlyPlayable\)list=list\.filter/);
});

test('Books resume appears only with real saved progress and delegates to native Continue',()=>{
 const source=read('vetogram-v9-explore.js');
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.attrs={};this.hidden=false;this.textContent='';}
  append(...children){this.children.push(...children)}
  addEventListener(type,fn){this.handlers[type]=fn}
  setAttribute(k,v){this.attrs[k]=v}
  insertAdjacentElement(where,node){assert.equal(where,'afterend');this.after=node}
  click(){this.handlers.click?.()}
 }
 const dock=new Node('dock'),main=new Node('main'),history=new Node('history');
 const action=new Node('continue-action'),title=new Node('title');
 let opens=0;action.onclick=()=>{opens++};
 action.click=()=>action.onclick?.();
 history.hidden=true;title.textContent='Невероятная история';
 history.querySelector=selector=>({
  '#continueAction':action,'#continueTitle':title
 })[selector]||null;
 main.querySelector=selector=>({
  '#continueShelf':history,'.v9-explore-dock':dock
 })[selector]||null;
 const watchers=[];
 class MutationObserver{
  constructor(callback){this.callback=callback;watchers.push(this)}
  observe(){}
 }
 const document={
  querySelector:selector=>selector==='#booksMain'?main:null,
  createElement:tag=>new Node(tag)
 };
 const window={addEventListener(){}};
 runInNewContext(source,{document,window,MutationObserver});
 const button=dock.after;
 assert.ok(button);
 assert.equal(button.id,'v97BooksResume');
 assert.equal(button.hidden,true);
 history.hidden=false;watchers.forEach(w=>w.callback());
 assert.equal(button.hidden,false);
 assert.match(button.attrs['aria-label'],/Невероятная история/);
 button.click();assert.equal(opens,1);
 history.hidden=true;watchers.forEach(w=>w.callback());
 assert.equal(button.hidden,true);
 button.click();assert.equal(opens,1);
});
