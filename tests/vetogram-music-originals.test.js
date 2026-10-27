import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const dir=new URL("../public/",import.meta.url);
const js=readFileSync(new URL("vetogram-music-originals.js",dir),"utf8");
const css=readFileSync(new URL("vetogram-music-originals.css",dir),"utf8");
const html=readFileSync(new URL("index.html",dir),"utf8");
const main=readFileSync(new URL("vetogram-music.js",dir),"utf8");
test("music-only original recordings section is integrated",()=>{
 assert.match(html,/data-view="originals"/);assert.match(html,/data-page="originals"/);
 assert.match(html,/vetogram-music-originals\.js/);assert.match(html,/vetogram-music-originals\.css/);
 assert.match(main,/originals:"ОРИГИНАЛЫ"/);
 assert.ok(html.indexOf('src="./vetogram-music.js"')<html.indexOf('src="./vetogram-music-originals.js"'));
});
test("only curated original publisher/artist URLs, no audio extraction",()=>{
 const videos=[...js.matchAll(/id:"([A-Za-z0-9_-]{11})",artist:/g)].map(m=>m[1]);
 assert.deepEqual(videos,["y14ulAguQv4","plXH4GeYtes","TPjN6N8TgNI","4NRXx6U8ABQ","V9PVRfjEBTI","N000qglmmY0","JGwWNGJdvx8"]);
 assert.match(js,/youtube-nocookie\.com\/embed/);assert.match(js,/watch\?v=/);assert.match(js,/frame\.allowFullscreen=true/);
 assert.doesNotMatch(js,/autoplay=1|ytdl|youtube-dl|yt-dlp|proxyAudio|downloadMp3/);
 assert.match(js,/getElementById\("audio"\)\?\.pause\(\)/);
});
test("fully visible accessible provider video on mobile",()=>{
 assert.match(html,/id="originalsFrame"/);
 assert.match(css,/\.originals-iframe/);assert.match(css,/min-height:270px/);
 assert.match(js,/frame\.title=/);assert.match(js,/frame\.allow=/);
 assert.match(js,/frame\.loading="eager"/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-originals.js",dir))],{stdio:"pipe"});
});
