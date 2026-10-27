import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const dir=new URL("../public/",import.meta.url);
const source=readFileSync(new URL("vetogram-music-direct.js",dir),"utf8");
const app=readFileSync(new URL("vetogram-music.js",dir),"utf8");
const html=readFileSync(new URL("index.html",dir),"utf8");
const css=readFileSync(new URL("vetogram-music-direct.css",dir),"utf8");
const a=source.indexOf("function checkUrl("),b=source.indexOf("function message(",a);
assert.ok(a>0&&b>a);
const pure=new Function('const MAX_CHARS=160000,MAX_ITEMS=150;const clean=(v,n=120)=>String(v??"").replace(/\\s+/g," ").trim().slice(0,n);'+
 source.slice(source.indexOf("const denyHosts="),b)+"return {checkUrl,parseM3u};")();
test("direct music supports personal HTTPS links and rejects invalid sources",()=>{
 assert.equal(pure.checkUrl("https://example.org/tune.mp3"),"https://example.org/tune.mp3");
 for(const url of [
  "http://example.org/tune.mp3","javascript:alert(1)","https://music.yandex.ru/album/10",
  "https://vk.com/audio","https://youtube.com/watch?v=42",
  "https://localhost:4443/audio.mp3","https://192.168.1.1/audio.mp3",
  "https://example.org/master.m3u8","https://example.org/index.html"
 ])assert.throws(()=>pure.checkUrl(url),Error,url);
});
test("M3U import parses Cyrillic artist/title, HTTPS URLs, deduplicates and skips unsupported entries",()=>{
 const m3u="#EXTM3U\\n#EXTINF:-1,Кино — Группа крови\\nhttps://example.org/kino.mp3\\n"+
 "#EXTINF:-1,Земфира — Искала\\nhttps://example.org/z.m4a\\n"+
 "http://insecure.example.com/a.mp3\\nhttps://example.org/z.m4a";
 const result=pure.parseM3u(m3u.replaceAll("\\n","\n"));
 assert.equal(result.length,2);
 assert.equal(result[0].artist,"Кино");
 assert.equal(result[0].title,"Группа крови");
 assert.equal(result[1].stream,"https://example.org/z.m4a");
});
test("Reject HLS playlist and oversized files",()=>{
 assert.throws(()=>pure.parseM3u("#EXTM3U\n#EXT-X-TARGETDURATION:6\nhttps://example.org/part.ts"),/HLS/);
 assert.throws(()=>pure.parseM3u("x".repeat(160001)),/160/);
});
test("Full UI is wired and music core persists user-supplied tracks",()=>{
 for(const id of ["directForm","directUrl","directArtist","directTitle","directM3U","directM3UText",
   "directM3UImport","directStatus","streamTracks"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/vetogram-music-direct\.js/);
 assert.match(html,/vetogram-music-direct\.css/);
 assert.match(app,/function addStreams\(/);
 assert.match(app,/function removeStream\(/);
 assert.match(app,/function moveStream\(/);
 assert.match(app,/streams:state\.streams\.slice\(0,150\)/);
 assert.match(app,/context==="streams"\?state\.streams/);
 assert.match(css,/direct-import/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-direct.js",dir))],{stdio:"pipe"});
});
