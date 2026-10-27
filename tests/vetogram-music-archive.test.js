import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {mapArchiveItem,archiveSearchUrl} from "../public/api/music-archive.js";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const js=readFileSync(new URL("vetogram-music-archive.js",root),"utf8");
const base=readFileSync(new URL("vetogram-music.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-archive.css",root),"utf8");
const sample=(url="http://creativecommons.org/licenses/by/4.0/")=>({
 metadata:{identifier:"test_release_9",creator:"Verified uploader",mediatype:"audio",licenseurl:url},
 files:[{name:"Track 1.mp3",size:"4545678",source:"original",artist:"Artist One",title:"Песня Один"},
 {name:"Track 1.ogg",size:"4545678",source:"derivative"},
 {name:"Track 2.mp3",size:"2120000",source:"original",title:"Հայկական"},
 {name:"archive.zip",size:"32345",source:"original"}]
});
test("archive only indexes CC0 and CC BY and not NC/ND",()=>{
 assert.equal(mapArchiveItem(sample()).length,2);
 assert.equal(mapArchiveItem(sample("http://creativecommons.org/licenses/by-nc/3.0/")).length,0);
 assert.equal(mapArchiveItem(sample("http://creativecommons.org/licenses/by-nd/4.0/")).length,0);
 assert.equal(mapArchiveItem(sample("https://creativecommons.org/publicdomain/zero/1.0/")).length,2);
 assert.equal(mapArchiveItem(sample("https://evil.example/licenses/by/4.0/")).length,0);
 assert.equal(mapArchiveItem({...sample(),metadata:{identifier:"X",mediatype:"video",licenseurl:"http://creativecommons.org/licenses/by/4.0/"}}).length,0);
});
test("direct links preserve media owner and artist attribution",()=>{
 const x=mapArchiveItem(sample())[0];
 assert.equal(x.source,"archive");assert.equal(x.artist,"Artist One");assert.equal(x.license,"CC BY 4.0");
 assert.equal(x.stream,"https://archive.org/download/test_release_9/Track%201.mp3");
 assert.equal(x.permalink,"https://archive.org/details/test_release_9");
 assert.ok(x.license_url.includes("creativecommons.org"));
});
test("search is on-demand, keyed to actual Archive license and bounds",()=>{
 const x=new URL(archiveSearchUrl("by4",2));
 assert.equal(x.hostname,"archive.org");assert.equal(x.searchParams.get("page"),"2");
 assert.ok(x.searchParams.get("q").includes("licenseurl"));
 assert.throws(()=>archiveSearchUrl("all",1));
 assert.throws(()=>archiveSearchUrl("cc0",0));
 assert.throws(()=>archiveSearchUrl("cc0",301));
});
test("VETOGRAM Music navigation and favorites use same player",()=>{
 assert.ok(html.includes('data-view="archive"'));
 assert.ok(html.includes('data-page="archive"'));
 assert.ok(html.includes('id="archiveList"'));
 assert.ok(html.includes('vetogram-music-archive.js'));
 assert.ok(base.includes('vetogram:archive-open'));
 assert.ok(base.includes('archive:"БИБЛИОТЕКА"'));
 assert.ok(js.includes('V.play(song,items)'));
 assert.ok(js.includes('V.toggleLike(song)'));
 assert.ok(base.includes('["radio","stream","archive"]'));
 assert.ok(css.includes('@media(max-width:640px)'));
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-archive.js",root))]);
});
