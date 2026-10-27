import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createMusicStore} from "../music-bot/library.mjs";
import {makeLibraryReply,createWebhookHandler} from "../music-bot/server.mjs";
const message=(id,text)=>({message:{chat:{id,type:"private"},from:{id,is_bot:false},message_id:42,text}});
const song=(i)=>({file_id:"AudioFromThisBot_"+i,file_unique_id:"same-file-"+i,title:"Track "+i,performer:"Personal artist",mime_type:"audio/mpeg",duration:180});
async function inTemp(fn){
 const directory=await mkdtemp(join(tmpdir(),"vetogram-native-albums-"));
 try{return await fn(createMusicStore({directory}))}
 finally{await rm(directory,{force:true,recursive:true})}
}
test("Telegram /album 1 bundles exactly 10 personal audio files and preserves ordering",()=>inTemp(async store=>{
 for(let i=1;i<=23;i++)await store.add(7711,song(i));
 const res=await makeLibraryReply(message(7711,"/album 1"),store);
 assert.equal(res.method,"sendMediaGroup");
 assert.equal(res.body.chat_id,7711);
 assert.equal(res.body.media.length,10);
 assert.ok(res.body.media.every(row=>row.type==="audio"&&row.media.startsWith("AudioFromThisBot_")));
 assert.equal(res.body.media[0].media,"AudioFromThisBot_23");
 assert.equal(res.body.media[0].title,"Track 23");
 assert.match(res.body.media[0].caption,/Личная подборка/);
 assert.ok(res.body.media.slice(1).every(row=>!row.caption));
 const second=await makeLibraryReply(message(7711,"/album 2"),store);
 assert.equal(second.method,"sendMediaGroup");
 assert.equal(second.body.media.length,10);
 const third=await makeLibraryReply(message(7711,"/album 3"),store);
 assert.equal(third.method,"sendMediaGroup");
 assert.equal(third.body.media.length,3);
 const beyond=await makeLibraryReply(message(7711,"/album 4"),store);
 assert.equal(beyond.method,"sendMessage");
 assert.match(beyond.body.text,/странице песен нет/);
}));
test("Single-track album uses sendAudio and never calls sendMediaGroup for 1 item",()=>inTemp(async store=>{
 await store.add(22,song(1));
 const res=await makeLibraryReply(message(22,"/album"),store);
 assert.equal(res.method,"sendAudio");
 assert.equal(res.body.audio,"AudioFromThisBot_1");
 const noMusic=await makeLibraryReply(message(33,"/album"),store);
 assert.equal(noMusic.method,"sendMessage");
 assert.match(noMusic.body.text,/нет музыки/);
}));
test("Bot does not disclose private music to another chat or impersonated sender",()=>inTemp(async store=>{
 await store.add(101,song(1));
 await store.add(101,song(2));
 const foreign=await makeLibraryReply(message(202,"/album 1"),store);
 assert.equal(foreign.method,"sendMessage");
 assert.match(foreign.body.text,/нет музыки/);
 const spoof={message:{chat:{id:101,type:"private"},from:{id:202,is_bot:false},text:"/album 1"}};
 assert.equal(await makeLibraryReply(spoof,store),null);
 const bad=await makeLibraryReply(message(101,"/album 99"),store);
 assert.equal(bad.method,"sendMessage");
 assert.match(bad.body.text,/страницу от 1 до 30/);
 const list=await makeLibraryReply(message(101,"/list 14"),store);
 assert.equal(list.method,"sendMessage");
 assert.match(list.body.text,/Этой страницы нет/);
}));
test("Webhook will dispatch one sendMediaGroup only after checking its secret",()=>inTemp(async store=>{
 for(let i=0;i<4;i++)await store.add(44,song(i));
 const sent=[];
 const handler=createWebhookHandler({token:"dummy",secret:"long-test-secret",store,
  fetchImpl:async(url,options)=>{
   sent.push({url,body:JSON.parse(options.body)});
   return {ok:true,json:async()=>({ok:true,result:[]})};
  }});
 const data={update_id:8101,...message(44,"/album 1")};
 const req=(secret)=>({url:"/telegram/music-webhook",method:"POST",
  headers:{"x-telegram-bot-api-secret-token":secret},
  async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data))}});
 const res=()=>({status:0,writeHead(code){this.status=code},end(){}});
 let out=res();await handler(req("wrong"),out);assert.equal(out.status,401);assert.equal(sent.length,0);
 out=res();await handler(req("long-test-secret"),out);assert.equal(out.status,200);
 assert.equal(sent.length,1);assert.match(sent[0].url,/sendMediaGroup$/);assert.equal(sent[0].body.media.length,4);
 out=res();await handler(req("long-test-secret"),out);assert.equal(sent.length,1);
}));
