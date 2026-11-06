import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const cinema=read('cinema.js');
const books=read('books.js');

function posterHarness(){
 const start=cinema.indexOf('  function requestPoster(f){');
 const end=cinema.indexOf('  async function getCommons(f){',start);
 assert.ok(start>0&&end>start,'poster queue source found');
 const posterFunctions=cinema.slice(start,end);
 const state={posters:new Map(),posterLookups:new Set(),selected:null,sources:new Map()};
 const posterQueue=[],posterRetryAt=new Map(),failedPosterUrls=new Set();
 let posterActive=0,peak=0,started=0;
 const pending=[];
 const artworks=new Map();
 const cards=[];
 const window={VetogramCinemaArtwork:{
  load:f=>new Promise(resolve=>{started++;pending.push({f,resolve});})
 }};
 const discovery={slides:[],index:0};
 const node=()=>({src:'',alt:'',loading:'',onerror:null});
 const dom={
  querySelectorAll:()=>cards,
 };
 const ctx={state,posterQueue,posterRetryAt,failedPosterUrls,MAX_POSTER_REQUESTS:3,
   window,discovery,document:dom,$:()=>null,getCommons:async()=>({poster:null}),node,
   Promise,Date,setTimeout,clearTimeout};
 Object.defineProperty(ctx,'posterActive',{get:()=>posterActive,set:value=>{posterActive=value;peak=Math.max(peak,value)}});
 vm.runInNewContext(posterFunctions+'\nthis.requestPoster=requestPoster;',ctx,
   {filename:'cinema-poster-functions.js',timeout:1000});
 function addCard(id){
  const images=[];
  const art={querySelector:()=>images[0]||null,prepend:image=>images.push(image)};
  cards.push({dataset:{filmId:id},querySelector:selector=>selector==='.cinema-card-art'?art:null});
  artworks.set(id,images);
 }
 return {request:ctx.requestPoster,state,pending,addCard,artworks,
   get started(){return started},get peak(){return peak},get queued(){return posterQueue.length}};
}

const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

test('posters attach by film identity, not the cleaned/display title',async()=>{
 const h=posterHarness();
 h.addCard('movie-a');h.addCard('movie-b');
 h.request({id:'movie-a',title:'Long uploader title | Mosfilm',player:{url:'https://rutube.ru/play/embed/abc'}});
 await flush();
 assert.equal(h.started,1);
 h.pending[0].resolve('https://pic.rutube.ru/real-source.jpg');
 await flush();
 assert.equal(h.artworks.get('movie-a').length,1);
 assert.equal(h.artworks.get('movie-b').length,0);
 assert.equal(h.state.posters.get('movie-a'),'https://pic.rutube.ru/real-source.jpg');
});

test('one hundred visible cards cannot launch one hundred concurrent poster requests',async()=>{
 const h=posterHarness();
 for(let i=0;i<30;i++)h.request({id:'movie-'+i,title:'Movie '+i,player:{url:'https://rutube.ru/play/embed/abc'}});
 await flush();
 assert.equal(h.started,3);
 assert.equal(h.peak,3);
 assert.equal(h.queued,27);
 h.pending[0].resolve(null);
 await flush();
 assert.equal(h.started,4);
});

test('a missing poster has a cooldown instead of entering infinite retry loops',async()=>{
 const h=posterHarness();
 const film={id:'missing',title:'Missing',player:{}};
 h.request(film);await flush();
 h.pending[0].resolve(null);await flush();
 assert.equal(h.state.posterLookups.has('missing'),false);
 h.request(film);await flush();
 assert.equal(h.started,1);
});

test('movie poster lookup is lazy outside the first viewport',()=>{
 assert.match(cinema,/const posterObserver=typeof IntersectionObserver==="function"/);
 assert.match(cinema,/\{rootMargin:"240px 0px"\}/);
 assert.match(cinema,/posterObserver\.observe\(div\)/);
 assert.match(cinema,/b\.dataset\.filmId=String\(f\.id\)/);
 assert.match(cinema,/card\.dataset\.filmId!==String\(f\.id\)/);
});

test('metadata-only books cannot be mistaken for offline full texts',()=>{
 const html=read('books.html');
 assert.match(html,/Каталог · без полного текста/);
 assert.match(html,/Новинки · каталог/);
 assert.match(html,/id="bookModeStatus"/);
 assert.match(books,/info\.textContent=\['hot200','spotlight'\]\.includes\(state\.source\)/);
 assert.match(books,/а не библиотека бесплатных полных текстов/);
});

test('personal music source artwork does not pretend to be official album art',()=>{
 const music=read('vetogram-music-licensed-home-63.js');
 const css=read('vetogram-media-edition-62.css');
 assert.match(music,/licensed-home-art licensed-home-art-designed/);
 assert.match(music,/Branded editorial art is an honest fallback/);
 assert.match(css,/\.licensed-home-art\.licensed-home-art-designed/);
 assert.match(css,/\.licensed-home-initial/);
});

test('Playlist sections no longer bring back the conflicting old blue-purple panels',()=>{
 const css=read('vetogram-music-collections.css');
 assert.match(css,/\.vmc-section\{[^}]*background:#111114/);
 assert.match(css,/\.vmc-home\{[^}]*background:#151316/);
 assert.doesNotMatch(css,/background:radial-gradient\(circle at 97% -8%,#dd749343/);
});
