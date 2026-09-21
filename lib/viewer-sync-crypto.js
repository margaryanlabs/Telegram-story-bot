import crypto from 'node:crypto';

const VERSION = 'v1';
const AAD_PREFIX = 'story-pilot-viewer-sync';

function masterKey() {
  const explicit = String(process.env.VIEWER_SYNC_MASTER_KEY || '').trim();
  if (explicit) return crypto.createHash('sha256').update(explicit).digest();

  const telegramApiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!telegramApiHash || !botToken) {
    throw new Error('Viewer Sync encryption key is not configured');
  }

  // Reuse two existing server-only secrets as input material without storing
  // another secret in this public repository. The derived key never leaves Vercel.
  return crypto
    .createHash('sha256')
    .update(`story-pilot-viewer-sync:${telegramApiHash}:${botToken}`)
    .digest();
}

function aad(context) {
  return Buffer.from(`${AAD_PREFIX}:${String(context || 'global')}`, 'utf8');
}

export function sealJson(value, context) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  cipher.setAAD(aad(context));
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function openJson(value, context) {
  const [version, ivB64, tagB64, ciphertextB64] = String(value || '').split('.');
  if (version !== VERSION || !ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted viewer-sync payload');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAAD(aad(context));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}
