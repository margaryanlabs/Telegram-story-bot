// Telegram E.164 input validation shared by the onboarding endpoint.
// Remove only common visual separators; never silently drop letters or a second '+'.
export function normalizeTelegramPhone(raw) {
  const formatted = String(raw ?? '').trim().replace(/[()\s-]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(formatted) ? formatted : null;
}
