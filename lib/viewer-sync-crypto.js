import crypto from 'node:crypto';
import { getViewerSyncKeyring } from './viewer-sync-keyring.js';

const VERSION_V1 = 'v1';
const VERSION_V2 = 'v2';
const AAD_PREFIX = 'story-pilot-viewer-sync';
const V2_SALT = Buffer.from('telegram-control-viewer-sync-v2', 'utf8');

function aad(context) {
  return Buffer.from(`${AAD_PREFIX}:${String(context || 'global')}`, 'utf8');
}

function v2Key(secret, keyId) {
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(String(secret), 'utf8'),
    V2_SALT,
    Buffer.from(`aes-256-gcm:${keyId}`, 'utf8'),
    32,
  ));
}

function decryptAesGcm({ key, ivB64, tagB64, ciphertextB64, context }) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
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

function explicitLegacySecrets() {
  const values = [];
  const current = String(process.env.VIEWER_SYNC_MASTER_KEY || '').trim();
  if (current) values.push(current);
  try {
    const raw = String(process.env.VIEWER_SYNC_PREVIOUS_KEYS_JSON || '').trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      for (const entry of entries) {
        const secret = String(entry?.key ?? entry ?? '').trim();
        if (secret) values.push(secret);
      }
    }
  } catch {}
  return values;
}

function legacyKeyCandidates() {
  const candidates = explicitLegacySecrets().map(secret =>
    crypto.createHash('sha256').update(secret).digest(),
  );

  const environment = String(process.env.VERCEL_ENV || '').trim();
  if (!environment || environment === 'production') {
    const apiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (apiHash && botToken) {
      candidates.push(
        crypto.createHash('sha256')
          .update(`story-pilot-viewer-sync:${apiHash}:${botToken}`)
          .digest(),
      );
    }
  }

  const seen = new Set();
  return candidates.filter(key => {
    const id = key.toString('hex');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function sealJson(value, context) {
  const keyring = await getViewerSyncKeyring({ required: true });
  const current = keyring.current;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', v2Key(current.key, current.id), iv);
  cipher.setAAD(aad(context));
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION_V2,
    current.id,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export async function openJsonWithMeta(value, context) {
  const parts = String(value || '').split('.');
  const version = parts[0];

  if (version === VERSION_V2) {
    const [, keyId, ivB64, tagB64, ciphertextB64] = parts;
    if (!keyId || !ivB64 || !tagB64 || !ciphertextB64) {
      throw new Error('Invalid encrypted viewer-sync payload');
    }
    const keyring = await getViewerSyncKeyring({ required: true });
    const entry = [keyring.current, ...(keyring.previous || [])].find(item => item.id === keyId);
    if (!entry) throw new Error('Viewer Sync encryption key version is unavailable');
    return {
      value: decryptAesGcm({
        key: v2Key(entry.key, entry.id),
        ivB64, tagB64, ciphertextB64, context,
      }),
      version: VERSION_V2,
      keyId,
      legacy: false,
    };
  }

  if (version === VERSION_V1) {
    const [, ivB64, tagB64, ciphertextB64] = parts;
    if (!ivB64 || !tagB64 || !ciphertextB64) {
      throw new Error('Invalid encrypted viewer-sync payload');
    }
    let lastError = null;
    for (const key of legacyKeyCandidates()) {
      try {
        return {
          value: decryptAesGcm({ key, ivB64, tagB64, ciphertextB64, context }),
          version: VERSION_V1,
          keyId: null,
          legacy: true,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Legacy Viewer Sync encryption key is unavailable');
  }

  throw new Error('Invalid encrypted viewer-sync payload');
}

export async function openJson(value, context) {
  return (await openJsonWithMeta(value, context)).value;
}

export function isLegacyCiphertext(value) {
  return String(value || '').startsWith(`${VERSION_V1}.`);
}
