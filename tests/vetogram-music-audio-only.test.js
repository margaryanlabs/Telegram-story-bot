import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const core=readFileSync(new URL("vetogram-music.js",root),"utf8");
const catalog=readFileSync(new URL("vetogram-music-catalog.js",root),"utf8");
const archive=readFileSync(new URL("vetogram-music-archive.js",root),"utf8");
const mixter=readFileSync(new URL("vetogram-music-mixter.js",root),"utf8");
test("Native audio stays separate from the visible official video player",()=>{
 assert.ok(html.includes('id="audio"'));
 assert.ok(html.includes('id="homeTracks"'));
 assert.ok(html.includes('data-view="youtube"'));
 assert.ok(html.includes('data-view="originals"'));
 assert.ok(html.includes('src="./vetogram-music-youtube.js"'));
 assert.ok(html.includes('src="./vetogram-music-originals.js"'));
 assert.doesNotMatch(core,/yt-dlp|youtube-dl|extractAudio|downloadAudio/);
});
test("Russian-first search and clean native audio navigation",()=>{
 assert.ok(html.includes('data-audio-preset="ru"'));
 assert.ok(html.includes('data-audio-preset="ru-rap"'));
 assert.ok(html.includes('data-audio-preset="am"'));
 assert.ok(catalog.includes('group="ru",preset="ru"'));
 assert.ok(catalog.includes("selectPreset"));
 assert.ok(core.includes("window.VetogramCatalog?.selectPreset"));
 assert.ok(core.includes('$$(".page").forEach'));
 assert.ok(core.includes('"originals","youtube"'));
 assert.ok(core.includes('unique([...state.local,...state.tracks])'));
 assert.ok(!core.includes('unique([...demoTracks,...state.tracks]),"home"'));
});
test("real Russian station audio streams from public broadcaster HTTPS endpoints",()=>{
 for(const slug of ["rusradio","russianmix","dfm","maximum"])
  assert.ok(html.includes('data-audio-station="'+slug+'"'));
 for(const host of ["rusradio.hostingradio.ru","radiorecord.hostingradio.ru","dfm-dfmrusdance.hostingradio.ru","maximum.hostingradio.ru"])
  assert.ok(core.includes("https://"+host+"/"));
 assert.match(core,/playTrack\(item,\[item\]\)/);
 assert.ok(core.includes('countrycode:"RU"'));
 assert.ok(!html.includes("data-page=\"hits\""));
});
test("author credit is still accessible without prominent provider links",()=>{
 assert.match(archive,/tag\("details","archive-links"\)/);
 assert.match(mixter,/mk\("details","mixter-links"\)/);
 assert.ok(html.includes("mixterSource"));
 assert.match(html,/mixterSource"[^>]*hidden/);
});
test("browser code parses before deployment",()=>{
 for(const p of ["vetogram-music.js","vetogram-music-catalog.js","vetogram-music-archive.js","vetogram-music-mixter.js","vetogram-music-charts.js"])
  execFileSync(process.execPath,["--check",fileURLToPath(new URL(p,root))],{stdio:"pipe"});
});
