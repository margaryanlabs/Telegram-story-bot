import crypto from 'node:crypto';

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function signingSeed() {
  const apiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!apiHash || !botToken) {
    throw new Error('Story Pilot signing material is not configured');
  }

  return crypto
    .createHash('sha256')
    .update(`story-pilot-store-signing:${apiHash}:${botToken}`)
    .digest();
}

function privateKey() {
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, signingSeed()]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

export function storyPilotPublicKey() {
  const der = crypto.createPublicKey(privateKey()).export({ format: 'der', type: 'spki' });
  return Buffer.from(der).subarray(SPKI_ED25519_PREFIX.length).toString('base64url');
}

export function signStoryPilotRequest(body, timestamp = Date.now()) {
  const canonicalBody = typeof body === 'string' ? body : JSON.stringify(body);
  const message = `${timestamp}.${canonicalBody}`;
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), privateKey()).toString('base64url');
  return {
    timestamp: String(timestamp),
    signature,
    body: canonicalBody,
  };
}

export function verifyEdgeSignature({ publicKey, timestamp, body, signature, maxAgeMs = 120000 }) {
  const ts = Number(timestamp || 0);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxAgeMs) return false;

  const raw = Buffer.from(String(publicKey || ''), 'base64url');
  if (raw.length !== 32) return false;

  const key = crypto.createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });

  const message = `${ts}.${typeof body === 'string' ? body : JSON.stringify(body)}`;
  return crypto.verify(
    null,
    Buffer.from(message, 'utf8'),
    key,
    Buffer.from(String(signature || ''), 'base64url'),
  );
}
