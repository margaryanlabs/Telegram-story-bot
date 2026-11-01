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
    assert.match(source,/vetogram-black-universe\.css\?v=20261101-black7/,name);
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
  assert.match(script,/fetchReaderResponse\(endpoint\+'\?'\+params\)/);
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
