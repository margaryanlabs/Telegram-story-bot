import test from "node:test";
import assert from "node:assert/strict";
import handler,{parseMusicUpdate} from "../music-bot/handler.mjs";
test("bot ignores messages outside sender's private chat",()=>{
 assert.equal(parseMusicUpdate({message:{chat:{type:"group",id:-123},from:{id:123},audio:{file_id:"file_identifier_long_valid"}}}),null);
 assert.equal(parseMusicUpdate({message:{chat:{type:"private",id:123},from:{id:55},audio:{file_id:"file_identifier_long_valid"}}}),null);
});
test("only explicitly submitted audio files can be returned via Telegram native player",()=>{
 const info=parseMusicUpdate({message:{chat:{type:"private",id:12},from:{id:12},audio:{
  file_id:"AAECAwQFBgcICQoLDA0ODw",title:"My Song",performer:"Artist"
 }}});
 assert.equal(info.kind,"audio");assert.equal(info.chat_id,12);
 assert.equal(info.title,"My Song");assert.equal(info.performer,"Artist");
 assert.equal(parseMusicUpdate({message:{chat:{type:"private",id:12},from:{id:12},text:"/start"}}).kind,"welcome");
});
function response(){return {code:0,body:null,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
test("webhook refuses unconfigured calls, forbidden methods and invalid secrets",async()=>{
 const previous={token:process.env.VETOGRAM_MUSIC_BOT_TOKEN,secret:process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET};
 try{
  delete process.env.VETOGRAM_MUSIC_BOT_TOKEN;delete process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET;
  const req={method:"POST",headers:{},body:{message:{}}};
  const r=response();await handler(req,r);assert.equal(r.code,503);
  process.env.VETOGRAM_MUSIC_BOT_TOKEN="test-token";
  process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET="test-secret";
  const a=response();await handler({...req,method:"GET"},a);assert.equal(a.code,405);
  const b=response();await handler({...req,method:"POST",headers:{"x-telegram-bot-api-secret-token":"wrong"}},b);
  assert.equal(b.code,403);
 }finally{
  if(previous.token===undefined)delete process.env.VETOGRAM_MUSIC_BOT_TOKEN;else process.env.VETOGRAM_MUSIC_BOT_TOKEN=previous.token;
  if(previous.secret===undefined)delete process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET;else process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET=previous.secret;
 }
});
