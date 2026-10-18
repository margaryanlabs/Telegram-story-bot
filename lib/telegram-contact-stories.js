// Read-only, owner-scoped normalization for Telegram's active contact stories.
// None of these helpers report a Story view or mutate Telegram read-state.
export const STEALTH_SAFETY_SECONDS = 90;
export const STORY_MEDIA_LIMIT_BYTES = 4 * 1024 * 1024;
export const STORY_MAX_PAGES = 6;

export const telegramId = value => String(value?.toString?.() ?? value ?? '');
export const validTelegramId = value => /^\d{1,22}$/.test(String(value ?? ''));
export const validStoryId = value => Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 && Number(value) <= 2147483647;

export function stealthStatus(raw, now = Math.floor(Date.now() / 1000)) {
  const until = Math.max(0, Number(raw?.activeUntilDate || 0));
  const cooldownUntil = Math.max(0, Number(raw?.cooldownUntilDate || 0));
  return {
    active: until > now + STEALTH_SAFETY_SECONDS,
    activeUntil: until || null,
    cooldownUntil: cooldownUntil || null,
    canActivate: cooldownUntil <= now,
  };
}

export function requireStealth(raw, now = Math.floor(Date.now() / 1000)) {
  const status = stealthStatus(raw, now);
  if (!status.active) {
    const error = new Error('STEALTH_NOT_CONFIRMED');
    error.code = 'STEALTH_NOT_CONFIRMED';
    error.cooldownUntil = status.cooldownUntil;
    throw error;
  }
  return status;
}

export function normalizeContactStories(result, now = Math.floor(Date.now() / 1000)) {
  const users = new Map((result?.users || []).map(user => [telegramId(user.id), user]));
  const peers = [];
  for (const entry of result?.peerStories || []) {
    const userId = telegramId(entry?.peer?.userId);
    const user = users.get(userId);
    // Only real Telegram contacts, never channels, bots, unrelated users or deleted peers.
    if (!validTelegramId(userId) || !user || !user.contact ||
        user.bot || user.deleted || user.self) continue;
    const stories = (entry.stories || []).filter(item => {
      const kind = String(item?.className || '');
      return validStoryId(item?.id) && !/Skipped|Deleted/i.test(kind) &&
        Number(item?.expireDate || 0) > now && item.media;
    }).map(item => ({
      id: Number(item.id), createdAt: Number(item.date || 0),
      expiresAt: Number(item.expireDate || 0),
      kind: item?.media?.document ? 'video' : 'photo',
      caption: String(item.caption || '').slice(0, 1000),
      closeFriends: Boolean(item.closeFriends),
    })).sort((a, b) => a.createdAt - b.createdAt);
    if (!stories.length) continue;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      String(user.username || 'Контакт Telegram');
    peers.push({
      userId, name: name.slice(0, 90), username: String(user.username || '').slice(0, 64),
      count: stories.length, stories,
    });
  }
  return peers.sort((a, b) =>
    (b.stories.at(-1)?.createdAt || 0) - (a.stories.at(-1)?.createdAt || 0));
}
