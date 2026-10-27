import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=new URL("../public/",import.meta.url);
const jsUrl=new URL("vetogram-music-charts.js",root);
const source=readFileSync(jsUrl,"utf8");
const html=readFileSync(new URL("index.html",root),"utf8");
const app=readFileSync(new URL("vetogram-music.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-charts.css",root),"utf8");
const from=source.indexOf("function mapAudius("),to=source.indexOf("async function json(",from);
assert.ok(from>0&&to>from);
const provider=new Function(
  'const radioHosts=["https://de1.api.radio-browser.info"];'+
  'const clean=(v,n=130)=>String(v??"").replace(/<[^>]*>/g," ").trim().slice(0,n);'+
  'const https=v=>{try{const u=new URL(String(v));return u.protocol==="https:"?u.href:""}catch{return""}};'+
  source.slice(from,to)+"return {mapAudius,mapRadio,chartEndpoint,radioEndpoint,searchEndpoint};"
)();

test("VETOGRAM Music exposes a functioning chart destination on desktop and mobile",()=>{
  assert.match(html,/data-view="charts"/);
  assert.match(html,/data-page="charts"/);
  assert.match(html,/id="chartsTracks"/);
  assert.match(html,/id="regionTracks"/);
  assert.match(html,/id="regionStations"/);
  assert.match(html,/vetogram-music-charts\.js/);
  assert.match(html,/vetogram-music-charts\.css/);
  assert.match(app,/charts:"ЧАРТЫ"/);
  assert.match(app,/vetogram:charts-open/);
  assert.match(css,/charts-hero/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  execFileSync(process.execPath,["--check",fileURLToPath(jsUrl)],{stdio:"pipe"});
});

test("worldwide chart ranks are sourced from Audius trending, not a fake Russian top",()=>{
 const week=new URL(provider.chartEndpoint("week","all"));
 assert.equal(week.origin,"https://api.audius.co");
 assert.equal(week.pathname,"/v1/tracks/trending");
 assert.equal(week.searchParams.get("time"),"week");
 assert.equal(week.searchParams.get("limit"),"30");
 const rap=new URL(provider.chartEndpoint("month","Hip-Hop/Rap"));
 assert.equal(rap.searchParams.get("genre"),"Hip-Hop/Rap");
 assert.throws(()=>provider.chartEndpoint("lifetime", "all"),/период/);
 assert.doesNotMatch(source,/Math\.random\(\).*rank|faker|fakeChart|mockRanking/);
});

test("Armenian/Russian radio charts filter by exact countrycode, not names",()=>{
 const ru=provider.radioEndpoint("RU"),am=provider.radioEndpoint("AM");
 assert.match(ru,/bycountrycodeexact\/ru/);
 assert.match(am,/bycountrycodeexact\/am/);
 assert.match(ru,/hidebroken=true/);
 assert.match(ru,/order=votes/);
 assert.throws(()=>provider.radioEndpoint("US"),/страна/);
});

test("radio stations are HTTPS, healthy and reject HLS and mixed-content feeds",()=>{
 const good=provider.mapRadio({stationuuid:"station-id",name:"Armenian Radio",country:"Armenia",
  url_resolved:"https://radio.example.org/live.mp3",homepage:"https://radio.example.org",lastcheckok:1,codec:"MP3",votes:100});
 assert.equal(good.source,"radio");
 assert.equal(good.stream,"https://radio.example.org/live.mp3");
 assert.equal(good.votes,100);
 assert.equal(provider.mapRadio({...good,stationuuid:"bad",url_resolved:"http://example.org/live"}),null);
 assert.equal(provider.mapRadio({...good,stationuuid:"bad2",url_resolved:"https://example.org/live.m3u8"}),null);
});

test("Audius converter accepts accessible tracks and refuses gated or deleted files",()=>{
 const input={id:"abc123",title:"Հայկական երաժշտություն",user:{name:"Independent Artist"},
  permalink:"https://audius.co/artist/song",artwork:{"150x150":"https://img.example.org/art.jpg"},is_stream_gated:false};
 const row=provider.mapAudius(input);
 assert.equal(row.title,"Հայկական երաժշտություն");
 assert.equal(row.source,"audius");
 assert.equal(row.id,"audius:abc123");
 assert.equal(provider.mapAudius({...input,is_stream_gated:true}),null);
 assert.equal(provider.mapAudius({...input,is_delete:true}),null);
 assert.equal(provider.mapAudius({...input,id:"bad/scheme"}),null);
});

test("regional results stay labelled as search results, not claimed national chart",()=>{
 const url=new URL(provider.searchEndpoint("Հայկական"));
 assert.equal(url.pathname,"/v1/tracks/search");
 assert.equal(url.searchParams.get("query"),"Հայկական");
 assert.match(source,/Происхождение и оригинальность записи проверяй у автора/);
 assert.match(source,/рейтинг только Audius/);
 assert.doesNotMatch(source,/vk\.com|music\.yandex\.ru|fetch\(.+mp3|TELEGRAM_BOT_TOKEN/);
});
