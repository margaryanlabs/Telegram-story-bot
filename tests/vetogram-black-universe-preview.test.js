import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPublicPreviewApiPath,handlePreviewMediaApi} from '../scripts/vetogram-preview-public-api.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function responseMock(){
  return {
    statusCode:200, headers:{}, writableEnded:false, headersSent:false, body:'',
    setHeader(name,value){this.headers[name.toLowerCase()]=value;},
    writeHead(status){this.statusCode=status;this.headersSent=true;},
    end(body=''){this.body=body;this.writableEnded=true;},
  };
}

test('preview exposes only read-only public media routes',()=>{
  for(const path of ['/api/books','/api/books-discover','/api/books-wikisource','/api/cinema-channels'])
    assert.ok(isPublicPreviewApiPath(path),path);
  for(const path of ['/api/music-library','/api/telegram-chats','/api/privacy',
    '/api/telegram-send','/api/viewer-watch','/api/router','/api/health'])
    assert.equal(isPublicPreviewApiPath(path),false,path);
});

test('private API remains disabled without importing Telegram handlers',async()=>{
  const res=responseMock();
  await handlePreviewMediaApi({method:'GET',headers:{authorization:'test-secret'}},res,new URL('https://preview.test/api/music-library'));
  assert.equal(res.statusCode,503);
  assert.equal(JSON.parse(res.body).error,'preview_only');
  assert.equal(res.headers['cache-control'],'no-store');
  assert.equal(res.body.includes('test-secret'),false);
});

test('public preview rejects mutations and excessive queries before any upstream request',async()=>{
  const method=responseMock();
  await handlePreviewMediaApi({method:'POST'},method,new URL('https://preview.test/api/books'));
  assert.equal(method.statusCode,405);
  assert.equal(method.headers.allow,'GET');
  const huge=responseMock();
  await handlePreviewMediaApi({method:'GET'},huge,new URL('https://preview.test/api/books?q='+('a'.repeat(700))));
  assert.equal(huge.statusCode,400);
});

