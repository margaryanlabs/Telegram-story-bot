import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const js=readFileSync(new URL("vetogram-music-archive.js",root),"utf8");
const base=readFileSync(new URL("vetogram-music.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-archive.css",root),"utf8");
const provider=js.slice(js.indexOf("const SOURCES="),js.indexOf("async function load(){"));
const {archiveTracks,archiveSearchUrl}=new Function(provider+"return {archiveTracks,archiveSearchUrl}")();
const sample=(licenseurl="http://creativecommons.org/licenses/by/4.0/")=>({
 metadata:{identifier:"example_1",mediatype:"audio",licenseurl,creator:"Independent musician"},
 files:[{name:"Track One.mp3",size:"1230000",source:"original",artist:"Author One",title:"Песня"},
 {name:"Track Two.mp3",size:"2450000",source:"original",title:"Հայկական"},
 {name:"sample.wav",size:"3500000",source:"original"}]
});
test("no NC or ND music is treated as commercial-use CC0/BY",()=>{
 assert.equal(archiveTracks(sample()).length,2);
 assert.equal(archiveTracks(sample("https://creativecommons.org/licenses/by-nc/4.0/")).length,0);
 assert.equal(archiveTracks(sample("http://creativecommons.org/licenses/by-nd/3.0/")).length,0);
 assert.equal(archiveTracks(sample("http://creativecommons.org/publicdomain/zero/1.0/")).length,2);
 assert.equal(archiveTracks(sample("https://example.com/licenses/by/4.0/")).length,0);
});
test("browser player gets metadata only and direct Archive MP3 URL",()=>{
 const one=archiveTracks(sample())[0];
 assert.equal(one.source,"archive");
 assert.equal(one.license,"CC BY 4.0");
 assert.equal(one.artist,"Author One");
 assert.equal(one.stream,"https://archive.org/download/example_1/Track%20One.mp3");
 assert.equal(one.permalink,"https://archive.org/details/example_1");
 assert.match(one.license_url,/creativecommons.org/);
});
test("on-demand real archive pagination uses strict licenses",()=>{
 const q=new URL(archiveSearchUrl("cc0",1));
 assert.equal(q.hostname,"archive.org");
 assert.equal(q.searchParams.get("rows"),"4");
 assert.ok(q.searchParams.get("q").includes("netlabels"));
 assert.throws(()=>archiveSearchUrl("nc",1));
 assert.throws(()=>archiveSearchUrl("cc0",0));
 assert.throws(()=>archiveSearchUrl("by3",301));
});
test("VETOGRAM archive integrated without paid database or audio copy",()=>{
 assert.ok(html.includes('data-view="archive"'));
 assert.ok(html.includes('vetogram-music-archive.js'));
 assert.ok(js.includes('providerPage(license,wantedPage,ctl.signal)'));
 assert.ok(!js.includes('/api/music-archive?'));
 assert.ok(js.includes('V.play(song,items)'));
 assert.ok(js.includes('V.toggleLike(song)'));
 assert.ok(base.includes('archive:"БИБЛИОТЕКА"'));
 assert.ok(base.includes('["radio","stream","archive"]'));
 assert.ok(css.includes('@media(max-width:640px)'));
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-archive.js",root))]);
});

test("new CC BY-SA releases expand library, but BY-NC-SA stays excluded",()=>{
 const sample=(licenseurl)=>({metadata:{identifier:"cc-sa",mediatype:"audio",creator:"Artist",licenseurl},
  files:[{name:"tune.mp3",size:"450000",source:"original",artist:"Artist",title:"Free music"}]});
 for(const ver of ["2.0","3.0","4.0"]){
  const licenseurl="http://creativecommons.org/licenses/by-sa/"+ver+"/";
  const rows=archiveTracks(sample(licenseurl));
  assert.equal(rows.length,1);
  assert.equal(rows[0].license,"CC BY-SA "+ver);
 }
 assert.equal(archiveTracks(sample("http://creativecommons.org/licenses/by-nc-sa/3.0/")).length,0);
 assert.equal(new URL(archiveSearchUrl("sa3",1)).searchParams.get("page"),"1");
 assert.throws(()=>archiveSearchUrl("ncsa",1));
 assert.match(html,/data-archive-license="sa3"/);
 assert.match(html,/data-archive-license="sa4"/);
});
