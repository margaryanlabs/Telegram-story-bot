import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const jsPath=new URL("../public/media-integrations.js",import.meta.url);
const js=readFileSync(jsPath,"utf8");
const css=readFileSync(new URL("../public/media-integrations.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../public/media.html",import.meta.url),"utf8");
test("Provider hub is linked and keyboard/touch friendly",()=>{
 assert.match(html,/media-integrations\.js/);
 assert.match(html,/media-integrations\.css/);
 assert.match(js,/v14ProviderHub/);
 assert.match(js,/createElement/);
 assert.match(js,/addEventListener\("click"/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/prefers-reduced-motion/);
 execFileSync(process.execPath,["--check",fileURLToPath(jsPath)],{stdio:"pipe"});
});
test("All provider tiles accurately distinguish metadata from playback",()=>{
 for(const label of ["Audius","Live Radio","Apple Podcasts","TVmaze","Gutenberg","Internet Archive","LibriVox","VK / Spotify"]){
   assert.ok(js.includes('name:"'+label+'"'),label);
 }
 assert.match(js,/Каталог · без серий/);
 assert.match(js,/CSV \/ JSON \/ TXT · без MP3/);
 assert.match(js,/Архив · проверка прав/);
 assert.match(js,/Нет лицензированного доступа/);
});
test("Hub does not embed tokens, request credentials or stream protected tracks",()=>{
 assert.doesNotMatch(js,/\bfetch\(|\bXMLHttpRequest\b|TELEGRAM_BOT_TOKEN|VK_ADMIN_TOKEN|api\.vk\.com\/method/);
 assert.doesNotMatch(js,/\.innerHTML\s*=/);
});
