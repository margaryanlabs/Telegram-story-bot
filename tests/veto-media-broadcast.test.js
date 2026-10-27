import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const jsUrl=new URL("../public/media-broadcast.js",import.meta.url);
const css=readFileSync(new URL("../public/media-broadcast.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../public/media.html",import.meta.url),"utf8");
const source=readFileSync(jsUrl,"utf8");
const start=source.indexOf("const radioMapper="),end=source.indexOf("async function getJson(",start);
const pure=new Function("const clean=(v,n=140)=>String(v??'').replace(/<[^>]*>/g,'').trim().slice(0,n);"+
"const safe=v=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return''}};"+
source.slice(start,end)+"return {radioMapper,podcastMapper};")();
test("V14 asset wiring, syntax and accessible source search",()=>{
 assert.match(html,/media-broadcast\.css/);
 assert.match(html,/media-broadcast\.js/);
 assert.match(source,/v14Broadcast/);
 assert.match(source,/v14SearchForm/);
 assert.match(source,/v14PodcastTab/);
 assert.match(source,/aria-pressed/);
 assert.match(css,/v14-broadcast/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 execFileSync(process.execPath,["--check",fileURLToPath(jsUrl)],{stdio:"pipe"});
});
test("Radio Browser filters HTTPS streams and unhealthy/invalid station entries",()=>{
 const radio=pure.radioMapper({stationuuid:"123e4567-e89b-12d3-a456-426614174000",
  name:"VETO Jazz",country:"Armenia",tags:"jazz",url_resolved:"https://radio.example.org/live.mp3",
  homepage:"https://radio.example.org",favicon:"https://radio.example.org/cover.png",lastcheckok:1,
  codec:"MP3",hls:0});
 assert.equal(radio.type,"radio");
 assert.equal(radio.stream,"https://radio.example.org/live.mp3");
 assert.equal(radio.href,"https://radio.example.org/");
 assert.equal(pure.radioMapper({stationuuid:"no",name:"Down",lastcheckok:0}),null);
 assert.equal(pure.radioMapper({stationuuid:"",name:"No ID",lastcheckok:1}),null);
 const http=pure.radioMapper({stationuuid:"a",name:"HTTP-only station",lastcheckok:1,url_resolved:"http://example.org/live"});
 assert.equal(http.stream,"");
});
test("HLS stations do not show unsupported browser playback as guaranteed",()=>{
 const station=pure.radioMapper({stationuuid:"id",name:"HLS",lastcheckok:1,url_resolved:"https://example.org/live.m3u8"});
 assert.equal(station.isHls,true);
});
test("Apple podcast catalog provides official links, no embedded paid media",()=>{
 const podcast=pure.podcastMapper({collectionId:245456,collectionName:"History",artistName:"Radio",
  artworkUrl600:"https://img.example.org/podcast.jpg",collectionViewUrl:"https://podcasts.apple.com/us/podcast/abc/id245456"});
 assert.equal(podcast.type,"podcast");
 assert.equal(podcast.href,"https://podcasts.apple.com/us/podcast/abc/id245456");
 assert.equal(pure.podcastMapper({collectionId:"x",collectionName:"Bad",collectionViewUrl:"https://podcasts.apple.com/"}),null);
 assert.equal(pure.podcastMapper({collectionId:1,collectionName:"Bad",collectionViewUrl:"javascript:alert(1)"}),null);
});
test("Only user-clicked radio streams play through shared player",()=>{
 assert.match(source,/audio\.src=item\.stream/);
 assert.match(source,/audio\.play\(\)/);
 assert.match(source,/url_resolved/);
 assert.match(source,/https:\/\/itunes\.apple\.com\/search/);
 assert.match(source,/api\.radio-browser\.info/);
 assert.match(source,/AbortController/);
 assert.match(source,/credentials:"omit"/);
 assert.doesNotMatch(source,/VK_ADMIN_TOKEN|TELEGRAM_BOT_TOKEN|document\.cookie|eval\(|new Function\(/);
});
