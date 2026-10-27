import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const publicRoot=new URL("../public/",import.meta.url);
const main=readFileSync(new URL("vetogram-music.js",publicRoot),"utf8");
const code=readFileSync(new URL("vetogram-music-youtube.js",publicRoot),"utf8");
const html=readFileSync(new URL("index.html",publicRoot),"utf8");
const css=readFileSync(new URL("vetogram-music-youtube.css",publicRoot),"utf8");
const list=readFileSync(new URL("vetogram-music-originals.js",publicRoot),"utf8");
const start=code.indexOf("const STORAGE="),end=code.indexOf("let saved=",start);
assert.ok(start>=0&&end>start);
const {parseLink,embedFor,validVideo,validPlaylist}=new Function(code.slice(start,end)+"return {parseLink,embedFor,validVideo,validPlaylist};")();
test("different types of YouTube share URLs create strictly official embeddable content",()=>{
 const video=parseLink("https://youtu.be/y14ulAguQv4?si=abcdef");
 assert.deepEqual(video,{kind:"video",id:"y14ulAguQv4",url:"https://www.youtube.com/watch?v=y14ulAguQv4"});
 assert.equal(embedFor(video),"https://www.youtube-nocookie.com/embed/y14ulAguQv4?rel=0&playsinline=1");
 const playlist=parseLink("https://www.youtube.com/playlist?list=PLC77007E23FF423C6");
 assert.equal(playlist.kind,"playlist");
 assert.equal(playlist.id,"PLC77007E23FF423C6");
 assert.equal(embedFor(playlist),"https://www.youtube-nocookie.com/embed/videoseries?list=PLC77007E23FF423C6&playsinline=1");
 const album=parseLink("https://music.youtube.com/playlist?list=OLAK5uy_mkSFLs89OXrugKhAxzlVKezh4hnNkOMwk");
 assert.equal(album.kind,"playlist");
 const channel=parseLink("https://www.youtube.com/channel/UCFpD-o5sN0cSk8pgZSGLJ4g");
 assert.deepEqual(channel,{kind:"channel",id:"UUFpD-o5sN0cSk8pgZSGLJ4g",url:"https://www.youtube.com/channel/UCFpD-o5sN0cSk8pgZSGLJ4g"});
 assert.equal(embedFor(channel),"https://www.youtube-nocookie.com/embed/videoseries?list=UUFpD-o5sN0cSk8pgZSGLJ4g&playsinline=1");
 assert.equal(parseLink("https://www.youtube.com/watch?v=wGFAi6WCWEY&list=PLC77007E23FF423C6").kind,"playlist");
 assert.equal(parseLink("https://www.youtube.com/watch?v=wGFAi6WCWEY").kind,"video");
});
test("YouTube playlist security rejects spoofed hosts, private and malformed links",()=>{
 for(const invalid of [
  "javascript:alert(1)","https://youtube.com.evil.example/watch?v=y14ulAguQv4",
  "https://evil.example/?redirect=https://youtube.com/watch?v=y14ulAguQv4",
  "https://www.youtube.com/playlist?list=RMixUnsupported",
  "https://www.youtube.com/@Gazgolder","https://www.youtube.com/channel/UCtooShort",
  "https://youtu.be/y14ulAguQv4.evil"
 ])assert.equal(parseLink(invalid),null,invalid);
 assert.equal(validVideo("y14ulAguQv4"),true);
 assert.equal(validVideo("m3u8.mp3"),false);
 assert.equal(validPlaylist("RDunknown"),false);
 assert.equal(embedFor({kind:"playlist",id:"../../etc/passwd"}),"");
 assert.equal(embedFor({kind:"curated",ids:["y14ulAguQv4","aiCL0-U9WxI"]}),
   "https://www.youtube-nocookie.com/embed/y14ulAguQv4?playlist=aiCL0-U9WxI&playsinline=1");
});
test("Russia-first curated publisher channels are verifiably sourced and not fake song rows",()=>{
 assert.match(code,/GAZ LIVE \/ Gazgolder/);
 assert.match(code,/BlackStarTV/);
 assert.match(code,/UCthfjHehYgSyhf8ONjzJMUw/);
 assert.match(code,/UCFpD-o5sN0cSk8pgZSGLJ4g/);
 assert.match(html,/id="ytFeaturedChannels"/);
 assert.match(html,/не отфильтрованные музыкальные чарты/);
 assert.match(html,/data-yt-region="ru" class="active"/);
 assert.match(list,/language:"ru"/);
 assert.match(list,/language:"hy"/);
});
test("YouTube full visible playlist player and local bookmarks are connected to main app",()=>{
 assert.match(html,/data-view="youtube"/);
 assert.match(html,/data-page="youtube"/);
 assert.match(html,/id="ytPlayerFrame"/);
 assert.match(html,/id="ytImportForm"/);
 assert.match(html,/id="ytCurated"/);
 assert.match(html,/id="ytSaved"/);
 assert.match(html,/vetogram-music-youtube\.css/);
 assert.ok(html.indexOf('src="./vetogram-music-originals.js"')<html.indexOf('src="./vetogram-music-youtube.js"'));
 assert.match(main,/vetogram:youtube-open/);
 assert.match(main,/youtube:"YOUTUBE МУЗЫКА"/);
 assert.match(main,/vetogram:page-leave/);
 assert.match(main,/querySelectorAll\("iframe"\)/);
 assert.match(code,/localStorage\.setItem/);
 assert.match(code,/localStorage\.getItem/);
 assert.match(code,/MAX_SAVED=50/);
 assert.match(code,/frame\.allowFullscreen=true/);
 assert.match(code,/yt-iframe/);
 assert.match(css,/aspect-ratio:16\/9/);
 assert.match(css,/@media\(max-width:720px\)/);
});
test("search opens original YouTube instead of pretending to import protected audio",()=>{
 assert.match(code,/youtube\.com\/results\?search_query/);
 assert.doesNotMatch(code,/youtube-dl|yt-dlp|\.mp3|\.m4a|downloadAudio|extractAudio|ytdl-core/);
 assert.doesNotMatch(code,/backgroundPlay|autoplay=1|controls=0/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-youtube.js",publicRoot))]);
});
