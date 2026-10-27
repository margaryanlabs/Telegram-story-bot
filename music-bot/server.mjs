/* Vetogram Music — opt-in personal music bot.
   Telegram user sends their OWN .mp3/.m4a audio to this bot. It returns that
   SAME Telegram file_id to the SAME private chat for native-player listening.
   No chat scraping, file downloads, redistribution, or shared public catalog. */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createMusicStore } from "./library.mjs";

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
function ownChat(update){
  const m=update?.message;
  if(!m||m.chat?.type!=="private"||m.from?.is_bot||m.chat?.id!==m.from?.id)return null;
  return m;
}
function replyText(chat_id,text){
  return {method:"sendMessage",body:{chat_id,text}};
}
function trackText(track,index){
  const title=String(track.title||"Без названия").replace(/[\r\n]/g," ").slice(0,76);
  const who=String(track.performer||"Неизвестный исполнитель").replace(/[\r\n]/g," ").slice(0,67);
  return String(index)+". "+who+" — "+title;
}
/* Persistent library is enabled only when a configured store is supplied.
   The previous echo-only behavior is kept for minimal deployment and tests. */
export async function makeLibraryReply(update,store){
  if(!store)return makeReply(update);
  const m=ownChat(update);
  if(!m)return null;
  const id=m.chat.id,cmd=String(m.text||"").trim();
  if(/^\/(?:start|help)(?:@\w+)?$/i.test(cmd))
    return replyText(id,
      "♫ Vetogram Music · моя библиотека\n\n"+
      "Пришли своё MP3/M4A в личный чат — сохраню запись по file_id и верну её для прослушивания через Telegram.\n"+
      "/list — мои треки\n/play 1 — воспроизвести первый\n/album 1 — отправить подборку до 10 треков в нативный плеер\n/search название — найти у себя\n/delete 1 — удалить запись из библиотеки\n\n"+
      "Музыка остаётся приватной; бот не видит другие чаты. Это не публичный каталог.");
  if(/^\/list(?:@\w+)?(?:\s+\d{1,3})?$/i.test(cmd)){
    const askedPage=Math.min(15,Math.max(1,Number(cmd.match(/\s+(\d{1,3})$/)?.[1]||1)));
    const page=askedPage;
    const items=await store.list(id,{offset:(page-1)*20,limit:20});
    if(!items.total)return replyText(id,"Пока пусто. Отправь аудиозапись (♫), и она появится здесь.");
    if(!items.tracks.length)return replyText(id,"Этой страницы нет. Всего страниц: "+Math.ceil(items.total/20)+". Отправь /list 1.");
    const listed=items.tracks.map((t,i)=>trackText(t,items.offset+i+1));
    const totalPages=Math.ceil(items.total/20);
    return replyText(id,"♫ Моя музыка · "+items.total+" треков · стр. "+page+"/"+totalPages+
      "\n\n"+listed.join("\n")+"\n\n/play N — слушать · /delete N — убрать · /list "+(page+1)+" — дальше");
  }
  // Telegram media groups keep tracks in Telegram's native music interface.
  // One explicit user request returns at most ten files, not a bulk broadcast.
  const album=cmd.match(/^\/album(?:@\w+)?(?:\s+(\d{1,2}))?$/i);
  if(album){
    const page=Number(album[1]||"1");
    if(!Number.isInteger(page)||page<1||page>30)return replyText(id,"Выбери страницу от 1 до 30: /album 1");
    const offset=(page-1)*10;
    const data=await store.list(id,{offset,limit:10});
    if(!data.total)return replyText(id,"В библиотеке пока нет музыки. Отправь сюда свой MP3/M4A.");
    if(!data.tracks.length)return replyText(id,"На этой странице песен нет. Открой /list.");
    if(data.tracks.length===1){
      const song=data.tracks[0];
      return {method:"sendAudio",body:{chat_id:id,audio:song.file_id,title:song.title,performer:song.performer,
        caption:"♫ Твоя музыка · альбом "+page+" · Vetogram Music"}};
    }
    return {method:"sendMediaGroup",body:{chat_id:id,media:data.tracks.map((track,i)=>({
      type:"audio",media:track.file_id,title:track.title,performer:track.performer,
      ...(i===0?{caption:"♫ Личная подборка Vetogram Music · "+data.tracks.length+" аудио · стр. "+page}: {})
    }))}};
  }
  const play=cmd.match(/^\/play(?:@\w+)?\s+(\d{1,3})$/i);
  if(play){
    const selected=await store.get(id,Number(play[1]));
    if(!selected)return replyText(id,"Нет записи с таким номером. Отправь /list.");
    return {method:"sendAudio",body:{chat_id:id,audio:selected.file_id,
      title:selected.title,performer:selected.performer,caption:"♫ Моя музыка · Vetogram Music"}};
  }
  const remove=cmd.match(/^\/delete(?:@\w+)?\s+(\d{1,3})$/i);
  if(remove){
    const deleted=await store.remove(id,Number(remove[1]));
    return replyText(id,deleted?"Запись убрана из личной библиотеки. Само сообщение в Telegram осталось.":"Не нашёл такой номер. /list");
  }
  const search=cmd.match(/^\/search(?:@\w+)?\s+(.{2,70})$/i);
  if(search){
    const matches=await store.search(id,search[1],{limit:20});
    return replyText(id,matches.length?"♫ Результаты в твоей библиотеке:\n\n"+
      matches.map(t=>trackText(t,t.index)).join("\n")+"\n\n/play N — воспроизвести":
      "Ничего не нашёл в твоей библиотеке. /list — полный список.");
  }
  if(m.audio){
    const incoming=makeReply(update);
    if(!incoming)return null;
    if(incoming.method!=="sendAudio")return incoming;
    const saved=await store.add(id,m.audio);
    return {method:"sendAudio",body:{...incoming.body,
      caption:(saved.added?"♫ Добавлено в твою библиотеку.":"♫ Этот трек уже есть в библиотеке.")+
      " Всего: "+saved.count+". /list — все песни. Ты можешь слушать здесь в плеере Telegram."}};
  }
  if(cmd.startsWith("/"))
    return replyText(id,"Команда не распознана. /help — все возможности.");
  return null;
}

export function createWebhookHandler({token,secret,fetchImpl=fetch,store=null}) {
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
      const job=await makeLibraryReply(data,store);
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
  const store=createMusicStore();
  const handler=createWebhookHandler({token,secret,store});
  createServer(handler).listen(port,"0.0.0.0",()=>console.info("Vetogram Music bot webhook listening"));
}
