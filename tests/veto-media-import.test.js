import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
const dir=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(dir,"../public/media-import.js"),"utf8");
const prefix=source.indexOf("const clean="),suffix=source.indexOf("function restore()");
assert.ok(prefix>=0&&suffix>prefix,"expected pure import helpers");
const parseHelpers=new Function("const MAX=300,LIMIT=524288;\n"+source.slice(prefix,suffix)+"\nreturn {parse,record,safe};")();
const {parse,safe}=parseHelpers;
test("plain-text playlists parse, deduplicate and preserve Cyrillic metadata",()=>{
 const tracks=parse("Кино — Группа крови\nЗемфира - Искала\nКино — Группа крови");
 assert.equal(tracks.length,2);
 assert.deepEqual(tracks.map(x=>x.title),["Группа крови","Искала"]);
 assert.equal(tracks[0].artist,"Кино");
 assert.ok(!("url" in tracks[0]),"metadata only, no ripped links");
});
test("CSV supports headings, quoting, semicolons and newlines",()=>{
 const csv="Artist,Title\nКино,\"Группа крови, Live\"\n\"Мумий Тролль\",Владивосток 2000";
 const parsed=parse(csv,"csv");
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].title,"Группа крови, Live");
 assert.equal(parsed[1].artist,"Мумий Тролль");
 const alt=parse("Исполнитель;Название\nКино;Группа крови","csv");
 assert.equal(alt.length,1);
});
test("JSON supports exported metadata arrays and objects",()=>{
 const list=parse(JSON.stringify({format:"veto-media-playlist",version:1,tracks:[
   {artist:"Кино",title:"Группа крови"},
   {artists:[{name:"Земфира"}],name:"Искала"}
 ]}),"json");
 assert.equal(list.length,2);
 assert.equal(list[1].artist,"Земфира");
 const nested=parse(JSON.stringify({items:[{track:{artist:"Кино",title:"Спокойная ночь"}}]}),"json");
 assert.equal(nested[0].title,"Спокойная ночь");
});
test("limits malformed payloads and export contains no audio files",()=>{
 assert.throws(()=>parse(""),/Добавь список/);
 assert.throws(()=>parse("x".repeat(524289)),/512 КБ/);
 assert.throws(()=>parse("{bad","json"),/JSON/);
 const many=Array.from({length:310},(_,i)=>"Исполнитель "+i+" — Песня "+i).join("\n");
 assert.equal(parse(many).length,300);
 assert.equal(safe("javascript:alert(1)"),"");
 assert.equal(safe("https://audius.co/"),"https://audius.co/");
});
test("UI is explicit opt-in metadata only with safe links and human-approved matches",()=>{
 assert.match(source,/source\\.slice|tracks\\.map|data\\.tracks|data\\.items/);
 assert.match(source,/Варианты найдены|выбранного варианта Audius/);
 assert.match(source,/playMatchedAudius/);
 assert.match(source,/localStorage\\.setItem/);
 assert.match(source,/v10Import/);
 assert.match(source,/v10Section/);
 assert.match(source,/AbortController/);
 assert.doesNotMatch(source,/vkhost\\.github|api\\.vk\\.com|\\/api\\/music\\/download|VK_ADMIN_TOKEN/i);
 assert.doesNotMatch(source,/\\.innerHTML\\s*=\\s*.*raw\\.title/);
});
