import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join} from "node:path";
const guard=readFileSync(new URL("../public/media-epub-guard.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../public/media.html",import.meta.url),"utf8");
const source=readFileSync(new URL("../public/media-epub.js",import.meta.url),"utf8");
function createZip(name="mimetype",compressedSize=20,uncompressedSize=20,flags=0){
 const n=Buffer.from(name),len=30+n.length+compressedSize+46+n.length+22,b=Buffer.alloc(len);
 b.writeUInt32LE(0x04034b50,0);b.writeUInt16LE(flags,6);b.writeUInt16LE(8,8);
 b.writeUInt32LE(compressedSize,18);b.writeUInt32LE(uncompressedSize,22);b.writeUInt16LE(n.length,26);n.copy(b,30);
 const cd=30+n.length+compressedSize;
 b.writeUInt32LE(0x02014b50,cd);b.writeUInt16LE(flags,cd+8);b.writeUInt16LE(8,cd+10);
 b.writeUInt32LE(compressedSize,cd+20);b.writeUInt32LE(uncompressedSize,cd+24);b.writeUInt16LE(n.length,cd+28);n.copy(b,cd+46);
 const eocd=cd+46+n.length;
 b.writeUInt32LE(0x06054b50,eocd);b.writeUInt16LE(1,eocd+8);b.writeUInt16LE(1,eocd+10);
 b.writeUInt32LE(46+n.length,eocd+12);b.writeUInt32LE(cd,eocd+16);
 return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
}
const {inspect}=new Function("const window={};"+guard+";return window.VetoEpubGuard")();
test("V12 guard connects before epub.js and runs on imported files",()=>{
 assert.ok(html.indexOf('src="./media-epub-guard.js"')<html.indexOf('src="./media-epub.js"'));
 assert.match(source,/VetoEpubGuard\.inspect\(buffer\)/);
 assert.match(source,/allowScriptedContent:false/);
 execFileSync(process.execPath,["--check",join(process.cwd(),"public/media-epub-guard.js")],{stdio:"pipe"});
});
test("V12 guard accepts well-formed ZIP metadata",()=>{
 assert.equal(inspect(createZip()).entries,1);
});
test("V12 guard rejects traversal, bombs, encrypted and broken inputs",()=>{
 assert.throws(()=>inspect(createZip("../mimetype")),/небезопасный путь/);
 assert.throws(()=>inspect(createZip("content.opf")),/mimetype/);
 assert.throws(()=>inspect(createZip("mimetype",1,4000000)),/сжатия/);
 assert.throws(()=>inspect(createZip("mimetype",20,20,1)),/зашифрованные/);
 assert.throws(()=>inspect(new ArrayBuffer(40)),/нет конца/);
});
test("Guard is local-only, bounded and checks ZIP central directory",()=>{
 assert.match(guard,/MAX_ENTRIES=2000/);
 assert.match(guard,/MAX_UNCOMPRESSED=120\*1024\*1024/);
 assert.match(guard,/0x02014b50/);
 assert.match(guard,/0x06054b50/);
 assert.doesNotMatch(guard,/fetch\(|XMLHttpRequest|FormData|location\.href/);
});
