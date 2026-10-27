import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const jsUrl=new URL("../public/media-v13.js",import.meta.url);
const cssUrl=new URL("../public/media-v13.css",import.meta.url);
const html=readFileSync(new URL("../public/media.html",import.meta.url),"utf8");
const source=readFileSync(jsUrl,"utf8"),css=readFileSync(cssUrl,"utf8");
test("V13 Immersive Player is linked and is an opt-in accessible modal",()=>{
  assert.match(html,/media-v13\.css/);
  assert.match(html,/media-v13\.js/);
  assert.match(source,/id='v13Studio'/);
  assert.match(source,/aria-modal/);
  assert.match(source,/v13Close/);
  assert.match(source,/aria-label/);
  assert.match(source,/v13-launch/);
  assert.match(source,/location\.hash==='#v13'/);
  execFileSync(process.execPath,["--check",fileURLToPath(jsUrl)],{stdio:"pipe"});
});
test("V13 operates the shared audio and does not access Telegram sessions",()=>{
  assert.match(source,/getElementById/);
  assert.match(source,/audio\.play\(\)/);
  assert.match(source,/audio\.pause\(\)/);
  assert.match(source,/audio\.currentTime/);
  assert.match(source,/audio\.volume/);
  assert.match(source,/audio\.playbackRate/);
  assert.match(source,/v13Sleep/);
  assert.match(source,/VetoTelegramMedia\?\.syncBack/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|api\.telegram\.org|TELEGRAM_BOT_TOKEN|initDataUnsafe|MTProto/);
});
test("V13 generated soundtrack is original, not an unlicensed catalog stream",async()=>{
  const a=source.indexOf("  const demoData=()=>{"),b=source.indexOf("  function demo(index)",a);
  assert.ok(a>0&&b>a,"Original synthetic soundtrack function exists");
  const demoData=new Function(
    "const demos=[{key:[0,7,12,19],base:110}];const demoIndex=0;"+
    source.slice(a,b)+"return demoData;"
  )();
  const blob=demoData();
  assert.equal(blob.type,"audio/wav");
  const buf=await blob.arrayBuffer();
  const dv=new DataView(buf);
  const bytes=new Uint8Array(buf);
  const str=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
  assert.equal(str(0,4),"RIFF");
  assert.equal(str(8,4),"WAVE");
  assert.equal(str(36,4),"data");
  assert.equal(dv.getUint32(24,true),16000);
  assert.equal(dv.getUint16(34,true),16);
  assert.equal(dv.getUint32(40,true),20*16000*2);
  assert.equal(buf.byteLength,44+20*16000*2);
});
test("V13 immersive visuals respect pause state and reduced motion",()=>{
  assert.match(css,/data-playing=true/);
  assert.match(css,/animation-play-state:paused/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/v13-aura/);
  assert.match(css,/v13-disc/);
  assert.match(css,/v13-wave-row/);
  assert.match(css,/@media\(max-width:440px\)/);
  assert.match(source,/НЕ ЧАСТОТНЫЙ АНАЛИЗ/);
  assert.match(source,/URL\.revokeObjectURL/);
});