test('preview server imports public API adapter and retains deny by default',()=>{
  const source=read('scripts/vetogram-preview-server.mjs');
  assert.match(source,/handlePreviewMediaApi\(req,res/);
  assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(source,/import\(['"]\.\.\/api\/router\.js/);
});

test('Black Universe is wired into the four primary entry points',()=>{
  for(const name of ['studio','music-module','cinema','books']){
    const source=read('public/'+name+'.html');
    assert.match(source,/vetogram-black-universe\.css\?v=20261101-rebuild04/,name);
  }
  const css=read('public/vetogram-black-universe.css');
  assert.match(css,/--vet-black:#000/);
  assert.match(css,/body:not\(\.veto-chat-thread\)/);
  assert.match(css,/reader:not\(\[data-theme="light"\]\)/);
});

test('reader offers a retry action without destroying its place',()=>{
  const html=read('public/books.html');
  const script=read('public/books.js');
  assert.match(html,/id="readerRetry"/);
  assert.match(script,/fetchReaderResponse\(endpoint\+'\?'\+params,readerController\.signal\)/);
  assert.match(script,/readerRetry'\)\.addEventListener/);
  assert.match(script,/loadChapter\(state\.current,state\.activeChapter,true\)/);
});

test('foreign film discovery tab is reachable but never included as a licensed player',()=>{
  const cinema=read('public/cinema.js');
  const mediaCss=read('public/vetogram-media-edition-62.css');
  assert.doesNotMatch(cinema,/if\(tab==="foreign"\)tab="catalog"/);
  assert.match(cinema,/let list=state\.tab==="foreign"/);
  assert.match(cinema,/films\.filter\(f=>f\.externalRutube/);
  assert.match(cinema,/Дубляж указан загрузчиком и не проверен/);
  assert.doesNotMatch(mediaCss,/:is\(\[data-tab="foreign"\]/);
});

test('movie posters fail over to visible editorial artwork without refetch loop',()=>{
  const cinema=read('public/cinema.js');
  assert.match(cinema,/const failedPosterUrls=new Set\(\)/);
  assert.match(cinema,/failedPosterUrls\.add\(poster\)/);
  assert.match(cinema,/\.find\(url=>url&&!failedPosterUrls\.has\(url\)\)/);
});

test('book jackets retain individual tones and missing sources are remembered',()=>{
  const books=read('public/books.js');
  const css=read('public/vetogram-black-universe.css');
  assert.match(books,/const failedCoverUrls=new Set\(\)/);
  assert.match(books,/failedCoverUrls\.add\(imageUrl\)/);
  assert.match(books,/jacketProfile\(book\)/);
  assert.doesNotMatch(css,/book-cover:not\(:has\(img\)\)\s*\{\s*background/);
  assert.match(css,/\.book-cover\.placeholder/);
});

test('music artworks have distinct fallback initials instead of broken images',()=>{
  const music=read('public/vetogram-music.js');
  const catalog=read('public/vetogram-music-catalog.js');
  assert.match(music,/coverLetter=track/);
  assert.match(music,/const failedArtworkUrls=new Set\(\)/);
  assert.match(music,/failedArtworkUrls\.add\(url\)/);
  assert.match(catalog,/const failedCoverUrls=new Set\(\)/);
  assert.match(catalog,/failedCoverUrls\.add\(track\.artwork\)/);
});

test('audio pauses only for confirmed film playback, never on click or player mount',()=>{
  const cinema=read('public/cinema.js');
  const bridge=read('public/vetogram-media-bridge.js');
  assert.doesNotMatch(cinema,/state\.playing=f;setHistory\(f\);updateBack\(\);buzz\(\);\s*window\.dispatchEvent\(new CustomEvent\(['"]vetogram:cinema-playing/);
  assert.match(cinema,/if\(!playbackConfirmed\)window\.dispatchEvent\(new CustomEvent\("vetogram:cinema-playing"\)\)/);
  assert.match(bridge,/video\?\.addEventListener\('playing'/);
  assert.match(bridge,/window\.addEventListener\('vetogram:cinema-playing'/);
  assert.doesNotMatch(bridge,/cinemaDetailsWatch'\)\?\.addEventListener\('click'.*video-playing/);
});

test('abandoned book chapter requests abort instead of retrying or overwriting current reader',()=>{
  const books=read('public/books.js');
  assert.match(books,/let activeReaderFetch=null/);
  assert.match(books,/if\(requestSignal\?\.aborted\)throw error/);
  assert.match(books,/fetchReaderResponse\(endpoint\+'\?'\+params,readerController\.signal\)/);
  assert.match(books,/if\(\$\('reader'\)\.hidden \|\| state\.requestBook!==request/);
  assert.match(books,/activeReaderFetch\?\.abort\(\);\s*activeReaderFetch=null;\s*cancelChapterPrefetch\(\);\s*\+\+state\.requestBook/);
  assert.match(books,/finally\{\s*if\(activeReaderFetch===readerController\)activeReaderFetch=null/);
});

test('saved book deep link reports success only after actual pages are prepared',()=>{
 const books=read('public/books.js');
 const bridge=read('public/vetogram-media-bridge.js');
 assert.match(books,/return await loadChapter\(book,chapter,true\)/);
 assert.match(books,/return await loadChapter\(book,0,resume\)/);
 assert.match(books,/return state\.pages\.length>0 && state\.requestBook===request/);
 assert.match(books,/return openBook\(book\); \/\/ Only acknowledge success after text pages have loaded/);
 assert.match(bridge,/Promise\.resolve\(opened\)\.then\(result=>send\(\{type:'open-item-status'/);
});

test('foreign discovery remains external-only even if metadata changes later',()=>{
 const cinema=read('public/cinema.js');
 assert.match(cinema,/async function play\(f, chosenSource\)\{\s*\/\/ External movie discovery/);
 assert.match(cinema,/if\(f\.externalRutube\|\|f\.discoveryOnly\)\{/);
});

test('new cinema searches cancel old requests and do not reset latest loading UI',()=>{
 const cinema=read('public/cinema.js');
 assert.match(cinema,/catalogController\?\.abort\(\)/);
 assert.match(cinema,/catalogController=timeout/);
 assert.match(cinema,/if\(ticket===catalogTicket\)\{button\.disabled=false/);
 assert.match(cinema,/if\(offset===null\|\|\["library","series","foreign"\]\.includes\(state\.tab\)\)return/);
 assert.match(cinema,/clearTimeout\(catalogDebounce\)/);
});

test('Universe identity fallback does not wake a hidden browser every second',()=>{
 const universe=read('public/vetogram-universe.js');
 assert.match(universe,/setInterval\(\(\)=>\{if\(!document\.hidden\)checkIdentity\(\);\},10000\)/);
 assert.match(universe,/window\.addEventListener\('focus',checkIdentity\)/);
 assert.match(universe,/document\.addEventListener\('visibilitychange',checkIdentity\)/);
});

test('book cache preserves completeness metadata and rejects empty text',()=>{
 const books=read('public/books.js');
 assert.match(books,/coverage:data\.coverage\|\|null,at:Date\.now\(\)/);
 assert.match(books,/if\(typeof data\.text!=='string'\|\|!data\.text\.trim\(\)\)throw new Error/);
 assert.match(books,/if\(typeof data\?\.text!=='string'\|\|!data\.text\.trim\(\)\)throw new Error/);
});

test('book prefetch is bounded, cancelled on navigation, and suppressed while hidden',()=>{
 const books=read('public/books.js');
 const bridge=read('public/vetogram-media-bridge.js');
 assert.match(books,/function cancelChapterPrefetch\(\)/);
 assert.match(books,/pendingChapterPrefetch\.values\(\)/);
 assert.match(books,/setTimeout\(\(\)=>controller\.abort\(\),12000\)/);
 assert.match(books,/pendingChapterPrefetch\.get\(cacheId\)===task/);
 assert.match(books,/pauseBackgroundWork:cancelChapterPrefetch/);
 assert.match(bridge,/window\.VetogramBooks\?\.pauseBackgroundWork\?\.\(\)/);
});

test('late film starts from a hidden Cinema iframe cannot pause Music',()=>{
 const host=read('public/vetogram-universe.js');
 assert.match(host,/name==='cinema'&&message\.type==='video-playing'&&screen==='media'&&activeModule==='cinema'/);
});

test('saved music metadata is not misreported as a playable audio stream',()=>{
 const music=read('public/vetogram-music.js');
 const bridge=read('public/vetogram-media-bridge.js');
 const host=read('public/vetogram-universe.js');
 assert.match(music,/return "search"; \/\/ The player has NOT started/);
 assert.match(music,/runSearch\(query\);return "search"/);
 assert.match(bridge,/status:result==='search'\?'search'/);
 assert.match(host,/message\.status==='search'/);
 assert.match(host,/воспроизведение пока не началось/);
});

test('live message polling is aborted when leaving Chats or signing out',()=>{
 const chats=read('public/telegram-chats.js');
 assert.match(chats,/syncAbort:null/);
 assert.match(chats,/function cancelActivePoll\(\)\{/);
 assert.match(chats,/state\.syncAbort=controller/);
 assert.match(chats,/if\(runId!==state\.syncRunId\|\|!maySyncThread\(\)/);
 assert.match(chats,/if\(state\.syncAbort===controller\)state\.syncAbort=null/);
 assert.match(chats,/if\(document\.hidden\)\{stopThreadSync\(\);cancelActivePoll\(\);\}/);
 assert.match(chats,/window\.addEventListener\('offline',[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/);
 assert.match(chats,/window\.addEventListener\('pagehide',[\s\S]*?stopThreadSync\(\);cancelActivePoll\(\)/);
});

test('media host shows a single player and never treats saved-metadata notices as loading',()=>{
 const host=read('public/vetogram-universe.js');
 const embedded=read('public/vetogram-media-embedded.css');
 assert.match(host,/const show=!!lastAudio;/);
 assert.match(embedded,/html\.v6-embedded \.player-bar\{display:none!important\}/);
 assert.match(host,/const phase=!text\?'ready':retry\?'failed':notice\?'notice':'loading'/);
 assert.match(host,/String\(phase==='loading'\)/);
 assert.match(host,/message\.status==='search'\)moduleStatus\([^\n]*false,true\)/);
});
