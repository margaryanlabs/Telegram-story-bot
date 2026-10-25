import crypto from 'node:crypto';

// Independent key and domain from Telegram session keys and AI Memory.
// This is server-decryptable AES-256-GCM AT REST, explicitly NOT E2EE.
function key(){
  const value=String(process.env.VETOGRAM_TASKS_KEY||'');
  if(!/^[0-9a-f]{64}$/i.test(value))throw Error('TASK_CLOUD_KEY_UNAVAILABLE');
  return Buffer.from(value,'hex');
}
const keyId=secret=>crypto.createHash('sha256')
  .update('vetogram-task-vault-key-v1').update(secret).digest('hex').slice(0,16);
const associated=owner=>{
  const id=String(owner);
  if(!/^\d{1,20}$/.test(id)||id==='0')throw Error('TASK_CLOUD_OWNER_INVALID');
  return Buffer.from('vetogram-task-vault:v1:owner:'+id,'utf8');
};
export function taskEncryptionReady(){
  try{return key().length===32}catch{return false}
}
export function encryptTaskCloud(owner,payload){
  const secret=key(),nonce=crypto.randomBytes(12);
  const plaintext=Buffer.from(JSON.stringify(payload),'utf8');
  if(!plaintext.length||plaintext.length>32000)throw Error('TASK_CLOUD_TOO_LARGE');
  const c=crypto.createCipheriv('aes-256-gcm',secret,nonce);
  c.setAAD(associated(owner));
  const ciphertext=Buffer.concat([c.update(plaintext),c.final()]);
  return ['task1',keyId(secret),nonce.toString('base64url'),
    c.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function decryptTaskCloud(owner,envelope){
  const parts=String(envelope||'').split('.');
  if(parts.length!==5||parts[0]!=='task1')throw Error('TASK_CLOUD_INVALID_ENVELOPE');
  const secret=key();
  if(parts[1]!==keyId(secret))throw Error('TASK_CLOUD_KEY_MISMATCH');
  const [nonce,tag,body]=parts.slice(2).map(s=>Buffer.from(s,'base64url'));
  if(nonce.length!==12||tag.length!==16||body.length<1||body.length>50000)
    throw Error('TASK_CLOUD_INVALID_ENVELOPE');
  const d=crypto.createDecipheriv('aes-256-gcm',secret,nonce);
  d.setAAD(associated(owner));d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body),d.final()]).toString('utf8'));
}
