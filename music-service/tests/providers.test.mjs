import test from "node:test";
import assert from "node:assert/strict";
import {SOURCE_STATUS,buildAudiusUrl,buildRadioUrl,parseQuery,mapAudius,mapRadio} from "../lib/providers.mjs";
import {handler} from "../api/music.mjs";
test("registry separates real streaming services from metadata-only catalogs",()=>{
 assert.equal(SOURCE_STATUS.audius.playback,"provider_stream");
 assert.equal(SOURCE_STATUS.radio.playback,"broadcaster_stream");
 assert.equal(SOURCE_STATUS.vk.playback,"not_available");
 assert.equal(SOURCE_STATUS.yandex.import,"user_supplied_metadata");
});
test("maps non-gated Audius track but not protected or deleted entries",()=>{
 const t={id:"ABC_1",title:"Հայկական",user:{name:"Автор"},artwork:{"150x150":"https://example.org/cover.jpg"}};
 const song=mapAudius(t);
 assert.equal(song.id,"audius:ABC_1");
 assert.equal(song.source,"audius");
 assert.equal(song.title,"Հայկական");
 assert.match(song.stream_url,/https:\/\/api\.audius\.co\/v1\/tracks\/ABC_1\/stream/);
 assert.equal(mapAudius({...t,is_stream_gated:true}),null);
 assert.equal(mapAudius({...t,id:"../../evil"}),null);
});
test("only working HTTPS stations have playable URLs",()=>{
 const t={stationuuid:"ar-1",name:"Armenian Radio",country:"Armenia",lastcheckok:1,url_resolved:"https://example.com/live.mp3"};
 assert.equal(mapRadio(t).title,"Armenian Radio");
 assert.equal(mapRadio({...t,lastcheckok:0}),null);
 assert.equal(mapRadio({...t,url_resolved:"http://example.com/live.mp3"}),null);
 assert.equal(mapRadio({...t,url_resolved:"https://example.com/stream.m3u8"}),null);
});
test("search builds exact supported upstream URL and limits input",()=>{
 const u=new URL(buildAudiusUrl("search",{q:"Баста Сансара",limit:"500"}));
 assert.equal(u.hostname,"api.audius.co");
 assert.equal(u.searchParams.get("query"),"Баста Сансара");
 assert.equal(u.searchParams.get("limit"),"25");
 assert.throws(()=>parseQuery("a"),/от 2 до 80/);
 assert.throws(()=>buildAudiusUrl("charts",{period:"bad"}),/период/);
 assert.match(buildRadioUrl("Yerevan"),/limit=20/);
});
function req(url,origin="https://vetogram-music-live.vercel.app"){
 return {url,method:"GET",headers:{origin,"x-real-ip":Math.random().toString(36)},socket:{remoteAddress:"test"}};
}
function reply(){
 return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(payload){this.json=payload?JSON.parse(payload):null}};
}
test("provider status gives honest real-time capabilities with CORS",async()=>{
 const r=reply();await handler(req("/api/music?action=providers"),r);
 assert.equal(r.statusCode,200);
 assert.equal(r.json.providers.vk.playback,"not_available");
 assert.equal(r.headers["Access-Control-Allow-Origin"],"https://vetogram-music-live.vercel.app");
});
test("unknown operations and invalid queries fail without fetching external sites",async()=>{
 const a=reply();await handler(req("/api/music?action=import"),a);
 assert.equal(a.statusCode,400);
 const b=reply();await handler(req("/api/music?action=search&q=x"),b);
 assert.equal(b.statusCode,400);
});
test("GET only and CORS do not reflect untrusted origins",async()=>{
 const r=reply();await handler({...req("/api/music?action=health","https://evil.example"),method:"POST"},r);
 assert.equal(r.statusCode,405);assert.equal(r.headers["Access-Control-Allow-Origin"],undefined);
});
