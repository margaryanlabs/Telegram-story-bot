import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import cinemaChannels from "../api/cinema-channels.js";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const router=readFileSync(resolve(ROOT,"api/router.js"),"utf8");
const vercel=JSON.parse(readFileSync(resolve(ROOT,"vercel.json"),"utf8"));
const mkRes=()=>{
 const headers=new Map();
 return {
   headers,statusCode:200,body:null,
   setHeader(k,v){headers.set(k.toLowerCase(),v);return this},
   status(code){this.statusCode=code;return this},
   json(data){this.body=data;return this}
 };
};
test("same-origin cinema API is exposed through existing Vercel single-function router",()=>{
 assert.match(router,/"cinema-channels":\s*\(\)\s*=>\s*import\("\.\/cinema-channels\.js"\)/);
 const rule=vercel.routes.find(r=>r.dest?.includes("api/router.js"));
 assert.ok(rule,"existing Vercel API router");
 assert.ok(new RegExp(rule.src).test("/api/cinema-channels"));
 assert.ok(!new RegExp(rule.src).test("/api/cinema/channels"));
});
test("public studios list is returned without Postgres or keys",async()=>{
 const r=mkRes();
 await cinemaChannels({method:"GET",query:{mode:"list"}},r);
 assert.equal(r.statusCode,200);
 assert.equal(r.body.channels.length,6);
 assert.equal(r.body.channels[0].id,"mosfilm");
 assert.equal(r.body.channels[0].name,"Киноконцерн «Мосфильм»");
 assert.ok(r.body.channels.some(x=>x.id==="starmedia"));
 assert.ok(r.body.channels.some(x=>x.id==="marsmedia"));
});
test("invalid studio and invalid page are rejected before network access",async()=>{
 for(const query of [{channel:"evil",page:"1"},{channel:"mosfilm",page:"999"}]){
   const r=mkRes();
   await cinemaChannels({method:"GET",query},r);
   assert.equal(r.statusCode,400);
   assert.equal(r.body.ok,false);
 }
});
test("non-GET methods are rejected",async()=>{
 const r=mkRes();
 await cinemaChannels({method:"POST",query:{}},r);
 assert.equal(r.statusCode,405);
});
test("external RUTUBE failures return descriptive, non-sensitive 502 error",async()=>{
 const saved=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status:403});
 try{
   const r=mkRes();
   await cinemaChannels({method:"GET",query:{channel:"mosfilm",page:"73"}},r);
   assert.equal(r.statusCode,502);
   assert.equal(r.body.error,"RUTUBE_ACCESS_DENIED");
   assert.ok(!JSON.stringify(r.body).includes("token"));
 }finally{globalThis.fetch=saved}
});
