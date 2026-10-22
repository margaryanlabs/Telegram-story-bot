// The default provider is deliberately unchanged. Never transparently fail over
// private data writes: it would split archives between databases.
export function selectedStorageProvider() {
  const selected = String(process.env.VETO_STORAGE_PROVIDER || 'supabase').trim().toLowerCase();
  if (selected !== 'supabase' && selected !== 'neon') throw new Error('INVALID_VETO_STORAGE_PROVIDER');
  return selected;
}
export function neonStorageConfigured() {
  return selectedStorageProvider() === 'neon'
    && Boolean(process.env.VETO_NEON_DATABASE_URL && process.env.VETO_NEON_SESSION_KEY);
}

/** A healthy store must report the exact cipher used for this provider. */
export function expectedCipherVersion(provider = selectedStorageProvider()) {
  return provider === 'neon' ? 'v4' : 'v3';
}
export function sessionCryptoReady(health, provider = selectedStorageProvider()) {
  return health?.ready === true
    && (health?.cipherVersion || health?.version) === expectedCipherVersion(provider);
}
