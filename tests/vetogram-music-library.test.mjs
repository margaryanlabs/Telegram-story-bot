import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createMusicStore} from "../music-bot/library.mjs";
import {makeLibraryReply,createWebhookHandler} from "../music-bot/server.mjs";

const message=(id,content={})=>({
 message:{chat:{id,type:"private"},from:{id,is_bot:false},message_id:5,...content}
});
const track=(id,title="Моя музыка")=>({
 file_id:"FileID"+id,file_unique_id:"Unique"+id,title,performer:"Кино",
 mime_type:"audio/mpeg",duration:180
});
async function temporary(action){
 const directory=await mkdtemp(join(tmpdir(),"vetogram-music-test-"));
 try{return await action(directory)}finally{await rm(directory,{recursive:true,force:true})}
}
test("per-user libraries persist on disk and cannot access another user's files",()=>temporary(async directory=>{
 const store=createMusicStore({directory});
 await store.add(11,track(1,"Группа крови"));
 await store.add(22,track(2,"Искала"));
 assert.equal((await store.list(11)).total,1);
 assert.equal((await store.list(22)).tracks[0].title,"Искала");
 assert.equal(await store.get(11,2),null);
 const reopened=createMusicStore({directory});
 assert.equal((await reopened.get(11,1)).title,"Группа крови");
 assert.equal((await reopened.get(22,1)).title,"Искала");
 assert.equal(await reopened.get(99,1),null);
 await reopened.remove(11,1);
 assert.equal((await reopened.list(11)).total,0);
 assert.equal((await reopened.list(22)).total,1);
}));
test("identical Telegram unique ID deduplicates and updates rotated bot file IDs",()=>temporary(async directory=>{
 const store=createMusicStore({directory});
 const song=track(1,"Արմենական երաժշտություն");
 const a=await store.add(50,song);
 const b=await store.add(50,{...song,file_id:"updated-ID"});
 assert.equal(a.added,true);
 assert.equal(b.added,false);
 assert.equal(b.count,1);
 assert.equal((await store.get(50,1)).file_id,"updated-ID");
 const hits=await store.search(50,"Արմենական");
 assert.equal(hits.length,1);
 assert.equal(hits[0].index,1);
}));
test("concurrent uploads are serialized without lost updates",()=>temporary(async directory=>{
 const store=createMusicStore({directory});
 await Promise.all(Array.from({length:20},(_,i)=>store.add(44,track(i,"Track "+i))));
 assert.equal((await store.list(44)).total,20);
 assert.equal((await store.search(44,"Track")).length,20);
}));
test("bot library commands are strictly scoped to the sender's private chat",()=>temporary(async directory=>{
 const store=createMusicStore({directory});
 const upload=await makeLibraryReply(message(21,{audio:track("my","Группа крови")}),store);
 assert.equal(upload.method,"sendAudio");
 assert.equal((await store.list(21)).total,1);
 assert.equal((await store.list(22)).total,0);
 const list=await makeLibraryReply(message(21,{text:"/list"}),store);
 assert.equal(list.method,"sendMessage");
 assert.match(list.body.text,/Группа крови/);
 assert.match(list.body.text,/1\./);
 const find=await makeLibraryReply(message(21,{text:"/search крови"}),store);
 assert.match(find.body.text,/Группа крови/);
 const play=await makeLibraryReply(message(21,{text:"/play 1"}),store);
 assert.equal(play.method,"sendAudio");
 assert.equal(play.body.audio,"FileIDmy");
 const foreign=await makeLibraryReply(message(22,{text:"/play 1"}),store);
 assert.equal(foreign.method,"sendMessage");
 const spoof=await makeLibraryReply({message:{chat:{id:21,type:"private"},from:{id:22},text:"/play 1"}},store);
 assert.equal(spoof,null);
 const remove=await makeLibraryReply(message(21,{text:"/delete 1"}),store);
 assert.match(remove.body.text,/убрана/);
 assert.equal((await store.list(21)).total,0);
}));
test("webhook requires secret, handles duplicate Telegram updates without resending",()=>temporary(async directory=>{
 const store=createMusicStore({directory});
 const sent=[];
 const handler=createWebhookHandler({
  token:"dummy-token",secret:"a-test-secret",store,
  fetchImpl:async(url,opts)=>{
   sent.push({url,body:JSON.parse(opts.body)});
   return {ok:true,json:async()=>({ok:true})};
  }
 });
 const incoming=(secret,body)=>({
  method:"POST",url:"/telegram/music-webhook",
  headers:{"x-telegram-bot-api-secret-token":secret},
  async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body))}
 });
 const response=()=>({status:null,writeHead(code){this.status=code},end(){}});
 const payload={update_id:777,...message(93,{audio:track(9,"Jazz")})};
 let out=response();await handler(incoming("wrong",payload),out);
 assert.equal(out.status,401);assert.equal(sent.length,0);
 out=response();await handler(incoming("a-test-secret",payload),out);
 assert.equal(out.status,200);assert.equal(sent.length,1);
 assert.equal((await store.list(93)).total,1);
 out=response();await handler(incoming("a-test-secret",payload),out);
 assert.equal(out.status,200);assert.equal(sent.length,1);
 assert.equal((await store.list(93)).total,1);
}));
