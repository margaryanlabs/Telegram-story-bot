import crypto from 'node:crypto';
import { Api } from 'teleproto';

export const MAX_MESSAGE_CHARACTERS = 4096;
export const SENDABLE_TYPES = Object.freeze(['private','group','bot','saved']);
const id = value => String(value?.toString?.() || value || '');

export function cleanOutgoingMessage(input) {
  if (typeof input !== 'string') throw Object.assign(new Error('Сообщение должно быть текстом.'), { status:400 });
  const text=input.replace(/\r\n?/g,'\n').trim();
  if (!text || /[\u0000]/.test(text) || text.length>MAX_MESSAGE_CHARACTERS) {
    throw Object.assign(new Error('Напиши сообщение от 1 до 4096 символов.'),{ status:400 });
  }
  return text;
}

export function validateSendNonce(value) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) {
    throw Object.assign(new Error('Открой чат заново, чтобы безопасно повторить отправку.'),{ status:400 });
  }
  return value;
}

// The caller must get these dialogs from the authenticated owner's own MTProto
// session. Never accept client-supplied access hashes or generic peer usernames.
export function writableDialog(dialogs, chatId) {
  const requested=String(chatId||'');
  if (!/^-?\d{1,22}$/.test(requested)) {
    throw Object.assign(new Error('Некорректный чат.'),{ status:400 });
  }
  const matched=dialogs.find(d=>id(d?.id)===requested);
  if (!matched || !matched.entity || !(
    matched.isUser || matched.isGroup || matched.entity.self
  ) || (matched.isChannel && !matched.isGroup) || matched.entity.deleted) {
    throw Object.assign(new Error('Отправка доступна только в существующих личных чатах, ботах, группах и Избранном.'),{ status:403 });
  }
  return matched;
}

export function makeRandomId(ownerId, chatId, nonce) {
  // Stable per owner, dialog and user's specific send intent. Telegram's
  // random_id prevents double send even if the HTTPS response is lost.
  const raw=crypto.createHash('sha256').update([ownerId,chatId,validateSendNonce(nonce)].join(':')).digest();
  let result=raw.readBigInt64BE(0);
  if (result === 0n) result=1n;
  return result;
}

export function sentMessageId(result, randomId) {
  const direct=Number(result?.id||0);
  if (Number.isSafeInteger(direct) && direct>0) return direct;
  const updates=Array.isArray(result?.updates) ? result.updates : [];
  const key=String(randomId);
  const mapped=updates.find(u=>/UpdateMessageID/i.test(u?.className||'') && String(u?.randomId||'')===key);
  const mid=Number(mapped?.id||0);
  if (Number.isSafeInteger(mid)&&mid>0) return mid;
  const newly=updates.find(u=>/UpdateNewMessage|UpdateNewChannelMessage/i.test(u?.className||''));
  const fallback=Number(newly?.message?.id||0);
  return Number.isSafeInteger(fallback) && fallback>0 ? fallback : null;
}

export async function sendOwnerMessage(client, dialogs, { ownerId,chatId,message,nonce }) {
  const text=cleanOutgoingMessage(message);
  const target=writableDialog(dialogs,chatId);
  const randomId=makeRandomId(ownerId,chatId,nonce);
  const peer=await client.getInputEntity(target.entity);
  // No BusinessBot rights and no Bot API impersonation: this is the already
  // authenticated Telegram owner's own MTProto session with an explicit send.
  const response=await client.invoke(new Api.messages.SendMessage({
    peer,message:text,randomId,noWebpage:false,silent:false,
  }));
  return { sent:true, messageId:sentMessageId(response,randomId),
    text,chatId:String(chatId),source:'owner-mtproto',delivery:'telegram-accepted' };
}
