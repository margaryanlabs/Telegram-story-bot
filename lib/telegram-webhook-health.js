// Telegram keeps last_error_message long after an update eventually succeeds.
// Do not turn a historical failure into a permanent 503 for the entire product.
const RECENT_ERROR_SECONDS = 15 * 60;

export function telegramWebhookHealth(webhook, nowMs = Date.now()) {
  const url = String(webhook?.url || '');
  let endpointReady = false;
  try {
    const parsed = new URL(url);
    endpointReady = parsed.protocol === 'https:' && parsed.pathname === '/api/webhook-v8';
  } catch {}
  const pendingUpdates = Math.max(0, Number(webhook?.pending_update_count || 0));
  const lastError = String(webhook?.last_error_message || '').trim() || null;
  const timestamp = Number(webhook?.last_error_date || 0);
  const errorTimeKnown = Number.isFinite(timestamp) && timestamp > 0;
  const errorAgeSeconds = errorTimeKnown
    ? Math.max(0, Math.floor(nowMs / 1000) - timestamp)
    : null;
  // Missing or future timestamps are conservatively treated as active errors.
  const errorRecent = Boolean(lastError && (
    !errorTimeKnown || timestamp > nowMs / 1000 || errorAgeSeconds < RECENT_ERROR_SECONDS
  ));
  return {
    endpointReady,
    pendingUpdates,
    lastError,
    lastErrorAt: errorTimeKnown ? new Date(timestamp * 1000).toISOString() : null,
    errorAgeSeconds,
    errorRecent,
    errorStale: Boolean(lastError && !errorRecent),
    ready: endpointReady && !errorRecent,
  };
}
