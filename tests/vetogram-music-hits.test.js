import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const main=readFileSync(new URL("vetogram-music.js",root),"utf8");
const js=readFileSync(new URL("vetogram-music-hits.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-hits.css",root),"utf8");
const first=js.indexOf("const COUNTRY="),last=js.indexOf("let query=",first);
assert.ok(first>=0&&last>first);
const {searchUrl,fromApple,fromShare}=new Function(js.slice(first,last)+"return {searchUrl,fromApple,fromShare};")();
test("new world hits page loads after parent music player",()=>{
 assert.match(html,/data-view="hits"/);
 assert.match(html,/data-page="hits"/);
 assert.match(html,/id="hitsPresets"/);
 assert.match(html,/id="hitsResults"/);
 assert.match(html,/id="hitsEmbed"/);
 assert.ok(html.indexOf('src="./vetogram-music.js"')<html.indexOf('src="./vetogram-music-hits.js"'));
 assert.match(main,/vetogram:hits-open/);
 assert.match(main,/hits:"МИРОВЫЕ ХИТЫ"/);
});
test("real Apple metadata search needs no token and supports RU HY EN",()=>{
 for(const region of ["am","ru","us","ge"]){
  const u=new URL(searchUrl("Հայկական MACAN",region));
  assert.equal(u.hostname,"itunes.apple.com");
  assert.equal(u.pathname,"/search");
  assert.equal(u.searchParams.get("entity"),"song");
  assert.equal(u.searchParams.get("media"),"music");
  assert.equal(u.searchParams.get("country"),region);
  assert.equal(u.searchParams.get("term"),"Հայկական MACAN");
  assert.ok(!u.searchParams.has("token"));
 }
});
test("authentic Apple song metadata links to provider, not custom stream",()=>{
 const track=fromApple({wrapperType:"track",kind:"song",trackId:1679628216,trackName:"ASPHALT 8",artistName:"MACAN",collectionName:"ASPHALT 8 - Single",
  trackViewUrl:"https://music.apple.com/us/album/asphalt-8/1679628035?i=1679628216",artworkUrl100:"https://is1-ssl.mzstatic.com/image/thumb/music.png"});
 assert.equal(track.title,"ASPHALT 8");
 assert.equal(track.artist,"MACAN");
 assert.equal(track.url,"https://music.apple.com/us/album/asphalt-8/1679628035?i=1679628216");
 assert.equal(track.stream,undefined);
 assert.equal(fromApple({...track,wrapperType:"track",kind:"song",trackViewUrl:"https://evil.example/song"}),null);
 assert.doesNotMatch(js,/audio\.src\s*=\s*previewUrl|fetch\(.*previewUrl/);
});
test("external Spotify, Yandex and Apple links only use official iframe providers",()=>{
 const spotify=fromShare("https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b?si=abc");
 assert.equal(spotify.embed,"https://open.spotify.com/embed/track/0VjIjW4GlUZAMYd2vXMi3b");
 const yandex=fromShare("https://music.yandex.ru/album/419460/track/71263");
 assert.equal(yandex.embed,"https://music.yandex.ru/iframe/#track/71263/419460");
 const apple=fromShare("https://music.apple.com/am/album/es-u-du/1573747861?i=1573747863");
 assert.equal(apple.embed,"https://embed.music.apple.com/am/album/es-u-du/1573747861?i=1573747863");
 assert.equal(fromShare("https://evil.example/track/0VjIjW4GlUZAMYd2vXMi3b"),null);
 assert.equal(fromShare("javascript:alert(1)"),null);
 assert.equal(fromShare("https://open.spotify.com/track/too-short"),null);
 assert.equal(fromShare("https://music.yandex.ru/track/71263"),null);
});
test("full iframe remains visible and self-contained, explicit playback restrictions",()=>{
 assert.match(js,/frame\.allow=/);
 assert.match(js,/encrypted-media/);
 assert.doesNotMatch(js,/youtube-dl|yt-dlp|audioOnly|downloadMP3/);
 assert.match(html,/некоторые записи работают лишь как превью/i);
 assert.match(css,/@media\(max-width:650px\)/);
 execFileSync(process.execPath,["--check",fileURLToPath(new URL("vetogram-music-hits.js",root))]);
});
