import crypto from 'node:crypto';

// Separate key domain from Telegram MTProto session encryption.
// AES-256-GCM at rest, server-side decryptable (NOT end-to-end encryption).
function key(){
  const raw=String(process.env.VETOGRAM_AI_MEMORY_KEY||'');
  if(!/^[a-f0-9]{64}$/i.test(raw))throw Error('AI_MEMORY_KEY_NOT_CONFIGURED');
  return Buffer.from(raw,'hex');
}
const id=secret=>crypto.createHash('sha256').update('vetogram-ai-memory-v1').update(secret).digest('hex').slice(0,16);
function associated(owner){
  if(!/^\d{1,20}$/.test(String(owner))||String(owner)==='0')throw Error('AI_MEMORY_INVALID_OWNER');
  return Buffer.from('vetogram-ai-memory:v1:owner:'+String(owner),'utf8');
}
export function memoryEncryptionReady(){
  try {return key().length===32;}catch{return false;}
}
export function encryptAiMemory(owner,notes){
  const secret=key(),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',secret,iv);
  cipher.setAAD(associated(owner));
  const plaintext=Buffer.from(JSON.stringify(notes),'utf8');
  if(plaintext.length>12000)throw Error('AI_MEMORY_PAYLOAD_TOO_LARGE');
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  return ['mem1',id(secret),iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptAiMemory(owner,envelope){
  const parts=String(envelope||'').split('.');
  if(parts.length!==5||parts[0]!=='mem1')throw Error('AI_MEMORY_INVALID_ENVELOPE');
  const secret=key();
  if(parts[1]!==id(secret))throw Error('AI_MEMORY_KEY_MISMATCH');
  const iv=Buffer.from(parts[2],'base64url'),tag=Buffer.from(parts[3],'base64url');
  const body=Buffer.from(parts[4],'base64url');
  if(iv.length!==12||tag.length!==16||body.length<1||body.length>24000)throw Error('AI_MEMORY_INVALID_CIPHER');
  const cipher=crypto.createDecipheriv('aes-256-gcm',secret,iv);
  cipher.setAAD(associated(owner));cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8'));
}
