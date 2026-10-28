/* Sets a webhook for a NEW dedicated Vetogram Music bot.
   Run only from trusted operator environment with secrets injected as env vars.
   Never prints the bot token or webhook secret. */
import { fileURLToPath } from "node:url";
export function webhookPayload(url,secret){
  const u=new URL(String(url));
  if(u.protocol!=="https:"||u.username||u.password||u.hash||
     !u.pathname.endsWith("/telegram/music-webhook"))throw Error("Expected public HTTPS music webhook path");
  if(!/^[A-Za-z0-9_-]{32,256}$/.test(String(secret)))throw Error("Use a random webhook secret of 32-256 characters: A-Z a-z 0-9 _ -");
  return {url:u.href,secret_token:secret,allowed_updates:["message"],drop_pending_updates:false,max_connections:10};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const token=process.env.VETOGRAM_MUSIC_BOT_TOKEN,
    secret=process.env.VETOGRAM_MUSIC_WEBHOOK_SECRET,
    url=process.env.VETOGRAM_MUSIC_WEBHOOK_URL;
  if(!token||!secret||!url)throw Error("Music bot secret environment variables required");
  const payload=webhookPayload(url,secret);
  const res=await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
  });
  const result=await res.json();
  if(!res.ok||!result.ok)throw Error("Telegram webhook setup failed — inspect environment and domain");
  console.log("Vetogram Music webhook registered.");
}
