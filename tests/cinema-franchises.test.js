import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const file=name=>readFileSync(resolve(root,name),"utf8");
function franchises(){
 const ctx={window:{}};
 vm.runInNewContext(file("public/cinema-russian-audio.js"),ctx);
 vm.runInNewContext(file("public/cinema-franchises.js"),ctx);
 return Array.from(ctx.window.VetogramCinemaFranchises);
}
test("MCU, Potter and Marvel legacy are complete curated discovery rails",()=>{
 const f=franchises(),counts=Object.fromEntries(["mcu","potter","legacy"].map(kind=>[kind,f.filter(x=>x.franchise===kind).length]));
 assert.deepEqual(counts,{mcu:38,potter:11,legacy:39});
 assert.equal(new Set(f.map(x=>x.id)).size,88);
 assert.equal(f.filter(x=>/Гарри Поттер и/.test(x.title)).length,8);
 assert.ok(f.some(x=>x.original==='Spider-Man: Brand New Day'&&x.year===2026));
 assert.ok(f.some(x=>x.original==='Blade II'));
 assert.ok(f.some(x=>x.original==='Kraven the Hunter'));
 assert.ok(f.some(x=>x.original==="Avengers: Endgame"));
 assert.ok(f.some(x=>x.original==="The Fantastic Four: First Steps"));
 assert.ok(f.some(x=>x.original==="Spider-Man: Across the Spider-Verse"));
});
test("discovery cards never pretend they contain licensed streams or Russian dubbing",()=>{
 for(const f of franchises()){
   assert.equal(f.discoveryOnly,true);
   assert.equal(f.player,null);
   assert.equal(f.poster,null);
   assert.equal(f.sourceCatalog,"franchise-availability");
   assert.match(f.sourcePage,/^https:\/\//);
   assert.equal(f.spoken,f.russianAudio?"Русская дорожка указана в каталоге":"Русский язык не подтверждён");
   assert.equal(f.russianAudioStatus,f.russianAudio?"catalog-listed":"unknown");
   assert.equal(f.watchAvailability,f.russianAudio?.availability||"unknown");
   assert.ok(!f.sourcePage.includes("rutube"));
   assert.ok(f.franchiseName);
 }
});
test("cinema routes franchise watch actions to official page before attaching a player",()=>{
 const js=file("public/cinema.js");
 const start=js.indexOf("async function play(f, chosenSource){");
 const gate=js.indexOf("if(f.discoveryOnly){",start);
 const provider=js.indexOf("state.embedHandle",start);
 assert.ok(start>0&&gate>start&&provider>gate);
 assert.match(js.slice(gate,provider),/tg\?\.openLink/);
 assert.match(js,/if\(!f\.player&&!f\.discoveryOnly\)getCommons\(f\)/);
 assert.match(js,/else if\(!f\.discoveryOnly\)requestPoster\(f\)/);
 assert.match(js,/РУССКАЯ ДОРОЖКА В КАТАЛОГЕ/);
 assert.match(js,/state\.showUnverified/);
 assert.match(js,/all\.length<=1/);
});
test("premium homepage wires the three franchise tabs and alternate authorized sites",()=>{
 const h=file("public/cinema.html"),js=file("public/cinema.js");
 for(const x of ["mcu","potter","legacy"])assert.match(h,new RegExp('data-franchise="'+x+'"'));
 assert.match(h,/cinema-russian-audio\.js/);
 assert.match(h,/cinema-franchises\.js/);
 assert.match(h,/cinemaFranchiseAllLanguages/);
 assert.match(js,/function renderFranchise/);
 assert.match(h,/youtube\.com\/MosfilmRuOfficial/);
 assert.match(h,/vk\.com\/mosfilm_official/);
 assert.match(h,/youtube\.com\/channel\/UCm5U4zqpahzyNXBv5ZT51Jw/);
 assert.match(h,/veto-telegram-mark\.svg/);
 const ids=new Set(Array.from(h.matchAll(/\bid="([^"]+)"/g),x=>x[1]));
 const bindings=Array.from(js.matchAll(/\$\("([^"]+)"\)/g),x=>x[1]);
 assert.deepEqual(bindings.filter(x=>!ids.has(x)),[]);
});


test("Russian audio evidence lists exact studio film pages, never marks streams as usable",()=>{
 const films=franchises();
 const matched=films.filter(f=>f.russianAudioStatus==="catalog-listed");
 assert.equal(matched.length,32);
 const groups=Object.fromEntries(["mcu","potter","legacy"].map(group=>[
   group,matched.filter(f=>f.franchise===group).length
 ]));
 assert.deepEqual(groups,{mcu:10,potter:10,legacy:12});
 assert.ok(films.every(f=>f.player===null));
 assert.ok(matched.every(f=>f.russianAudio.language==="ru"&&
   /^https:\/\/(megogo\.net|okko\.tv)\//.test(f.sourcePage)));
 assert.ok(matched.every(f=>f.watchAvailability!=="available"));
 assert.equal(matched.filter(f=>f.watchAvailability==="unavailable").length,6);
 const potter2=films.find(f=>f.original==="Harry Potter and the Chamber of Secrets");
 assert.equal(potter2.watchAvailability,"unavailable");
 assert.equal(potter2.watchProvider,"MEGOGO");
});
