import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const jsPath=new URL("vetogram-music.js",root);
const js=readFileSync(jsPath,"utf8"),css=readFileSync(new URL("vetogram-music.css",root),"utf8");
const start=js.indexOf("function metaItem("),end=js.indexOf('$("importTextButton")',start);
const parser=new Function(
  'const clean=(v,n=120)=>String(v??"").replace(/<[^>]*>/g,"").trim().slice(0,n);'+
  'const unique=list=>{const ids=new Set();return list.filter(x=>{if(ids.has(x.id))return false;ids.add(x.id);return true})};'+js.slice(start,end)+
  "return {metaItem,parseList,parseCsv};"
)();
test("the public page is music-only and includes all required pages and player",()=>{
 for(const value of ["home","search","library","radio","import"]){
  assert.match(html,new RegExp('data-view="'+value+'"'));
 }
 for(const id of ["audio","studio","studioPlay","fileInput","playlistInput","radioForm","homeTracks","searchResults","likedTracks"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/vetogram-music\.css/);assert.match(html,/vetogram-music\.js/);
 assert.doesNotMatch(html,/filmsView|booksView|EPUB|Аудиокниги|ВЕТО CINEMA/);
});
test("music JS parses with no server secrets",()=>{
 execFileSync(process.execPath,["--check",fileURLToPath(jsPath)],{stdio:"pipe"});
 assert.match(js,/indexedDB\.open/);
 assert.match(js,/MediaMetadata/);
 assert.match(js,/mediaSession\.setActionHandler/);
 assert.match(js,/tracks\/search/);
 assert.match(js,/tracks\/trending/);
 assert.match(js,/api\.radio-browser\.info/);
 assert.match(js,/URL\.createObjectURL/);
 assert.match(js,/Veto|VetogramMusic/);
 assert.doesNotMatch(js,/telegram\.org\/bot.*getFile|TELEGRAM_BOT_TOKEN|VK_ADMIN_TOKEN|ya-music\.download|localStorage\.setItem\(.+password/);
});
test("import handles TXT, quoted CSV, semicolon CSV and JSON",()=>{
 const txt=parser.parseList("Кино — Группа крови\nЗемфира — Искала\nКино — Группа крови","list.txt");
 assert.equal(txt.length,2);
 assert.equal(txt[0].artist,"Кино");
 assert.deepEqual(parser.parseList('Artist,Title\nКино,"Группа крови, Live"',"list.csv").map(x=>x.title),["Группа крови, Live"]);
 assert.deepEqual(parser.parseList("Artist;Title\nКино;Группа крови","list.csv").map(x=>x.title),["Группа крови"]);
 assert.deepEqual(parser.parseList('{"tracks":[{"artist":"Muse","title":"Uprising"}]}',"list.json").map(x=>x.title),["Uprising"]);
 assert.throws(()=>parser.parseList("".padEnd(524289,"a"),"list.txt"),/слишком большой/i);
});
test("dynamic player uses real play/pause and honors reduced motion",()=>{
 assert.match(js,/audio\.play\(\)/);
 assert.match(js,/audio\.pause\(\)/);
 assert.match(js,/audio\.currentTime/);
 assert.match(js,/audio\.volume/);
 assert.match(js,/audio\.playbackRate/);
 assert.match(js,/audio\.src=src/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@keyframes rotateDisc/);
 assert.match(css,/\.app\[data-playing="true"\]/);
 assert.match(css,/@media\(max-width:570px\)/);
});
