/* Vetogram Music — opt-in personal music bot.
   Telegram user sends their OWN .mp3/.m4a audio to this bot. It returns that
   SAME Telegram file_id to the SAME private chat for native-player listening.
   No chat scraping, file downloads, redistribution, or shared public catalog. */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

export function verifySecret(given, expected) {
  if(typeof given!=="string"||typeof expected!=="string"||!expected)return false;
  const a=Buffer.from(given),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function makeReply(update) {
  const m=update?.message;
  if(!m||m.chat?.type!=="private"||m.from?.is_bot||m.chat?.id!==m.from?.id)return null;
  const chat_id=m.chat.id;
  const text=String(m.text||"").split(" ")[0];
  if(text==="/start"||text==="/help")
    return {method:"sendMessage",body:{chat_id,
      text:"♫ Vetogram Music\n\nПришли MP3 или M4A, которыми ты вправе распоряжаться, как аудио (♫) — я верну эту запись в твой личный чат, где её можно слушать через плеер Telegram.\n\nБот не читает другие чаты и не копирует каталоги VK/Яндекса. Vetogram Music: https://vetogram-music-live.vercel.app/" }};
  const audio=m.audio;
  if(!audio?.file_id||typeof audio.file_id!=="string"||audio.file_id.length>512)return null;
  if(audio.mime_type&&!/^(audio\/mpeg|audio\/mp4|audio\/x-m4a|audio\/m4a)$/i.test(audio.mime_type)){
    return {method:"sendMessage",body:{chat_id,text:"Поддерживаются музыкальные MP3/M4A. Отправь аудиозапись подходящего формата."}};
  }
  return {method:"sendAudio",body:{
    chat_id,
    audio:audio.file_id,
    title:String(audio.title||"Моя музыка").slice(0,90),
    performer:String(audio.performer||"Vetogram Music").slice(0,90),
    caption:"♫ Твой трек в нативном плеере Telegram. Слушай в этом чате или отправляй друзьям, если имеешь право делиться записью.",
    reply_parameters:{message_id:m.message_id,allow_sending_without_reply:true}
  }};
}
export function createWebhookHandler({token,secret,fetchImpl=fetch}) {
  if(!token||!secret)throw Error("Music bot token and webhook secret required");
  const processed=new Map();
  return async (req,res)=>{
    if(req.method==="GET"&&req.url==="/health"){
      res.writeHead(200,{"Content-Type":"application/json"});res.end('{"ok":true,"service":"vetogram-music-bot"}');return;
    }
    if(req.method!=="POST"||req.url!=="/telegram/music-webhook"){
      res.writeHead(404);res.end("Not found");return;
    }
    if(!verifySecret(req.headers["x-telegram-bot-api-secret-token"],secret)){
      res.writeHead(401);res.end("Unauthorized");return;
    }
    let json="";
    try{
      for await(const chunk of req){
        json+=chunk.toString("utf8");
        if(json.length>131072){res.writeHead(413);res.end("Too large");return;}
      }
      const data=JSON.parse(json),id=data.update_id;
      if(!Number.isSafeInteger(id)||id<0){res.writeHead(400);res.end("Bad update");return;}
      if(processed.has(id)){res.writeHead(200);res.end("OK");return;}
      const job=makeReply(data);
      if(job){
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),11000);
        try{
          const response=await fetchImpl("https://api.telegram.org/bot"+token+"/"+job.method,{
            method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify(job.body),signal:controller.signal
          });
          if(!response.ok)throw Error("Telegram send returned "+response.status);
          const reply=await response.json();
          if(!reply.ok)throw Error("Telegram rejected audio");
        }finally{clearTimeout(timer);}
      }
      processed.set(id,Date.now());
      if(processed.size>2000){
        for(const [key,when] of processed)if(Date.now()-when>3600000)processed.delete(key);
        while(processed.size>2000)processed.delete(processed.keys().next().value);
      }
      res.writeHead(200);res.end("OK");
    }catch(err){
      // No user IDs, tokens, message bodies or file IDs in logs.
      console.error("Music webhook processing failed",err?.name||"Error");
      res.writeHead(502);res.end("Temporary failure");
    }
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const token=process.env.VETOGRAM_MUSIC_BOT_TOKEN,
        secret=process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET;
  const port=Number(process.env.PORT)||8787;
  if(!token||!secret){console.error("Set VETOGRAM_MUSIC_BOT_TOKEN and VETOGRAM_MUSIC_WEBHOOK_SECRET");process.exit(1);}
  const handler=createWebhookHandler({token,secret});
  createServer(handler).listen(port,"0.0.0.0",()=>console.info("Vetogram Music bot webhook listening"));
}
