import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=new URL("../public/",import.meta.url);
const src=readFileSync(new URL("vetogram-music-experimental.js",root),"utf8");
const html=readFileSync(new URL("index.html",root),"utf8");
const core=readFileSync(new URL("vetogram-music.js",root),"utf8");
const lists=readFileSync(new URL("vetogram-music-collections.js",root),"utf8");
const style=readFileSync(new URL("vetogram-music-experimental.css",root),"utf8");
const start=src.indexOf("const HOSTS="),end=src.indexOf("async function readJson(",start);
assert.ok(start>0&&end>start);
const pure=src.slice(start,end);
const {videoId,normalize,chooseAudio,validURL}=new Function(
 'const byId=()=>({canPlayType:(type)=>type==="audio/mp4"?"probably":type==="audio/webm"?"maybe":""});'+pure+
 'return {videoId,normalize,chooseAudio,validURL};'
)();

test("Piped discovery accepts full-length audio candidates and rejects live/invalid rows",()=>{
 const song={url:"/watch?v=y14ulAguQv4",title:"Armenian Song",uploaderName:"Artist",duration:201,type:"stream"};
 assert.equal(normalize(song)?.source,"experimental");
 assert.equal(normalize(song)?.videoId,"y14ulAguQv4");
 assert.equal(normalize({...song,duration:0}),null);
 assert.equal(normalize({...song,duration:3000}),null);
 assert.equal(normalize({...song,type:"channel"}),null);
 assert.equal(normalize({...song,url:"https://evil.example/watch?v=y14ulAguQv4"}),null);
 assert.equal(videoId("https://www.youtube.com/watch?v=y14ulAguQv4"),"y14ulAguQv4");
});

test("safe audio source validation never selects plaintext/private host or video-only stream",()=>{
 assert.equal(validURL("http://example.org/song.mp3"),"");
 assert.equal(validURL("https://localhost/song.mp3"),"");
 assert.equal(validURL("https://127.0.0.1/song.mp3"),"");
 assert.equal(validURL("https://192.168.2.6/song.mp3"),"");
 assert.equal(validURL("https://cdn.example.org/audio.mp4"),"https://cdn.example.org/audio.mp4");
 const good={mimeType:"audio/mp4",bitrate:128000,url:"https://cdn.example.org/audio.mp4",videoOnly:false};
 assert.equal(chooseAudio({audioStreams:[{...good,url:"http://invalid/video"},{...good,videoOnly:true},good]}),good.url);
 assert.equal(chooseAudio({audioStreams:[{...good,mimeType:"video/mp4"}]}),"");
 assert.equal(chooseAudio({livestream:true,audioStreams:[good]}),"");
});

test("native audio player handles experimental tracks on demand, including next/previous queue",()=>{
 assert.match(core,/track\.source==="experimental"&&!resolved/);
 assert.match(core,/provider\.resolve\(track\)/);
 assert.match(core,/experimentalRequest/);
 assert.match(core,/state\.queue=unique/);
 assert.match(lists,/openverse","experimental"/);
 assert.ok(html.includes('src="./vetogram-music-experimental.js"'));
 assert.ok(html.includes('src="./vetogram-music-experimental.css"'));
 assert.ok(html.indexOf('src="./vetogram-music.js"')<html.indexOf('src="./vetogram-music-experimental.js"'));
});

test("music UI has search, favorite, no video embeds, and reliable fallbacks",()=>{
 assert.match(html,/id="experimentalResults"/);
 assert.match(html,/id="experimentalStatus"/);
 assert.match(html,/data-experimental-query="MACAN"/);
 assert.match(src,/app\.play\(track,tracks\)/);
 assert.match(src,/app\.toggleLike\(track\)/);
 assert.doesNotMatch(src,/<iframe|document\.createElement\(["']iframe|yt-dlp|youtube-dl|downloadAudio/);
 assert.match(src,/Экспериментальный каталог сейчас не отвечает/);
 assert.match(html,/Некоммерческая бета не отменяет авторских прав/);
 assert.match(style,/@media\(max-width:640px\)/);
 for(const p of ["vetogram-music.js","vetogram-music-experimental.js"])
  execFileSync(process.execPath,["--check",fileURLToPath(new URL(p,root))],{stdio:"pipe"});
});
