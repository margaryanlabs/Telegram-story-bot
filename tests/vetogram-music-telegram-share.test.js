import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const script=readFileSync(new URL("vetogram-music-telegram.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-telegram.css",root),"utf8");
test("personal audio is the only source eligible for OS sharing",()=>{
 assert.match(script,/track\?\.source!=="local"/);
 assert.match(script,/track\.blob instanceof Blob/);
 assert.match(script,/\.m4a/);
 assert.match(script,/\.mp3/);
 assert.match(script,/file\.size>30\*1024\*1024/);
 assert.doesNotMatch(script,/youtube-dl|yt-dlp|m4a.*music\.apple\.com|downloadFromSpotify/);
});
test("user decides whether to send and where, and can fall back to local file download",()=>{
 assert.match(script,/navigator\.canShare\(\{files:\[file\]\}\)/);
 assert.match(script,/await navigator\.share\(\{files:\[file\]/);
 assert.match(script,/a\.download=file\.name/);
 assert.match(script,/e\?\.name==="AbortError"/);
 assert.match(html,/id="telegramAudioSelect"/);
 assert.match(html,/id="telegramShareAudio"/);
 assert.match(html,/id="telegramAudioStatus"/);
 assert.match(html,/бот пока не подключён к серверу/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test("standalone music scripts parse without a backend secret",()=>{
 assert.ok(html.indexOf("vetogram-music.js")<html.indexOf("vetogram-music-telegram.js"));
 assert.ok(html.includes("vetogram-music-telegram.css"));
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-telegram.js",root))]);
});
