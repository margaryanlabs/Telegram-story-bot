// MTProto sent-code metadata, normalized to safe channel labels.
// No phone number, phone code, session or phoneCodeHash may reach the browser.
const CHANNELS = Object.freeze({
  sentcodetypeapp: 'telegram_app',
  sentcodetypesms: 'sms',
  sentcodetypesmsword: 'sms',
  sentcodetypesmsphrase: 'sms',
  sentcodetypecall: 'call',
  sentcodetypemissedcall: 'missed_call',
  sentcodetypeflashcall: 'flash_call',
  sentcodetypefragmentsms: 'fragment',
  sentcodetypeemailcode: 'email',
  codetypeapp: 'telegram_app',
  codetypesms: 'sms',
  codetypecall: 'call',
  codetypemissedcall: 'missed_call',
  codetypeflashcall: 'flash_call',
  codetypefragmentssms: 'fragment',
  codetypeemailcode: 'email',
});

export function codeDeliveryChannel(type) {
  const name = String(type?.className || type?.constructor?.name || '')
    .replace(/^auth\./i, '').toLowerCase();
  return CHANNELS[name] || null;
}

export function codeStateFromSent(sent, previous = {}, now = Date.now()) {
  if (!sent || typeof sent.phoneCodeHash !== 'string' || !sent.phoneCodeHash) {
    throw new Error('Telegram did not return a usable phone code challenge');
  }
  const retryCount = Math.max(0, Number(previous.retryCount) || 0);
  const delivery = codeDeliveryChannel(sent.type) || 'other';
  // The next channel is Telegram's decision. Never infer "SMS" from "not app".
  const nextDelivery = retryCount < 2 ? codeDeliveryChannel(sent.nextType) : null;
  const timeout = Number(sent.timeout);
  const waitSeconds = Number.isFinite(timeout) && timeout >= 0
    ? Math.min(600, Math.ceil(timeout))
    : 60;
  return {
    phoneCodeHash: sent.phoneCodeHash,
    isCodeViaApp: delivery === 'telegram_app',
    delivery,
    nextDelivery,
    resendAt: nextDelivery ? new Date(now + waitSeconds * 1000).toISOString() : null,
    retryCount,
  };
}

export function safeCodeStatus(state, expiresAt) {
  return {
    stage: 'code',
    delivery: state?.delivery || (state?.isCodeViaApp ? 'telegram_app' : 'other'),
    nextDelivery: state?.nextDelivery || null,
    resendAt: state?.resendAt || null,
    expiresAt,
  };
}

export function codeResendWindow(state, now = Date.now()) {
  if (!state?.nextDelivery || (Number(state.retryCount) || 0) >= 2) {
    return { allowed: false, retryAfterSeconds: null };
  }
  const deadline = Date.parse(state.resendAt || '');
  const seconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 60;
  return { allowed: seconds === 0, retryAfterSeconds: seconds };
}
