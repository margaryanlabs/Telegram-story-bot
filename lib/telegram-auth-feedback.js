// Stable, privacy-safe support code. Never expose raw Telegram errors,
// credentials, phone numbers, email addresses or one-time codes.
export function safeTelegramAuthReason(error) {
  const raw = String(error?.errorMessage || error?.message || error || '');
  if (/FLOOD_WAIT|PHONE_NUMBER_FLOOD|PHONE_PASSWORD_FLOOD/i.test(raw)) return 'RATE_LIMIT';
  if (/SMS_CODE_CREATE_FAILED|SMS_SEND_FAILED|PHONE_CODE_DELIVERY_FAILED/i.test(raw)) return 'DELIVERY_UNAVAILABLE';
  if (/API_ID_INVALID|API_ID_PUBLISHED_FLOOD|TELEGRAM_API_ID/i.test(raw)) return 'APP_CONFIGURATION';
  if (/EMAIL_CODE_INVALID|EMAIL_CODE_EXPIRED|EMAIL_INVALID|EMAIL_UNCONFIRMED/i.test(raw)) return 'EMAIL_VERIFICATION';
  if (/TELEGRAM_EMAIL_NEXT_STEP_UNSUPPORTED|TELEGRAM_CODE_HASH_MISSING/i.test(raw)) return 'UNSUPPORTED_TELEGRAM_STEP';
  if (/UPDATE_APP_TO_LOGIN|PHONE_NUMBER_APP_SIGNUP_FORBIDDEN/i.test(raw)) return 'APP_LOGIN_RESTRICTED';
  if (/PHONE_NUMBER_INVALID|PHONE_NUMBER_UNOCCUPIED/i.test(raw)) return 'PHONE_INVALID';
  if (/TIMEOUT|timed out|ETIMEDOUT|network|ECONNRESET|fetch failed/i.test(raw)) return 'CONNECTIVITY';
  if (/Viewer Sync store|PRIVATE_SESSION_CRYPTO|encryption/i.test(raw)) return 'STORAGE';
  return 'UNCLASSIFIED';
}

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
  if (/PHONE_NUMBER_FLOOD|PHONE_PASSWORD_FLOOD/i.test(raw)) {
    return { status: 429, message: 'Telegram ограничил отправку кодов для этого номера. Не запрашивай код повторно много раз. Подожди, проверь официальный Telegram и попробуй QR-вход со своего аккаунта.' };
  }
  if (/SMS_CODE_CREATE_FAILED|SMS_SEND_FAILED|PHONE_CODE_DELIVERY_FAILED/i.test(raw)) {
    return { status: 503, message: 'Telegram не смог отправить SMS для этого способа входа. Для сторонних Mini App SMS может быть недоступен. Проверь официальный чат Telegram или почту входа и попробуй QR со второго устройства.' };
  }
  if (/UPDATE_APP_TO_LOGIN/i.test(raw)) {
    return { status: 409, message: 'Telegram требует вход через обновлённое официальное приложение. Обнови Telegram и используй QR-вход VETO со второго устройства.' };
  }
  if (/PHONE_NUMBER_APP_SIGNUP_FORBIDDEN/i.test(raw)) {
    return { status: 403, message: 'Новый Telegram-аккаунт нельзя создать через VETO. Сначала зарегистрируй свой номер в официальном Telegram, затем подключи его.' };
  }
  if (/API_ID_PUBLISHED_FLOOD|API_ID_INVALID/i.test(raw)) {
    return { status: 503, message: 'Telegram отклонил настройки авторизации приложения VETO. Это проблема сервера, повторно запрашивать код не нужно.' };
  }
  if (/EMAIL_CODE_INVALID|EMAIL_CODE_EMPTY/i.test(raw)) {
    return { status: 400, message: 'Код из письма Telegram неверный. Проверь последнее письмо.' };
  }
  if (/EMAIL_CODE_EXPIRED|EMAIL_HASH_EXPIRED/i.test(raw)) {
    return { status: 410, message: 'Срок email-подтверждения истёк. Начни подключение заново.' };
  }
  if (/EMAIL_INVALID|EMAIL_UNCONFIRMED/i.test(raw)) {
    return { status: 400, message: 'Telegram отклонил адрес email. Проверь адрес и попробуй снова.' };
  }
  if (/TELEGRAM_EMAIL_NEXT_STEP_UNSUPPORTED|TELEGRAM_CODE_HASH_MISSING/i.test(raw)) {
    return { status: 409, message: 'Telegram запросил дополнительный шаг входа. Попробуй QR со второго устройства.' };
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
