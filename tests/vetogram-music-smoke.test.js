import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const html=readFileSync(new URL("../public/vetogram-music/index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../public/vetogram-music/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/vetogram-music/app.css",import.meta.url),"utf8");
const sw=readFileSync(new URL("../public/vetogram-music/sw.js",import.meta.url),"utf8");
const manifest=JSON.parse(readFileSync(new URL("../public/vetogram-music/manifest.webmanifest",import.meta.url),"utf8"));
test("music-only interface has all routes and no media tabs",()=>{
 for(const id of ["homePage","searchPage","libraryPage","importPage","audio","player","studio","audioPicker"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 }
 assert.doesNotMatch(html,/id="(filmsView|booksView|audiobooksView|cinemaPage|readerPage)"/);
 assert.match(html,/Vetogram Music/);
 assert.match(html,/app\.css/);
 assert.match(html,/app\.js/);
 assert.match(html,/manifest\.webmanifest/);
});
test("every statically referenced DOM id in JS is in the HTML",()=>{
 const refs=[...js.matchAll(/\$\("([^"]+)"\)/g)].map(x=>x[1]);
 const missing=[...new Set(refs)].filter(id=>!html.includes('id="'+id+'"'));
 assert.deepEqual(missing,[]);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("../public/vetogram-music/app.js",import.meta.url))],{stdio:"pipe"});
});
test("music sources are explicit, import excludes protected API tokens",()=>{
 assert.match(js,/https:\/\/api\.audius\.co\/v1/);
 assert.match(js,/\/tracks\/trending/);
 assert.match(js,/\/tracks\/latest/);
 assert.match(js,/\/tracks\/search/);
 assert.match(js,/playbackSrc/);
 assert.match(js,/audio\.play\(\)/);
 assert.match(js,/indexedDB\.open/);
 assert.match(js,/URL\.createObjectURL/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.match(js,/parsePlaylist/);
 assert.doesNotMatch(js,/VK_ADMIN_TOKEN|YANDEX_TOKEN|TELEGRAM_BOT_TOKEN|api\.telegram\.org\/bot/);
});
test("PWA caches only its own app shell",()=>{
 assert.equal(manifest.display,"standalone");
 assert.match(sw,/app\.css/);
 assert.match(sw,/app\.js/);
 assert.match(sw,/req\.destination==="audio"/);
 assert.doesNotMatch(sw,/cache\.put\(.*api\.audius/i);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/@media\(max-width:600px\)/);
});
test("the music player supplies OS media actions while honoring host limits",()=>{
 for(const action of ["previoustrack","nexttrack","seekto","seekbackward","seekforward"]){
  assert.ok(js.includes(action),"Missing "+action);
 }
 assert.match(js,/initData/);
 assert.match(js,/setPositionState/);
 assert.match(js,/serviceWorker\.register/);
 assert.match(js,/contentSafeAreaInset/);
});
