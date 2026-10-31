/* Vetogram Music Bot — PRIVATE opt-in audio echo to Telegram native player.
 * Standalone backend module, NOT attached to VETOGRAM messenger.
 * Required deployment env: VETOGRAM_MUSIC_BOT_TOKEN and VETOGRAM_MUSIC_WEBHOOK_SECRET.
 * No chat scraping, no piracy search, no persistent media collection.
 */
import {timingSafeEqual} from "node:crypto";
const HOME="https://vetogram-music-live.vercel.app/";
const TEXT={
 welcome:"🎧 Vetogram Music\n\nПерешли сюда свой MP3 или M4A, который у тебя есть право использовать. Я отправлю его обратно как музыку, чтобы его можно было слушать через встроенный плеер Telegram.\n\nДругие чаты я не читаю. Плейлисты и синхронизация в разработке.",
 info:"Отправь музыкальный файл в личный чат с ботом (как аудио, не голосовое сообщение). Бот вернёт его для прослушивания. Пока здесь нет облачного хранилища или доступа к VK/Яндекс Музыке."
};
const envToken=()=>process.env.VETOGRAM_MUSIC_BOT_TOKEN||"";
const envSecret=()=>process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET||"";
function equalSecret(given,expected){
 if(typeof given!=="string"||!given||!expected)return false;
 const a=Buffer.from(given),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
async function tg(method,payload,token){
 const endpoint="https://api.telegram.org/bot"+token+"/"+method;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const response=await fetch(endpoint,{method:"POST",signal:ctrl.signal,
   headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!response.ok)throw Error("Telegram send returned "+response.status);
  const result=await response.json();
  if(!result?.ok)throw Error("Telegram rejected message");
  return result.result;
 }finally{clearTimeout(timer)}
}
function sanitize(s,n=140){return String(s??"").replace(/[\u0000-\u001f\u007f<>]/g," ").trim().slice(0,n)}
export function parseMusicUpdate(body){
 const m=body?.message;
 if(!m||m?.chat?.type!=="private"||!Number.isSafeInteger(m?.chat?.id)||m.chat.id!==m.from?.id)return null;
 const chat_id=m.chat.id,text=typeof m.text==="string"?m.text.trim():"";
 if(text==="/start"||text.startsWith("/start "))return {kind:"welcome",chat_id};
 if(text==="/help"||text==="/privacy")return {kind:"info",chat_id};
 const a=m.audio;
 if(a&&typeof a.file_id==="string"&&a.file_id.length>10&&a.file_id.length<256){
  return {kind:"audio",chat_id,file_id:a.file_id,title:sanitize(a.title||"Мой трек",100),
   performer:sanitize(a.performer||"Моя музыка",100)};
 }
 return {kind:"info",chat_id};
}
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({ok:false});
 const token=envToken(),secret=envSecret();
 if(!token||!secret)return res.status(503).json({ok:false,reason:"Not configured"});
 if(!equalSecret(req.headers?.["x-telegram-bot-api-secret-token"],secret))return res.status(403).json({ok:false});
 const body=req.body;
 if(!body||typeof body!=="object"||JSON.stringify(body).length>128000)return res.status(400).json({ok:false});
 const event=parseMusicUpdate(body);
 if(!event)return res.status(200).json({ok:true});
 try{
  if(event.kind==="audio"){
   await tg("sendAudio",{chat_id:event.chat_id,audio:event.file_id,
     title:event.title,performer:event.performer,
     caption:"🎧 Vetogram Music · твоё аудио в плеере Telegram"},token);
  }else{
   await tg("sendMessage",{chat_id:event.chat_id,text:TEXT[event.kind],
    reply_markup:{inline_keyboard:[[{
      text:"♫ Открыть Vetogram Music",
      web_app:{url:HOME}
    }]]}},token);
  }
  return res.status(200).json({ok:true});
 }catch{
  // Do not log identifiers, private audio, bot token or Telegram response payload.
  return res.status(502).json({ok:false,reason:"Delivery failed"});
 }
}
