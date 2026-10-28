import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("music-module.html",root),"utf8");
const core=readFileSync(new URL("vetogram-music.js",root),"utf8");
const collection=readFileSync(new URL("vetogram-music-collections.js",root),"utf8");
const catalog=readFileSync(new URL("vetogram-music-catalog.js",root),"utf8");
const js=readFileSync(new URL("vetogram-music-openverse.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-openverse.css",root),"utf8");
const start=js.indexOf("const API="),state=js.indexOf("let term=",start),functions=js.indexOf("const clean=",state),end=js.indexOf("function attribution(",functions);
assert.ok(start>0&&state>start&&functions>state&&end>functions);
const {normalize,endpoint}=new Function(js.slice(start,state)+js.slice(functions,end)+"return {normalize,endpoint};")();
const sample=(patch={})=>({
 id:"8624ba61-57f1-4f98-8a85-ece206c319cf",category:"music",mature:false,
 title:"Армянская музыка",creator:"Indie musician",license:"by",license_version:"4.0",
 license_url:"https://creativecommons.org/licenses/by/4.0/",
 foreign_landing_url:"https://example.org/free-track",
 url:"https://example.org/audio/armenian-music.mp3",
 filetype:"mp3",thumbnail:"https://example.org/album-cover.jpg",...patch
});
test("Openverse musical files use native stream, attribution and no video embed",()=>{
 const t=normalize(sample());
 assert.ok(t);
 assert.equal(t.source,"openverse");assert.equal(t.title,"Армянская музыка");
 assert.equal(t.stream,"https://example.org/audio/armenian-music.mp3");
 assert.equal(t.license,"CC BY 4.0");
 assert.equal(t.playable,true);
 assert.equal(t.permalink,"https://example.org/free-track");
 assert.ok(!("iframe" in t));
 assert.equal(normalize(sample({filetype:"mp3",url:"https://example.org/watch?v=abc"})),null);
});
test("Openverse must not quietly import noncommercial, no-derivative, mature or suspicious media",()=>{
 for(const l of ["by-nc","by-nc-sa","by-nd","by-nc-nd","sampling+"])assert.equal(normalize(sample({license:l})),null);
 assert.equal(normalize(sample({mature:true})),null);
 assert.equal(normalize(sample({category:"sound_effect"})),null);
 assert.equal(normalize(sample({provider:"jamendo"})),null);
 assert.equal(normalize(sample({url:"http://example.org/music.mp3"})),null);
 assert.equal(normalize(sample({url:"https://evil.net/video.mp4",filetype:"mp4"})),null);
 assert.equal(normalize(sample({license_url:"https://fakecreativecommons.org/licenses/by/4.0/"})),null);
 assert.equal(normalize(sample({license:"cc0",license_version:"1.0",license_url:"https://creativecommons.org/publicdomain/zero/1.0/"}))?.license,"CC0");
 assert.equal(normalize(sample({license:"by-sa",license_url:"https://creativecommons.org/licenses/by-sa/4.0/"}))?.license,"CC BY-SA 4.0");
});
test("Anonymous official music search is license scoped and bounded",()=>{
 const u=new URL(endpoint("русская музыка",1));
 assert.equal(u.hostname,"api.openverse.org");
 assert.equal(u.pathname,"/v1/audio/");
 assert.equal(u.searchParams.get("q"),"русская музыка");
 assert.equal(u.searchParams.get("category"),"music");
 assert.equal(u.searchParams.get("license"),"cc0,by,by-sa");
 assert.equal(u.searchParams.get("license_type"),"commercial");
 assert.equal(u.searchParams.get("page_size"),"20");
 assert.throws(()=>endpoint("песня",31));
 assert.throws(()=>endpoint("",1));
});
test("Real in-app player and license credits survive favorites and shared playlists",()=>{
 assert.ok(html.includes('id="openAudioResults"'));
 assert.ok(html.includes('id="openAudioSearchResults"'));
 assert.ok(html.includes('id="openAudioSearchStatus"'));
 assert.ok(html.includes('id="openAudioStatus"'));
 assert.ok(html.includes('id="openAudioMore"'));
 assert.ok(html.includes('src="./vetogram-music-openverse.js"'));
 assert.ok(html.indexOf('vetogram-music.js')<html.indexOf('vetogram-music-openverse.js'));
 assert.ok(catalog.includes("vetogram:catalog-query"));
 assert.ok(js.includes("vetogram:search-query"));
 assert.ok(core.includes("vetogram:search-query"));
 assert.ok(js.includes("resultsContainers()"));
 assert.ok(js.includes("app.play(track,items)"));
 assert.ok(js.includes("app.toggleLike(track)"));
 assert.ok(core.includes('"openverse"'));
 assert.ok(collection.includes('"openverse"'));
 assert.match(js,/details","open-audio-rights"/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.doesNotMatch(html,/YouTube|Apple Music|Spotify/);
});
test("Non-responsive extra service does not break primary catalog",()=>{
 assert.match(js,/Дополнительный поиск временно недоступен/);
 assert.match(js,/Дополнительная библиотека сейчас недоступна/);
 assert.doesNotMatch(js,/yt-dlp|YouTube\/embed|previewUrl|downloadMP3/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-openverse.js",root))]);
});
