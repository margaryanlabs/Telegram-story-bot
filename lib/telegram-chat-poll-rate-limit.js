// V9: Telegram flood waits must survive poll retries and thread navigation.
// Never echo raw MTProto exceptions (which may contain sensitive data).
export function classifyTelegramPollRateLimit(error) {
  const raw=String(error?.errorMessage||error?.message||'');
  if(!/(?:FLOOD_WAIT|FLOOD_PREMIUM_WAIT|SLOWMODE_WAIT|TOO_MANY_REQUESTS|(?:^|\D)429(?:\D|$))/i.test(raw))
    return null;
  const match=raw.match(/(?:FLOOD_WAIT|FLOOD_PREMIUM_WAIT|SLOWMODE_WAIT)[_:\s]+(\d{1,6})/i);
  const retryAfterSeconds=match
    ? Math.min(86400,Math.max(30,Number(match[1])))
    : 120;
  return {
    retryAfterSeconds,
    error:'Telegram ограничил частоту обновления. Подождём перед следующим запросом.',
  };
}
