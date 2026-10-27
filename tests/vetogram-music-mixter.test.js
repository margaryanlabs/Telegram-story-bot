import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const main=readFileSync(new URL("vetogram-music.js",root),"utf8");
const code=readFileSync(new URL("vetogram-music-mixter.js",root),"utf8");
const seed=readFileSync(new URL("vetogram-music-mixter-seeds.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-mixter.css",root),"utf8");
const collection=readFileSync(new URL("vetogram-music-collections.js",root),"utf8");
const begin=code.indexOf('const API='),end=code.indexOf('let genre=');
assert.ok(begin>=0&&end>begin);
const {mapped,endpoint,license}=new Function(code.slice(begin,end)+'return {mapped,endpoint,license}')();
const fixture=(license_url="http://creativecommons.org/licenses/by/4.0/")=>({
 upload_id:8245,upload_name:"Open independent music",user_real_name:"Musician",
 file_page_url:"https://ccmixter.org/files/example/8245",license_url,
 files:[{download_url:"https://ccmixter.org/content/example/music.mp3",file_rawsize:5023442,
  file_format_info:{"media-type":"audio",mime_type:"audio/mpeg"}}]
});
test("ccMixter panel integrates as music-only page before its JS runs",()=>{
 assert.match(html,/data-view="mixter"/);
 assert.match(html,/data-page="mixter"/);
 assert.match(html,/id="mixterGenres"/);
 assert.match(html,/id="mixterTracks"/);
 assert.match(html,/vetogram-music-mixter\.css/);
 assert.ok(html.indexOf('vetogram-music.js')<html.indexOf('vetogram-music-mixter.js'));
 assert.ok(html.indexOf('vetogram-music-mixter-seeds.js')<html.indexOf('vetogram-music-mixter.js'));
 assert.match(main,/vetogram:mixter-open/);
 assert.match(main,/mixter:"CC РЕМИКСЫ"/);
});
test("query uses ccMixter official JSON API and pagination with license=by",()=>{
 const url=new URL(endpoint("jazz",40,""));
 assert.equal(url.host,"ccmixter.org");
 assert.equal(url.pathname,"/api/query");
 assert.equal(url.searchParams.get("f"),"json");
 assert.equal(url.searchParams.get("lic"),"by");
 assert.equal(url.searchParams.get("tags"),"jazz");
 assert.equal(url.searchParams.get("offset"),"40");
 assert.equal(new URL(endpoint("remix",20,"Հայկական jazz")).searchParams.get("search"),"Հայկական jazz");
});
test("only direct MP3s and CC0 / CC-BY with correct attribution, no NC or ND",()=>{
 const m=mapped(fixture());
 assert.equal(m.id,"ccmixter:8245");
 assert.equal(m.stream,"https://ccmixter.org/content/example/music.mp3");
 assert.equal(m.license,"CC BY 4.0");
 assert.equal(m.license_url,"https://creativecommons.org/licenses/by/4.0/");
 assert.equal(m.artist,"Musician");
 assert.equal(mapped(fixture("http://creativecommons.org/licenses/by-nc/4.0/")),null);
 assert.equal(mapped(fixture("http://creativecommons.org/licenses/by-nd/4.0/")),null);
 assert.equal(mapped({...fixture(),files:[{...fixture().files[0],download_url:"https://evil.example/file.mp3"}]}),null);
 assert.equal(mapped({...fixture(),files:[{...fixture().files[0],download_url:"https://ccmixter.org/file.zip"}]}),null);
 assert.equal(mapped({...fixture(),upload_id:-10}),null);
 assert.equal(license("http://creativecommons.org/licenses/by-sa/4.0/"),"");
});
test("verified seed collection and licensed favorites survive with links",()=>{
 assert.match(seed,/VetogramMixterSeeds/);
 assert.match(code,/seedExtras\(\)/);
 assert.match(code,/V\.play\(t,items\)/);
 assert.match(code,/V\.toggleLike\(t\)/);
 assert.match(main,/ccmixter/);
 assert.match(collection,/CC|ccmixter/);
 assert.match(collection,/license_url/);
 assert.match(collection,/Автор \/ источник/);
});
test("source failures are described, not masked with fake hits",()=>{
 assert.match(code,/CORS/);
 assert.match(code,/ccmixter\.org/);
 assert.match(css,/@media\(max-width:650px\)/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-mixter.js",root))],{stdio:"pipe"});
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-mixter-seeds.js",root))],{stdio:"pipe"});
});
