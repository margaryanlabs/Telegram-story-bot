// Explicit read-only, server-side Neon preflight; never log secrets or user data.
// Run only in authorized Preview with existing VETO_NEON_* and scoped private S3 env.
import { selectedStorageProvider, neonStorageConfigured } from '../lib/storage-provider.js';

let failed = false;
function report(name, ok, note = '') {
  const state = ok ? 'PASS' : 'BLOCKED';
  console.log('[VETOGRAM NEON PREFLIGHT] ' + name + ': ' + state + (note ? ' (' + note + ')' : ''));
  if (!ok) failed = true;
}
function finish() {
  console.log(failed ? 'NOT READY: do not promote or enable unified onboarding.' :
    'Read-only preflight passed. Live Telegram tests and full CI are still required.');
  if (failed) process.exitCode = 1;
}
if (selectedStorageProvider() !== 'neon') {
  report('provider', false, 'select Neon explicitly for the approved Preview');
  finish();
} else if (!neonStorageConfigured()) {
  report('server-only-credentials', false, 'Neon DB URL or original v4 key unavailable');
  finish();
} else {
  report('provider', true);
  const { neonStoreOperation } = await import('../lib/neon-store.js');
  try {
    const crypto = await neonStoreOperation('viewer_crypto_health', { environment:'preview' });
    report('existing-v4-session-key', crypto?.ready === true && crypto?.cipherVersion === 'v4',
      crypto?.ready ? 'original key fingerprint compatible' : 'not compatible or not verified');
  } catch {
    report('existing-v4-session-key', false, 'cannot prove decryption readiness');
  }
  try {
    const store = await neonStoreOperation('health', {});
    report('postgres-schema-v5', store?.backend === 'neon' && Number(store?.schemaVersion) >= 5,
      Number(store?.schemaVersion) >= 5 ? 'version 5 or newer' : 'apply reviewed Business lease migration before release');
    report('atomic-business-lease', store?.businessLeaseReady === true,
      store?.businessLeaseReady ? 'table present' : 'owner-scoped lease table unavailable');
    report('private-media-bucket', store?.mediaVault === true, 'private S3 bucket HEAD only');
  } catch {
    report('postgres-schema-v5', false, 'database not reachable or schema unavailable');
    report('private-media-bucket', false, 'storage health unverified');
  }
  // No background jobs, user-session decryption, migration or API writes here.
  finish();
}
