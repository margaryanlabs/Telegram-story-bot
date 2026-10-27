import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const html=readFileSync(resolve(root,"public/cinema.html"),"utf8");
const js=readFileSync(resolve(root,"public/cinema.js"),"utf8");
const css=readFileSync(resolve(root,"public/cinema-premiere.css"),"utf8");
const studio=readFileSync(resolve(root,"cinema-service/official-rutube.mjs"),"utf8");
test("cinema hero has buttons and dots with real rotating film metadata",()=>{
 for(const id of ["cinemaHeroPrev","cinemaHeroNext","cinemaHeroDots","cinemaHeroCounter",
   "cinemaHeroTitle","cinemaHeroBackdrop","cinemaHeroEyebrow"])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/function setHeroSlide\(index\)/);
 assert.match(js,/setHeroSlide\(discovery\.index\+1\)/);
 assert.match(js,/aria-current/);
 assert.match(css,/\.cinema-hero-footer/);
 assert.match(css,/\.cinema-hero-dot/);
});
test("new releases, series, animation, genre filters and six archive tabs are all rendered",()=>{
 for(const id of ["cinemaLatest","cinemaLatestRail","cinemaSeries","cinemaSeriesRail",
  "cinemaAnimations","cinemaAnimationsRail","cinemaGenreTiles","cinemaGenresSection",
  "cinemaStudioGrid","cinemaStudioMore"])
  assert.match(html,new RegExp('id="'+id+'"'));
 const names=["mosfilm","lenfilm","gorky","starmedia","marsmedia","soyuzmultfilm"];
 for(const name of names)assert.match(html,new RegExp('data-studio="'+name+'"'));
 assert.match(js,/async function warmStudioFeeds/);
 assert.match(js,/function refreshDiscovery/);
 assert.match(css,/\.cinema-genre-tiles/);
 assert.match(css,/\.cinema-editorial-rail/);
});
test("official publisher sources are required and preserve actual upload metadata",()=>{
 assert.match(studio,/author\?\.id/);
 assert.match(studio,/publishedAt/);
 assert.match(studio,/contentType/);
 assert.match(studio,/minDuration=animation\?150:35\*60/);
 assert.match(studio,/soyuzmultfilm:Object\.freeze\(\{id:12056/);
 assert.match(studio,/pic\.rtbcdn\.ru/);
});
test("homepage does not wait for a blocked Telegram CDN",()=>{
 assert.match(html,/script async src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"/);
 assert.match(js,/window\.addEventListener\("load"/);
 assert.match(css,/--bg:#07090e/);
 assert.doesNotMatch(css,/--accent:#fa7562/);
});
