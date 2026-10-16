// Every VETO Telegram Mini App login is owner-scoped. A code or QR scan from
// someone else's account must never produce a usable VETO session.
export function sameTelegramAccount(ownerId, accountId) {
  const expected = String(ownerId ?? '').trim();
  const actual = String(accountId ?? '').trim();
  return /^\d+$/.test(expected) && expected === actual;
}

export function requireOwnTelegramAccount(ownerId, account) {
  if (!sameTelegramAccount(ownerId, account?.id)) {
    const error = new Error('TELEGRAM_ACCOUNT_MISMATCH');
    error.code = 'TELEGRAM_ACCOUNT_MISMATCH';
    throw error;
  }
  return true;
}

export const TELEGRAM_OWNER_MESSAGE =
  'Аккаунты не совпадают. Открой VETO внутри своего Telegram и авторизуй тот же аккаунт через номер или QR. Чужой аккаунт подключить нельзя.';
