import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
function uploads(){
  const ctx={window:{}};vm.runInNewContext(read("public/cinema-foreign-rutube.js"),ctx);
  return Array.from(ctx.window.VetogramCinemaForeignRutube);
}
test("Foreign movies on RUTUBE use real video IDs, poster URLs and exact original pages",()=>{
 const records=uploads();
 assert.ok(records.length>=90);
 assert.equal(new Set(records.map(r=>r.id)).size,records.length);
 for(const f of records){
   assert.match(f.id,/^rutube-foreign-[a-f0-9]{32}$/);
   assert.equal(f.sourcePage,"https://rutube.ru/video/"+f.id.slice(-32)+"/");
   assert.match(f.poster,/^https:\/\/pic\.(?:rtbcdn\.ru|rutubelist\.ru|rutube\.ru|rtbcdn\.su)\//);
   assert.equal(f.contentType,"Фильмы");
   assert.equal(f.externalRutube,true);
   assert.equal(f.discoveryOnly,true);
   assert.equal(f.player,null,"No unverified film rights disguised as an iframe permission");
   assert.ok(Number(f.minutes)>=75);
 }
});
test("User-requested blockbusters appear in foreign-movie sources, not only domestic studios",()=>{
 const films=uploads();
 for(const title of ["Железный человек","Гарри Поттер","Мстители: Финал"]){
   assert.ok(films.some(f=>f.title.includes(title)),title);
 }
 assert.ok(films.some(f=>f.title.includes("Шрек")));
 assert.ok(films.filter(f=>f.audioClaim).length>=10);
});
test("Foreign tab and homepage shelves have connected client events and guarded playback",()=>{
 const html=read("public/cinema.html"),js=read("public/cinema.js");
 assert.match(html,/cinema-foreign-rutube\.js/);
 assert.match(html,/data-tab="foreign"/);
 for(const id of ["cinemaForeignShelf","cinemaForeignAll","cinemaForeignRail","cinemaForeignHub","cinemaForeignIncludeUnverified","cinemaForeignNote"]){
   assert.ok(html.includes('id="'+id+'"'),"missing "+id);
 }
 assert.match(js,/window\.VetogramCinemaForeignRutube/);
 assert.match(js,/function setTab\(tab\)/);
 assert.match(js,/state\.tab==="foreign"/);
 assert.match(js,/foreignIncludeUnverified/);
 assert.match(js,/f\.externalRutube\?/);
 assert.match(js,/if\(f\.discoveryOnly\)\{/,"no iframe for unverified uploads");
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
 const bindings=[...js.matchAll(/\$\("([^"]+)"\)/g)].map(x=>x[1]);
 assert.deepEqual(bindings.filter(x=>!ids.has(x)),[]);
});
