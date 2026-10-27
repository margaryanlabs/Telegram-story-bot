import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const dir=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",dir),"utf8");
const core=readFileSync(new URL("vetogram-music.js",dir),"utf8");
const russian=readFileSync(new URL("vetogram-music-russia.js",dir),"utf8");
const hits=readFileSync(new URL("vetogram-music-hits.js",dir),"utf8");
const css=readFileSync(new URL("vetogram-music-native.css",dir),"utf8");
test("home starts with the in-app playable music and discloses exact stream options",()=>{
 assert.match(html,/id="native-home-title"/);
 assert.ok(html.indexOf('class="native-home"')<html.indexOf('class="ru-home-spotlight'));
 for(const route of ["catalog","archive","library","radio"])assert.match(html,new RegExp('class="native-home-option"'));
 assert.match(html,/собственный аудиоплеер VETOGRAM/);
 assert.match(html,/Полное закрытие Mini App обычно прерывает звук/);
 assert.match(css,/@media\(max-width:480px\)/);
});
test("Apple search and chart never promise native free MP3 playback",()=>{
 assert.match(russian,/Плеер Apple/);
 assert.doesNotMatch(russian,/ru-song-play","▶"/);
 assert.doesNotMatch(russian,/actions\.append\(play,link\)/);
 assert.match(hits,/◈ Официальный плеер Apple/);
 assert.doesNotMatch(hits,/else window\.open\(t.url/);
 assert.match(html,/Это чарт, а не каталог бесплатных MP3/);
});
test("Media Session playbackState reflects real HTML audio events and supports lockscreen controls where available",()=>{
 assert.match(core,/navigator\.mediaSession\.playbackState=isPlaying/);
 assert.match(core,/navigator\.mediaSession\.setPositionState/);
 assert.match(core,/position:Math\.max\(0/);
 assert.match(core,/previoustrack:.*next\(-1\)/);
 assert.match(core,/nexttrack:.*next\(1\)/);
 assert.match(core,/"play","pause","ended","durationchange","timeupdate"/);
});
test("provider videos remain visible and do not continue hidden after leaving the page",()=>{
 assert.match(core,/vetogram:page-leave/);
 assert.match(core,/querySelectorAll\("iframe"\)/);
 for(const path of ["vetogram-music.js","vetogram-music-russia.js","vetogram-music-hits.js"]){
  execFileSync(process.execPath,["--check",fileURLToPath(new URL(path,dir))],{stdio:"pipe"});
 }
});
