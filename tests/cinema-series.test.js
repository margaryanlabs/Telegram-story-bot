import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(ROOT,p),"utf8");
function load(){
 const context={window:{}};for(const path of ["public/cinema-featured-200.js","public/cinema-series-episodes.js","public/cinema-popular-series.js"])
  vm.runInNewContext(read(path),context);
 return context.window;
}
test("200 full feature films stay separate from 99 series episodes and 34 popular RU-audio titles",()=>{
 const w=load(),films=Array.from(w.VetogramCinemaFeatured200),
 eps=Array.from(w.VetogramCinemaSeriesEpisodes),
 top=Array.from(w.VetogramCinemaPopularSeries);
 assert.equal(films.length,200);
 assert.equal(eps.length,99);
 assert.equal(top.length,34);
 assert.equal(new Set([...films,...eps,...top].map(x=>x.id)).size,333);
 assert.ok(films.every(x=>x.contentType==="Фильмы"));
 assert.ok(eps.every(x=>x.contentType==="Сериалы"&&x.player?.licensed===true));
 assert.ok(top.every(x=>x.contentType==="Сериалы"&&x.player===null&&x.discoveryOnly));
});
test("all series episodes are real media IDs and exact public original-player links",()=>{
 const eps=Array.from(load().VetogramCinemaSeriesEpisodes);
 for(const ep of eps){
   assert.match(ep.id,/^rutube-(starmedia|marsmedia)-[a-f0-9]{32}$/i);
   const videoId=ep.id.slice(-32);
   assert.equal(ep.player.url,"https://rutube.ru/play/embed/"+videoId);
   assert.equal(ep.sourcePage,"https://rutube.ru/video/"+videoId+"/");
   assert.match(ep.poster,/^https:\/\/pic\.(rtbcdn\.ru|rtbcdn\.su|rutube\.ru|rutubelist\.ru)\//);
   assert.equal(ep.spoken,"Русский");
   assert.ok(ep.minutes>=35);
 }
});
test("popular shows have evidence for listed Russian audio, not fake streaming permissions",()=>{
 const pop=Array.from(load().VetogramCinemaPopularSeries);
 for(const title of ["Игра престолов","Дом Дракона","Сопрано","Наследники","Очень странные дела","Уэнздей","Игра в кальмара"]){
   assert.ok(pop.some(x=>x.title===title),title);
 }
 for(const x of pop){
   assert.equal(x.russianAudioStatus,"catalog-listed");
   assert.equal(x.russianAudio?.language,"ru");
   assert.equal(x.watchAvailability,"unknown");
   assert.equal(x.player,null);
   assert.ok(x.sourcePage.startsWith("https://"));
   assert.ok(!x.sourcePage.includes("rutube.ru/video"));
 }
});
test("desktop/mobile TV tab and real series/player/episode UI are wired with no paid-service promotion",()=>{
 const h=read("public/cinema.html"),js=read("public/cinema.js");
 assert.equal(Array.from(h.matchAll(/data-tab="series"/g)).length,2);
 for(const p of ["cinema-series-episodes.js"])
   assert.ok(h.indexOf(p)>0&&h.indexOf(p)<h.indexOf("cinema.js"));
 for(const id of ["cinemaSeriesHub","cinemaSeriesStats","cinemaSeriesPlayableRail","cinemaEpisodeChooser","cinemaEpisodeSelect"])
   assert.match(h,new RegExp('id="'+id+'"'));
 assert.ok(!h.includes('src="./cinema-popular-series.js"'));
 assert.ok(!h.includes('id="cinemaPopularSeries"'));
 assert.ok(!js.includes("window.VetogramCinemaPopularSeries"));
 assert.match(js,/if\(state\.tab==="series"\)list=list\.filter\(f=>f\.contentType==="Сериалы"&&f\.player\?\.licensed===true\)/);
 assert.match(js,/function groupedSeries\(/);
 assert.match(js,/function seriesEpisodeNumber\(/);
 assert.match(js,/if\(state\.tab==="series"\)list=list\.filter/);
 const ids=new Set(Array.from(h.matchAll(/\bid="([^"]+)"/g),m=>m[1]));
 const used=Array.from(js.matchAll(/\$\("([^"]+)"\)/g),m=>m[1]);
 assert.deepEqual(used.filter(x=>!ids.has(x)),[]);
});
test("episode switcher groups Cyrillic 'серия' accurately without creating fake seasons",()=>{
 const js=read("public/cinema.js");
 const start=js.indexOf("  function seriesShowName("),end=js.indexOf("  function renderSeriesCollections(){",start);
 assert.ok(start>0&&end>start);
 const episodes=Array.from(load().VetogramCinemaSeriesEpisodes);
 const selectors=new Function("films","uploadTime",js.slice(start,end)+
   "\nreturn {seriesShowName,seriesEpisodeNumber,groupedSeries};")(episodes,
   f=>Date.parse(f.publishedAt||"")||0);
 const group=selectors.groupedSeries();
 assert.ok(group.length<70&&group.length>15);
 const woman=group.find(g=>selectors.seriesShowName(g[0])==="Женщина в беде");
 assert.equal(woman.length,4);
 assert.deepEqual(woman.map(x=>selectors.seriesEpisodeNumber(x)),[1,2,3,4]);
 const woman2=group.find(g=>selectors.seriesShowName(g[0])==="Женщина в беде - 2");
 assert.equal(woman2.length,4);
 const viking=group.find(g=>selectors.seriesShowName(g[0])==="Викинг · сезон 2");
 assert.ok(viking.length>=4);
});
