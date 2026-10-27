import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join} from "node:path";
const js=readFileSync(new URL("../public/media-readiness.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/media-readiness.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../public/media.html",import.meta.url),"utf8");
test("V12 developer-only diagnostics require explicit opt-in",()=>{
 assert.match(js,/media_qa=1/);
 assert.match(js,/v12QaRun/);
 assert.match(js,/v12QaExport/);
 assert.match(html,/media-readiness\.js/);
 assert.match(html,/media-readiness\.css/);
 assert.match(css,/v12-qa-panel/);
 execFileSync(process.execPath,["--check",join(process.cwd(),"public/media-readiness.js")],{stdio:"pipe"});
});
test("V12 diagnostic network checks exclude sessions and media files",()=>{
 for(const url of ["api.audius.co","api.tvmaze.com","gutendex.com","archive.org"])assert.match(js,new RegExp(url.replaceAll(".","\\.")));
 assert.match(js,/AbortController/);
 assert.match(js,/credentials:"omit"/);
 assert.match(js,/generatedAt/);
 assert.doesNotMatch(js,/initDataUnsafe|WebApp\.initData\b[^)]{0,80}JSON\.stringify|TELEGRAM_BOT_TOKEN|MTProto|\/tracks\/\$\{.+\}\/stream/);
});
test("V12 export is a sanitized browser-only report",()=>{
 assert.match(js,/URL\.createObjectURL/);
 assert.match(js,/veto-media-device-check\.json/);
 assert.doesNotMatch(js,/FormData|navigator\.sendBeacon|fetch\(["']https:\/\/(?:bot|telegram)/);
});
