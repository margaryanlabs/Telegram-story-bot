import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const app=readFileSync(new URL("vetogram-music.js",root),"utf8");
const code=readFileSync(new URL("vetogram-music-catalog.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-catalog.css",root),"utf8");
const from=code.indexOf("const clean="),to=code.indexOf("let items=",from);
const {normalize,endpoint}=new Function('const API="https://api.audius.co/v1/tracks/search";const LIMIT=40;'+code.slice(from,to)+'return {normalize,endpoint}')();
test("standalone music includes connected catalog without changing messenger routes",()=>{
 assert.match(html,/data-view="catalog"/);
 assert.match(html,/data-page="catalog"/);
 assert.match(html,/id="catalogResults"/);
 assert.match(html,/id="catalogMore"/);
 assert.match(html,/vetogram-music-catalog\.css/);
 assert.match(html,/vetogram-music-catalog\.js/);
 assert.ok(html.indexOf('vetogram-music.js')<html.indexOf('vetogram-music-catalog.js'));
 assert.match(app,/vetogram:catalog-open/);
 assert.match(app,/catalog:"КАТАЛОГ"/);
 assert.doesNotMatch(html,/data-region=|regionStations/);
});
test("catalog sources actual provider responses, not placeholders",()=>{
 assert.match(code,/api\.audius\.co\/v1\/tracks\/search/);
 assert.match(code,/fetch\(endpoint\(q,offset\)/);
 assert.match(code,/Array\.isArray\(data\?\.data\)/);
 assert.match(code,/V\.play\(track,items\)/);
 assert.match(code,/data-catalog-group/);
 assert.match(code,/MAX_RESULTS=800/);
 assert.doesNotMatch(code,/getFile\(|download_url|vk\.com|music\.yandex\.ru|DRM|scrape/i);
});
test("catalog normalizes safe Audius playable records and handles unicode",()=>{
 const t={id:"A_Z-12",title:"Հայկական երգ",user:{name:"Արտիստ"},artwork:{"150x150":"https://media.example.org/c.jpg"},duration:122.8};
 assert.deepEqual(normalize(t),{id:"audius:A_Z-12",source:"audius",title:"Հայկական երգ",artist:"Արտիստ",artwork:"https://media.example.org/c.jpg",permalink:"",duration:122.8});
 assert.equal(normalize({...t,is_stream_gated:true}),null);
 assert.equal(normalize({...t,is_unlisted:true}),null);
 assert.equal(normalize({...t,is_delete:true}),null);
 assert.equal(normalize({...t,id:"../../etc/passwd"}),null);
 assert.equal(normalize({...t,title:""}),null);
 assert.equal(normalize({...t,artwork:{"150x150":"javascript:alert(1)"}}).artwork,"");
});
test("next page uses bounded offset and exact UTF-8 search",()=>{
 const url=new URL(endpoint("русский рэп հայկական",40));
 assert.equal(url.origin,"https://api.audius.co");
 assert.equal(url.searchParams.get("query"),"русский рэп հայկական");
 assert.equal(url.searchParams.get("offset"),"40");
 assert.equal(url.searchParams.get("limit"),"40");
});
test("catalog is mobile friendly and JS syntax is valid",()=>{
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-catalog.js",root))],{stdio:"pipe"});
});
