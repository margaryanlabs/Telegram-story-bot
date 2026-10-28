import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const get=p=>readFileSync(resolve(root,p),"utf8");
function seed(){
 const ctx={window:{}};
 vm.runInNewContext(get("public/cinema-featured-200.js"),ctx);
 return Array.from(ctx.window.VetogramCinemaFeatured200);
}
test("exactly 200 genuine original publisher records, with unique film and video IDs",()=>{
 const records=seed();
 assert.equal(records.length,200);
 assert.equal(new Set(records.map(x=>x.id)).size,200);
 assert.ok(new Set(records.map(x=>x.creator)).size>=3);
 assert.ok(records.every(x=>x.sourceCatalog==="rutube-official-channel"));
 assert.ok(records.every(x=>x.contentType==="Фильмы"&&x.minutes>=35));
 assert.ok(records.every(x=>!/(серия|серии|сезон|эпизод|трейлер|анонс|тизер)/i.test(x.title)));
});
test("every seeded record has a real source page, valid original RUTUBE public iframe, and poster",()=>{
 const records=seed();
 for(const x of records){
   assert.match(x.id,/^rutube-(mosfilm|lenfilm|gorky|starmedia)-[a-f0-9]{32}$/i);
   const m=x.id.match(/([a-f0-9]{32})$/i);assert.ok(m);
   assert.equal(x.sourcePage,"https://rutube.ru/video/"+m[1]+"/");
   assert.equal(x.player.url,"https://rutube.ru/play/embed/"+m[1]);
   assert.equal(x.player.type,"iframe");
   assert.equal(x.player.licensed,true);
   assert.equal(x.player.provider,"RUTUBE");
   assert.match(x.poster,/^https:\/\/pic\.(?:rtbcdn\.ru|rtbcdn\.su|rutube\.ru|rutubelist\.ru)\//);
   assert.equal(x.spoken,"Русский");
   assert.equal(typeof x.title,"string");
   assert.ok(x.title.length>3);
   assert.ok(x.license&&x.creator);
 }
});
test("the user-facing Cinema loads the film seed before its main JS, dedupes and renders it",()=>{
 const h=get("public/cinema.html"),app=get("public/cinema.js");
 const prefix=h.indexOf('src="./cinema-featured-200.js"');
 const main=h.indexOf('src="./cinema.js"');
 assert.ok(prefix>=0&&main>prefix);
 assert.match(app,/window\.VetogramCinemaFeatured200/);
 assert.match(app,/new Map\(filmInputs\.map\(f=>\[f\.id,f\]\)\)/);
 assert.match(h,/200 фильмов уже в Cinema/);
 assert.match(app,/slice\(0,state\.visible\)/);
 assert.match(app,/cinemaMoreResults/);
});
test("all film thumbnails remain lazy loaded and full video bytes never get proxied",()=>{
 const app=get("public/cinema.js");
 const adapter=get("cinema-service/official-rutube.mjs");
 assert.match(app,/img\.loading="lazy"/);
 assert.match(adapter,/sourcePage:page/);
 assert.doesNotMatch(adapter,/downloadVideo|getMp4Url|proxyStream/);
});
