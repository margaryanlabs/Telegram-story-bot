import { sameTelegramAccount } from './telegram-session-owner.js';

// Do not rely solely on the account ID stored next to an encrypted MTProto
// session: the real authenticated user must match the signed Mini App owner.
// Call BEFORE retrieving dialogs, individual messages, avatars or media.
export async function verifyTelegramClientOwner(client, ownerId) {
  let me;
  try { me = await client.getMe(); }
  catch { const error = new Error('TELEGRAM_OWNER_UNVERIFIED'); error.code = 'TELEGRAM_OWNER_UNVERIFIED'; throw error; }
  if (!sameTelegramAccount(ownerId, me?.id)) {
    const error = new Error('TELEGRAM_OWNER_MISMATCH');
    error.code = 'TELEGRAM_OWNER_MISMATCH';
    throw error;
  }
  const name = [me.firstName, me.lastName].filter(Boolean).join(' ').slice(0, 85)
    || (me.username ? '@'+String(me.username).slice(0, 40) : 'Мой Telegram');
  return { name, username: me.username ? String(me.username).slice(0, 40) : null,
    verified: true };
}

export function telegramOwnerError(error) {
  if (error?.code === 'TELEGRAM_OWNER_MISMATCH') {
    return { status: 409, error: 'ОПАСНО: авторизован не тот Telegram-аккаунт. Доступ к перепискам заблокирован. Отключи эту сессию в настройках VETO и подключи свой аккаунт заново.' };
  }
  if (error?.code === 'TELEGRAM_OWNER_UNVERIFIED') {
    return { status: 503, error: 'Не удалось проверить владельца Telegram-сессии. Ради безопасности чаты не загружены. Повтори проверку.' };
  }
  return null;
}
