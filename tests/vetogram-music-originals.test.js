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
 assert.equal(videos.length,18);
 assert.equal(new Set(videos).size,18);
 for(const verified of ["aiCL0-U9WxI","WujKJpxaUHk","wxxnY-QTUGU","DIKIgjLGf98","ChkJpnOgIwQ","RfH5o3XtI2c","1RG_qhN4e3M","Co8ZJIejXBA","suAR1PYFNYA","ZjBZ8MUnB0E","vBynw9Isr28"]){
  assert.ok(videos.includes(verified),"verified official release "+verified);
 }
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

test("external discovery opens YouTube and does not promise an imported music catalog",()=>{
 assert.ok(html.includes('id="originalsFindMore"'));
 assert.ok(js.includes('youtube.com/results?search_query='));
 assert.ok(js.includes('openLink(url)'));
 assert.ok(html.includes("не добавляет их автоматически"));
});
