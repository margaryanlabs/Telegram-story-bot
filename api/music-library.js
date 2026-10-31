import { validateTelegramMiniApp } from '../lib/telegram-miniapp-auth.js';
import { musicStore, ownerTrack, trackId } from '../lib/vetogram-music-library.js';

const MAX_BYTES=20*1024*1024;
const deadline=()=>AbortSignal.timeout(15000);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'method_not_allowed'});}
  let body=req.body;
  try {if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({ok:false,error:'invalid_json'});}
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const user=validateTelegramMiniApp(body?.initData,token,3600);
  if(!user || !Number.isSafeInteger(user.id) || user.id<=0)return res.status(401).json({ok:false,error:'telegram_auth_required'});
  // Never trust caller-supplied user_id, file_id or a Telegram download URL.
  const store=musicStore();
  if(!store)return res.status(503).json({ok:false,error:'library_not_configured',message:'Сохранение аудио из Telegram ещё не подключено. Можно добавить файл с устройства.'});
  try {
    if(body.action==='bot') {
      const response=await fetch('https://api.telegram.org/bot'+token+'/getMe',{signal:deadline()});
      const result=await response.json();
      if(!response.ok || !result.ok || !/^[A-Za-z0-9_]{5,32}$/.test(result.result?.username||''))throw Error('bot_unavailable');
      return res.status(200).json({ok:true,username:result.result.username});
    }
    if(body.action==='list') {
      const offset=Math.max(0,Math.min(300,Math.floor(Number(body.offset)||0)));
      const page=await store.list(user.id,{offset,limit:30});
      return res.status(200).json({ok:true,total:page.total,offset:page.offset,tracks:page.tracks.map(t=>({
        id:trackId(t),title:t.title,artist:t.performer,duration:t.duration,source:'telegram',
        // Telegram's standard getFile currently limits downloads to 20 MB.
        downloadable:t.file_size>0 && t.file_size<=MAX_BYTES,hasArtwork:!!t.thumbnail_file_id,artwork:'',created_at:t.created_at
      }))});
    }
    if(!['stream','artwork'].includes(body.action))return res.status(400).json({ok:false,error:'unknown_action'});
    const track=await ownerTrack(store,user.id,body.id);
    if(!track)return res.status(404).json({ok:false,error:'track_not_found'});
    const artwork=body.action==='artwork',limit=artwork?1024*1024:MAX_BYTES;
    if(artwork&&!track.thumbnail_file_id)return res.status(404).json({ok:false,error:'artwork_not_found'});
    if(!artwork&&(!track.file_size || track.file_size>limit))return res.status(413).json({ok:false,error:'file_too_large',message:'Этот файл можно слушать в Telegram. Для встроенного плеера добавь файл до 20 МБ.'});
    const meta=await fetch('https://api.telegram.org/bot'+token+'/getFile',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file_id:artwork?track.thumbnail_file_id:track.file_id}),signal:deadline()
    });
    const file=await meta.json();
    const path=file?.result?.file_path;
    if(!meta.ok || !file.ok || typeof path!=='string' || !/^[A-Za-z0-9_./-]+$/.test(path) || path.includes('..'))throw Error('file_unavailable');
    if(!file.result.file_size || file.result.file_size>limit)return res.status(413).json({ok:false,error:'file_too_large'});
    const upstream=await fetch('https://api.telegram.org/file/bot'+token+'/'+path,{signal:deadline(),redirect:'error'});
    if(!upstream.ok || !upstream.body)throw Error('file_unavailable');
    // Bound the body while reading. A forged Content-Length cannot allocate an
    // arbitrary buffer; the token-bearing Telegram URL never reaches the client.
    const reader=upstream.body.getReader(), chunks=[];let size=0;
    try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)throw Error('file_too_large');chunks.push(Buffer.from(part.value));}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}
    res.setHeader('Content-Type',artwork?'image/jpeg':track.mime_type==='audio/mp4'?'audio/mp4':'audio/mpeg');
    return res.status(200).send(Buffer.concat(chunks));
  } catch {
    return res.status(502).json({ok:false,error:'audio_unavailable',message:'Аудио сейчас недоступно. Повтори позже или добавь личный файл.'});
  }
}
