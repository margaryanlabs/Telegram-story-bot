import { Api } from 'teleproto';
import { CustomFile } from 'teleproto/client/uploads.js';
import { writableDialog,makeRandomId,sentMessageId,assertReplyInDialog } from './telegram-chat-compose.js';

// Vercel's JSON payload limit is below Telegram's own file limits. Bound encoded
// files before allocation: ~2.4 MiB raw is safe inside a serverless request.
export const MEDIA_LIMIT_BYTES = 2 * 1024 * 1024;
export const MEDIA_KINDS = Object.freeze(['photo','document','voice']);
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});
const MEDIA_TYPES = {
  photo: new Set(['image/jpeg','image/png','image/webp']),
  document: new Set(['application/pdf','text/plain','application/zip',
    'application/octet-stream','image/jpeg','image/png','image/webp',
    'video/mp4','audio/mpeg','audio/mp4','audio/ogg','audio/webm']),
  voice: new Set(['audio/ogg','audio/webm','audio/mp4']),
};
function id(value){return String(value?.toString?.()||value||'');}
export function cleanCaption(value) {
  if(value===undefined||value===null)return '';
  if(typeof value!=='string')throw fail('Неверная подпись');
  const text=value.trim().replace(/\r\n?/g,'\n');
  if(text.length>1024||text.includes('\0'))throw fail('Подпись может содержать не более 1024 символов.');
  return text;
}
export function decodeMediaInput({kind,mime,name,base64,duration}={}) {
  if(!MEDIA_KINDS.includes(kind))throw fail('Недоступный формат вложения');
  const normalizedMime=String(mime||'').split(';')[0].trim().toLowerCase();
  if(!MEDIA_TYPES[kind].has(normalizedMime))throw fail('Этот тип файла пока не поддерживается');
  const safeName=String(name||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90);
  if(!safeName||safeName.startsWith('.')||/\.\./.test(safeName))throw fail('Неправильное имя файла');
  if(typeof base64!=='string'||base64.length===0||base64.length>Math.ceil(MEDIA_LIMIT_BYTES*4/3)+8
      ||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||base64.length%4===1)
    throw fail('Размер файла превышает 2 МБ или повреждены данные');
  const buffer=Buffer.from(base64,'base64');
  if(buffer.length<1||buffer.length>MEDIA_LIMIT_BYTES)throw fail('Файл слишком большой. Выбери вложение до 2 МБ.');
  const secs=kind==='voice'?Number(duration||0):0;
  if(kind==='voice'&&(!Number.isFinite(secs)||secs<0||secs>70))
    throw fail('Голосовое сообщение должно быть короче одной минуты');
  return {buffer,kind,mime:normalizedMime,name:safeName,duration:Math.ceil(secs)};
}
export async function recentStickers(client){
  const result=await client.invoke(new Api.messages.GetRecentStickers({hash:0n,attached:false}));
  return Array.isArray(result?.stickers)
    ?result.stickers.filter(d=>d?.id&&d?.accessHash&&d?.fileReference &&
      d?.attributes?.some(a=>/DocumentAttributeSticker/i.test(a?.className||''))).slice(0,24)
    :[];
}
export function recentStickersPublic(documents){
  return documents.map((d,index)=>{
    const attr=d.attributes.find(a=>/DocumentAttributeSticker/i.test(a?.className||''))||{};
    return {index,emoji:String(attr.alt||'🎭').slice(0,12)};
  });
}
export async function sendRichTelegramMessage(client,dialogs,inputs){
  const {ownerId,chatId,nonce,replyTo,action}=inputs;
  const dialog=writableDialog(dialogs,chatId);
  const peer=await client.getInputEntity(dialog.entity);
  const mid=await assertReplyInDialog(client,dialog,replyTo);
  const randomId=makeRandomId(ownerId,chatId,nonce);
  let media,message='';
  if(action==='send_sticker'){
    const index=Number(inputs.stickerIndex);
    if(!Number.isInteger(index)||index<0||index>=24)throw fail('Недопустимый стикер');
    const docs=await recentStickers(client),doc=docs[index];
    if(!doc)throw fail('Стикер больше не входит в список недавних',409);
    media=new Api.InputMediaDocument({
      id:new Api.InputDocument({id:doc.id,accessHash:doc.accessHash,fileReference:doc.fileReference}),
    });
  }else if(action==='send_media'){
    const data=decodeMediaInput(inputs);
    message=cleanCaption(inputs.caption);
    const handle=await client.uploadFile({file:new CustomFile(data.name,data.buffer.length,'',data.buffer),workers:1});
    media=data.kind==='photo'
      ?new Api.InputMediaUploadedPhoto({file:handle})
      :new Api.InputMediaUploadedDocument({
        file:handle,mimeType:data.mime,forceFile:data.kind==='document',
        attributes:data.kind==='voice'
          ?[new Api.DocumentAttributeAudio({duration:data.duration,voice:true})]
          :[new Api.DocumentAttributeFilename({fileName:data.name})],
      });
  }else throw fail('Неизвестный тип сообщения');
  const request=new Api.messages.SendMedia({
    peer,media,message,randomId,
    ...(mid?{replyTo:new Api.InputReplyToMessage({replyToMsgId:mid})}:{}),
  });
  const result=await client.invoke(request);
  return {sent:true,messageId:sentMessageId(result,randomId),
    chatId:id(chatId),kind:action==='send_sticker'?'sticker':inputs.kind,
    delivery:'telegram-accepted'};
}
