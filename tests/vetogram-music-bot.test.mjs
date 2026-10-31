import test from "node:test";
import assert from "node:assert/strict";
import { makeReply,verifySecret,createWebhookHandler } from "../music-bot/server.mjs";
test("secret verification is exact and missing secret cannot authorize",()=>{
  assert.equal(verifySecret("safe-secret","safe-secret"),true);
  assert.equal(verifySecret("safe-secret ","safe-secret"),false);
  assert.equal(verifySecret("",""),false);
  assert.equal(verifySecret("safe","unsafe"),false);
});
test("bot responds only to private chats from their own human sender",()=>{
  const audio={file_id:"AgACOwned123",mime_type:"audio/mpeg",title:"My Tune"};
  assert.equal(makeReply({message:{chat:{id:44,type:"supergroup"},from:{id:44},audio}}),null);
  assert.equal(makeReply({message:{chat:{id:44,type:"private"},from:{id:45},audio}}),null);
  assert.equal(makeReply({message:{chat:{id:44,type:"private"},from:{id:44,is_bot:true},audio}}),null);
  const out=makeReply({message:{chat:{id:44,type:"private"},from:{id:44},message_id:9,audio}});
  assert.equal(out.method,"sendAudio");
  assert.equal(out.body.chat_id,44);
  assert.equal(out.body.audio,"AgACOwned123");
  assert.equal(out.body.reply_parameters.message_id,9);
});
test("no forwarding of unrelated documents or unauthorized audio formats",()=>{
  const message={chat:{id:44,type:"private"},from:{id:44},message_id:9};
  assert.equal(makeReply({message:{...message,document:{file_id:"document"}}}),null);
  assert.equal(makeReply({message:{...message,audio:{file_id:"x",mime_type:"video/mp4"}}}).method,"sendMessage");
  assert.equal(makeReply({message:{...message,text:"/start"}}).method,"sendMessage");
});
test("webhook enforces Telegram secret before any outbound API call",async()=>{
  let calls=0;
  const handler=createWebhookHandler({token:"dummy-token",secret:"dummy-secret",fetchImpl:async()=>{calls++;return{ok:true,json:async()=>({ok:true})}}});
  const incoming=(header,body)=>({
    method:"POST",url:"/telegram/music-webhook",
    headers:{"x-telegram-bot-api-secret-token":header},
    async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body))}
  });
  const output=()=>({status:0,writeHead(code){this.status=code},end(){}});
  const payload={update_id:100,message:{chat:{id:88,type:"private"},from:{id:88},
    message_id:12,audio:{file_id:"A-123",mime_type:"audio/mp4"}}};
  let res=output();await handler(incoming("wrong",payload),res);
  assert.equal(res.status,401);assert.equal(calls,0);
  res=output();await handler(incoming("dummy-secret",payload),res);
  assert.equal(res.status,200);assert.equal(calls,1);
  res=output();await handler(incoming("dummy-secret",payload),res);
  assert.equal(res.status,200);assert.equal(calls,1);
});
