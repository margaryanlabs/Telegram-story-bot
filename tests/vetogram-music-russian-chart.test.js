import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const main=readFileSync(new URL("vetogram-music.js",root),"utf8");
const hits=readFileSync(new URL("vetogram-music-hits.js",root),"utf8");
const code=readFileSync(new URL("vetogram-music-russia.js",root),"utf8");
const source=readFileSync(new URL("vetogram-music-russia-snapshot.js",root),"utf8");
const snap=new Function("const window={};"+source+"return window.VetogramRussiaChartSnapshot;")();
test("real official Russia chart snapshot is rank-accurate, sourced and dated",()=>{
 assert.equal(snap.country,"ru");
 assert.ok(snap.source.includes("Apple"));
 assert.ok(snap.feedUrl.startsWith("https://rss.marketingtools.apple.com/api/v2/ru/music/"));
 assert.ok(snap.updated.includes("27 Oct 2026"));
 assert.equal(snap.results.length,25);
 const ids=new Set();
 for(const [i,t] of snap.results.entries()){
  assert.equal(t.rank,i+1);
  assert.ok(t.id&&t.name&&t.artistName);
  assert.match(t.url,/^https:\/\/music\.apple\.com\/ru\/album\//);
  assert.ok(!ids.has(t.id));ids.add(t.id);
 }
 assert.equal(snap.results[0].name,"Украсть тебя");
 assert.equal(snap.results[1].name,"ДИНАСТИЯ");
});
test("Russian chart is primary screen and hero button opens it",()=>{
 const home=html.indexOf('data-view="home"');
 const russian=html.indexOf('id="homeRussianTracks"');
 const moods=html.indexOf('id="moodGrid"');
 const ruChart=html.indexOf('id="ruChartsTracks"');
 const audius=html.indexOf('id="chartsTracks"');
 assert.ok(home>=0&&russian>home&&moods>russian);
 assert.ok(ruChart>=0&&audius>ruChart);
 assert.match(html,/Русская музыка/);
 assert.match(html,/Русский топ-25/);
 assert.match(html,/data-russian-artist="MACAN"/);
 assert.match(main,/\$\("heroExplore"\)\.onclick=\(\)=>showPage\("charts"\)/);
 assert.ok(html.indexOf('vetogram-music-russia-snapshot.js')<html.indexOf('vetogram-music-russia.js'));
 assert.match(code,/vetogram:charts-open/);
});
test("ranking never invented and live results are validated",()=>{
 const i=code.indexOf("const IMAGE_HOSTS="),j=code.indexOf("let songs=",i);
 assert.ok(i>0&&j>i);
 const {mapTrack,mapFeed}=new Function(code.slice(i,j)+"return {mapTrack,mapFeed};")();
 const t=snap.results[0],mapped=mapTrack(t,1);
 assert.equal(mapped.rank,1);
 assert.equal(mapped.artist,t.artistName);
 assert.equal(mapped.url,t.url);
 assert.equal(mapped.embed,"https://embed.music.apple.com"+new URL(t.url).pathname+"?i="+t.id);
 assert.equal(mapTrack({...t,url:"https://evil.example/ru/album/test/123?i=678"},1),null);
 assert.equal(mapTrack({...t,url:"https://music.apple.com/us/album/test/123?i=678"},1),null);
 assert.throws(()=>mapFeed({feed:{country:"us",results:[t]}}));
});
test("no unlicensed direct streams: only official provider embedded player",()=>{
 assert.match(code,/https:\/\/embed\.music\.apple\.com/);
 assert.match(code,/Apple Music Top Songs/);
 assert.match(code,/mode==="snapshot"/);
 assert.match(code,/Снимок/);
 assert.match(code,/data\.feed\.results\.map/);
 assert.doesNotMatch(code,/V\.play|api\.play|previewUrl|downloadMP3|extractAudio|yt-dlp/);
 assert.match(hits,/search\("MACAN","ru"\)/);
});
test("browser scripts parse and remain independent of messenger",()=>{
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-russia.js",root))]);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-russia-snapshot.js",root))]);
});
