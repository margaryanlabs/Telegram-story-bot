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
