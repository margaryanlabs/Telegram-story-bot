import { Api } from 'teleproto';
import { CustomFile } from 'teleproto/client/uploads.js';
import { writableDialog,makeRandomId,confirmedSendMessageId,assertReplyInDialog } from './telegram-chat-compose.js';
import {resolveOwnerSticker} from './telegram-sticker-catalog.js';

// Vercel's JSON payload limit is below Telegram's own file limits. Bound encoded
// files before allocation: ~2.4 MiB raw is safe inside a serverless request.
export const MEDIA_LIMIT_BYTES = 2 * 1024 * 1024;
export const MEDIA_KINDS = Object.freeze(['photo','document','voice','video','audio']);
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});
const MEDIA_TYPES = {
  photo: new Set(['image/jpeg','image/png','image/webp']),
  document: new Set(['application/pdf','text/plain','application/zip',
    'application/octet-stream','image/jpeg','image/png','image/webp',
    'video/mp4','audio/mpeg','audio/mp4','audio/ogg','audio/webm']),
  voice: new Set(['audio/ogg','audio/webm','audio/mp4']),
  video: new Set(['video/mp4']),
  audio: new Set(['audio/mpeg','audio/mp4','audio/ogg','audio/webm']),
};
function id(value){return String(value?.toString?.()||value||'');}
export function cleanCaption(value) {
  if(value===undefined||value===null)return '';
  if(typeof value!=='string')throw fail('Неверная подпись');
  const text=value.trim().replace(/\r\n?/g,'\n');
  if(text.length>1024||text.includes('\0'))throw fail('Подпись может содержать не более 1024 символов.');
  return text;
}
export function decodeMediaInput({kind,mime,name,base64,duration,width,height}={}) {
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
  if(['video','audio'].includes(kind)){
    const validContainer=normalizedMime==='video/mp4'||normalizedMime==='audio/mp4'
      ?buffer.length>=12&&buffer.toString('ascii',4,8)==='ftyp'
      :normalizedMime==='audio/ogg'?buffer.toString('ascii',0,4)==='OggS'
        :normalizedMime==='audio/webm'?buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
          :normalizedMime==='audio/mpeg'&&(buffer.toString('ascii',0,3)==='ID3'||
            (buffer.length>=2&&buffer[0]===0xff&&(buffer[1]&0xe0)===0xe0));
    if(!validContainer)throw fail('Содержимое медиа не соответствует выбранному формату.');
  }
  const timed=['voice','video','audio'].includes(kind);
  const secs=timed?Number(duration||0):0;
  if(kind==='voice'&&(!Number.isFinite(secs)||secs<0||secs>70))
    throw fail('Голосовое сообщение должно быть короче одной минуты');
  if(['video','audio'].includes(kind)&&(!Number.isFinite(secs)||secs<=0||secs>86400))
    throw fail('Не удалось определить длительность медиа. Выбери корректный видео- или аудиофайл.');
  const w=kind==='video'?Number(width):0,h=kind==='video'?Number(height):0;
  if(kind==='video'&&(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8192||h>8192))
    throw fail('Не удалось определить размер видео. Выбери корректный MP4.');
  return {buffer,kind,mime:normalizedMime,name:safeName,duration:Math.ceil(secs),width:w,height:h};
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
    return {index,id:String(d.id),emoji:String(attr.alt||'🎭').slice(0,12)};
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
    const selected=String(inputs.stickerId||'');
    if(!/^-?\d{1,22}$/.test(selected))throw fail('Недопустимый стикер');
    const doc=await resolveOwnerSticker(client,selected,inputs.setId,{recentStickers});
    media=new Api.InputMediaDocument({
      id:new Api.InputDocument({id:doc.id,accessHash:doc.accessHash,fileReference:doc.fileReference}),
    });
  }else if(action==='send_media'){
    const data=decodeMediaInput(inputs);
    message=cleanCaption(inputs.caption);
    const handle=await client.uploadFile({file:new CustomFile(data.name,data.buffer.length,'',data.buffer),workers:1});
    const filename=new Api.DocumentAttributeFilename({fileName:data.name});
    const attributes=data.kind==='voice'
      ?[new Api.DocumentAttributeAudio({duration:data.duration,voice:true})]
      :data.kind==='audio'
        ?[filename,new Api.DocumentAttributeAudio({duration:data.duration,voice:false})]
        :data.kind==='video'
          ?[filename,new Api.DocumentAttributeVideo({duration:data.duration,w:data.width,h:data.height,
            supportsStreaming:false})]
          :[filename];
    media=data.kind==='photo'
      ?new Api.InputMediaUploadedPhoto({file:handle})
      :new Api.InputMediaUploadedDocument({
        file:handle,mimeType:data.mime,forceFile:data.kind==='document',
        attributes,
      });
  }else throw fail('Неизвестный тип сообщения');
  const request=new Api.messages.SendMedia({
    peer,media,message,randomId,
    ...(mid?{replyTo:new Api.InputReplyToMessage({replyToMsgId:mid})}:{}),
  });
  const result=await client.invoke(request);
  return {sent:true,messageId:confirmedSendMessageId(result,randomId),
    chatId:id(chatId),kind:action==='send_sticker'?'sticker':inputs.kind,
    delivery:'telegram-accepted'};
}
