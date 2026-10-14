// Client-safe Telegram MTProto authorization errors. Never return raw RPC traces
// or secret-bearing upstream messages to the Mini App.
export function classifyTelegramAuthError(error) {
  const raw = String(error?.errorMessage || error?.message || error || '');
  const flood = raw.match(/FLOOD_WAIT[_ ]?(\d+)?/i);
  if (flood) {
    const seconds = Math.max(30, Number(flood[1] || 60));
    return {
      status: 429,
      message: `Telegram ограничил новые попытки. Подожди около ${Math.ceil(seconds / 60)} мин. и попробуй снова.`,
      retryAfterSeconds: seconds,
    };
  }
  if (/PHONE_NUMBER_INVALID|PHONE_NUMBER_UNOCCUPIED/i.test(raw)) {
    return { status: 400, message: 'Проверь номер Telegram и код страны, затем попробуй ещё раз.' };
  }
  if (/PHONE_NUMBER_BANNED|USER_DEACTIVATED|USER_DEACTIVATED_BAN/i.test(raw)) {
    return { status: 403, message: 'Telegram не разрешает вход для этого аккаунта. Проверь статус номера в официальном Telegram.' };
  }
  if (/PHONE_CODE_INVALID|PHONE_CODE_EMPTY/i.test(raw)) {
    return { status: 400, message: 'Код неверный. Введи последний код из официального Telegram.' };
  }
  if (/PHONE_CODE_EXPIRED|PHONE_CODE_HASH_EXPIRED|PHONE_CODE_HASH_INVALID/i.test(raw)) {
    return { status: 410, message: 'Код устарел. Вернись к номеру и запроси новый код.' };
  }
  if (/PASSWORD_HASH_INVALID|PASSWORD_INVALID/i.test(raw)) {
    return { status: 400, message: 'Неверный пароль двухэтапной проверки Telegram.' };
  }
  if (/SESSION_PASSWORD_NEEDED/i.test(raw)) {
    return { status: 409, message: 'Этот Telegram-аккаунт защищён паролем 2FA. Введи пароль в следующем шаге.' };
  }
  if (/AUTH_RESTART|AUTH_KEY_UNREGISTERED|SESSION_REVOKED|SESSION_EXPIRED/i.test(raw)) {
    return { status: 410, message: 'Сессия входа истекла. Начни подключение заново.' };
  }
  if (/TIMEOUT|timed out|ETIMEDOUT|fetch failed|ECONNRESET|network/i.test(raw)) {
    return { status: 503, message: 'Связь с Telegram временно нестабильна. Проверь интернет и повтори подключение.' };
  }
  return { status: 500, message: 'Telegram не подтвердил подключение. Попробуй ещё раз или используй QR со второго устройства.' };
}
