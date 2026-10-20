import crypto from 'node:crypto';

// Independent reversible cipher for Neon: v4 never overwrites a legacy Supabase v3 blob.
// Key material must be a 32-byte hex secret from server-only VETO_NEON_SESSION_KEY.
const material = () => {
  const value = String(process.env.VETO_NEON_SESSION_KEY || '').trim();
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('VETO_NEON_SESSION_KEY_NOT_CONFIGURED');
  return Buffer.from(value, 'hex');
};
const keyId = key => crypto.createHash('sha256').update(key).digest('hex').slice(0,16);
const aad = context => Buffer.from('veto-neon-session:v4:' + String(context || 'global'), 'utf8');

export function neonCipherReady() {
  try { return material().length === 32; } catch { return false; }
}
export function sealNeonJson(value, context) {
  const key = material(), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return ['v4',keyId(key),iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')].join('.');
}
export function openNeonJson(ciphertext, context) {
  const parts = String(ciphertext || '').split('.');
  if (parts.length !== 5 || parts[0] !== 'v4') throw new Error('INVALID_NEON_CIPHER_VERSION');
  const key = material();
  if (parts[1] !== keyId(key)) throw new Error('NEON_SESSION_KEY_VERSION_UNAVAILABLE');
  const iv = Buffer.from(parts[2],'base64url'),tag=Buffer.from(parts[3],'base64url');
  if (iv.length !== 12 || tag.length !== 16 || !parts[4]) throw new Error('INVALID_NEON_CIPHERTEXT');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(aad(context));decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[4],'base64url')),decipher.final()]).toString('utf8'));
}
