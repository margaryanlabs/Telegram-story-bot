import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const socialUrl=new URL("vetogram-music-social.js",root);
const social=readFileSync(socialUrl,"utf8");
const app=readFileSync(new URL("vetogram-music.js",root),"utf8");
const css=readFileSync(new URL("vetogram-music-social.css",root),"utf8");
const tokenStart=social.indexOf("function b64enc("),tokenEnd=social.indexOf("function showDialog(",tokenStart);
assert.ok(tokenStart>0&&tokenEnd>tokenStart);
const methods=new Function('const TARGET_ORIGIN="https://vetogram-music-live.vercel.app/";'+
 'const clean=(x,n=90)=>String(x??"").trim().slice(0,n);const validName=x=>clean(x,100).replace(/[\\r\\n]/g," ");'+
 social.slice(tokenStart,tokenEnd)+'return {mixShareURL,decodeMix};')();
test("social frontend uses native Telegram chat-picker share links with opt-in sending",()=>{
  assert.match(social,/https:\/\/t\.me\/share\/url\?url=/);
  assert.match(social,/host\.openTelegramLink/);
  assert.match(social,/telegramShare/);
  assert.match(social,/navigator\.share/);
  assert.match(social,/navigator\.canShare/);
  assert.match(social,/showDialog/);
  assert.match(social,/id=|\.id/);
  assert.doesNotMatch(social,/VK_ADMIN_TOKEN|BOT_TOKEN|document\.cookie|localStorage\.setItem\(["']token/);
  execFileSync(process.execPath,["--check",fileURLToPath(socialUrl)],{stdio:"pipe"});
});
test("Telegram playlist links preserve Cyrillic and do not carry audio bytes",()=>{
  const rows=[{artist:"Кино",title:"Группа крови"},{artist:"Земфира",title:"Искала"}];
  const item=methods.mixShareURL(rows);
  assert.equal(item.count,2);
  assert.ok(item.url.startsWith("https://vetogram-music-live.vercel.app/?mix="));
  const parsed=methods.decodeMix(new URL(item.url).searchParams.get("mix"));
  assert.deepEqual(parsed,rows);
  assert.throws(()=>methods.decodeMix("bad!"),/Некорректная/);
});
test("Telegram link truncates large lists; the full library exports as JSON",()=>{
  const list=Array.from({length:80},(_,i)=>({artist:"Artist "+i,title:"Track "+i+" with an extra title"}));
  const shared=methods.mixShareURL(list);
  assert.ok(shared.count<=14);
  assert.equal(shared.total,80);
  assert.ok(shared.url.length<=1700);
  assert.match(social,/shareAllFile/);
  assert.match(social,/application\/json/);
});
test("new UI has functional track sharing, recipient consent and queue controls",()=>{
  for(const id of ["sharePlaylist","shareAllFile","shareInvite","shareQuick","socialModal",
    "socialDismiss","socialConfirm","socialHeading","socialText","queueToggle",
    "queuePanel","queueClose","socialQueue"]){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/vetogram-music-social\.js/);
  assert.match(html,/vetogram-music-social\.css/);
  assert.match(css,/social-queue\.open/);
  assert.match(css,/social-invite/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(app,/function removeLocal\(/);
  assert.match(app,/function moveLocal\(/);
  assert.match(app,/vetogram-music-local-order-v1/);
  assert.match(social,/vetogram:library-change/);
  assert.match(social,/audio\/mpeg/);
  assert.doesNotMatch(social,/fetch\(.+vk\.com|yandex\.ru\/music\/download/);
});
