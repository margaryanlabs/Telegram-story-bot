import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const code=readFileSync(resolve(root,'public/cinema-artwork.js'),'utf8');
const id='68781d890618ea50933ec020fd5060bf';
const film={id:'mosfilm-love-doves',player:{url:'https://rutube.ru/play/embed/'+id}};
test('artwork URL validation accepts only known RUTUBE image domains',()=>{
 const ctx={window:{},URL};vm.runInNewContext(code,ctx);
 const api=ctx.window.VetogramCinemaArtwork;
 assert.equal(api.rutubeVideoId(film),id);
 assert.equal(api.allowedThumbnail('https://evil.example/x.jpg'),null);
 assert.equal(api.allowedThumbnail('http://pic.rutube.ru/x.jpg'),null);
 assert.equal(api.allowedThumbnail('https://pic.rutube.ru/video/example.jpg'),'https://pic.rutube.ru/video/example.jpg');
 assert.equal(api.allowedThumbnail('https://pic.rtbcdn.ru/video/film.jpg'),'https://pic.rtbcdn.ru/video/film.jpg');
 assert.equal(api.rutubeVideoId({player:{url:'https://bad.example/play/embed/'+id}}),null);
});
test('artwork API is metadata-only, caches lookup and fails closed',async()=>{
 let queries=0;
 const ctx={window:{},URL,AbortController,setTimeout,clearTimeout,
  fetch:async url=>{
    queries++;
    assert.match(String(url),/\/api\/video\/[a-f0-9]{32}\/$/);
    return {ok:true,json:async()=>({thumbnail_url:'https://pic.rutube.ru/video/sample.jpg'})};
  }};
 vm.runInNewContext(code,ctx);
 const api=ctx.window.VetogramCinemaArtwork;
 const got=await Promise.all([api.load(film),api.load(film)]);
 assert.equal(queries,1);
 assert.deepEqual([...got],['https://pic.rutube.ru/video/sample.jpg','https://pic.rutube.ru/video/sample.jpg']);
});
test('untrusted video URLs never generate metadata requests',async()=>{
 let requests=0;
 const ctx={window:{},URL,AbortController,setTimeout,clearTimeout,fetch:async()=>{requests++}};
 vm.runInNewContext(code,ctx);
 const api=ctx.window.VetogramCinemaArtwork;
 assert.equal(await api.load({player:{url:'https://evil.example/play/embed/'+id}}),null);
 assert.equal(requests,0);
});
