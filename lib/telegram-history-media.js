import {
  createHistoryMediaUpload, finalizeHistoryMediaUpload,
} from './viewer-sync-store.js';
import { HISTORY_MEDIA_LIMIT_BYTES, HISTORY_MEDIA_PER_PAGE } from './telegram-history-backup.js';

function mediaDescriptor(message) {
  const document = message?.document || message?.media?.document;
  const filename = Array.isArray(document?.attributes)
    ? document.attributes.find(a => /filename/i.test(String(a.className || '')))?.fileName : null;
  return {
    fileSize: Number(document?.size || 0),
    mimeType: String(document?.mimeType || (message?.photo ? 'image/jpeg' : 'application/octet-stream')).slice(0,100),
    fileName: String(filename || '').replace(/[\\/]/g,'_').slice(0,110) || null,
  };
}

function mediaError(error) {
  const message=String(error?.message || error || 'media_failed');
  return /timeout|AbortError/i.test(message) ? 'telegram_media_timeout'
    : /size|large|exceeds/i.test(message) ? 'telegram_media_too_large'
    : 'telegram_media_unavailable';
}

// Background and foreground call exactly the same bounded media pipeline.
// Failure of an attachment must never fail the successfully copied messages.
export async function archiveHistoryMedia(client, ownerId, chatId, candidates, { enabled = false } = {}) {
  if (!enabled) return { saved:0, attempted:0, skipped:true };
  const messages = Array.isArray(candidates) ? candidates.slice(0,HISTORY_MEDIA_PER_PAGE) : [];
  let saved = 0,attempted = 0;
  for (const message of messages) {
    const id=Number(message?.id);
    if (!Number.isSafeInteger(id) || id<=0) continue;
    const spec=mediaDescriptor(message);
    if (spec.fileSize > HISTORY_MEDIA_LIMIT_BYTES) continue;
    attempted++;
    let ticket=null;
    try {
      // Unknown-size media is rejected if runtime download exceeds limit.
      const media=await client.downloadMedia(message,{ progressCallback:(received,total)=>{
        if (Number(received) > HISTORY_MEDIA_LIMIT_BYTES
          || Number(total) > HISTORY_MEDIA_LIMIT_BYTES) throw new Error('telegram_media_too_large');
      }});
      const buffer=Buffer.isBuffer(media) ? media : (media instanceof Uint8Array ? Buffer.from(media) : null);
      if (!buffer?.length || buffer.length > HISTORY_MEDIA_LIMIT_BYTES) {
        throw new Error('telegram_media_too_large');
      }
      ticket=await createHistoryMediaUpload(ownerId,chatId,id,buffer.length,spec.mimeType,spec.fileName);
      if (!ticket?.allowed) { attempted--; continue; }
      const url=new URL(ticket.signedUrl);
      // Bound the upload destination to the existing private Supabase bucket.
      if (url.protocol!=='https:' || url.hostname!=='xvtmgzzaomolnvkcgosk.supabase.co'
        || !url.pathname.startsWith('/storage/v1/object/upload/sign/')) {
        throw new Error('invalid_storage_destination');
      }
      const response=await fetch(url,{
        method:'PUT',headers:{'content-type':spec.mimeType,'x-upsert':'true'},
        body:buffer,
        signal:AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('private_vault_upload_http_'+response.status);
      await finalizeHistoryMediaUpload(ownerId,chatId,id,ticket.path,true);
      saved++;
    } catch(error) {
      if (ticket?.allowed) {
        await finalizeHistoryMediaUpload(ownerId,chatId,id,ticket.path,false,mediaError(error)).catch(()=>{});
      }
      console.warn('Telegram history media upload failed',{
        ownerId,chatId,messageId:id,error:mediaError(error),
      });
    }
  }
  return { saved,attempted,skipped:false };
}
