// Explains independently verifiable Privacy readiness for this signed Telegram owner.
// No message text, session tokens, phone numbers or third-party identifiers leave this helper.
export function privacyReadiness(settings=null,business=null,archiveRows=[]){
  const enabled=Boolean(settings?.antiDelete && settings?.ghostInbox);
  const connected=Boolean(business?.isEnabled && business?.businessConnectionId);
  // Bot API can_read_messages means "mark a received Business message
  // as read", NOT "receive business_message updates". Do not require an
  // unnecessary mark-as-read privilege to archive opted-in chats.
  const markReadAllowed=Boolean(connected && business?.canReadMessages);
  const archived=Array.isArray(archiveRows)?archiveRows:[];
  const savedChats=archived.length;
  const savedMessages=archived.reduce((n,row)=>n+Math.max(0,Number(row.messageCount||0)),0);
  const deleted=archived.reduce((n,row)=>n+Math.max(0,Number(row.deletedCount||0)),0);
  const retentionDays=Number.isFinite(Number(settings?.retentionDays))
    ?Math.max(1,Math.min(3650,Math.floor(Number(settings.retentionDays)))):null;
  // A connected but unverified Business bot or merely enabled switches are not a
  // guarantee that Telegram will deliver delete notifications for every chat.
  const ready=enabled&&connected;
  const nextAction=!settings?'unavailable'
    :!enabled?'enable_privacy'
      :!connected?'connect_business'
      :'test_archive';
  return {ready,antiDelete:Boolean(settings?.antiDelete),
    privateArchive:Boolean(settings?.ghostInbox),businessConnected:connected,
    readMessagesAllowed:markReadAllowed,markReadAllowed,retentionDays,savedChats,savedMessages,
    confirmedDeleted:deleted,nextAction};
}

// A small, deterministic heuristic for the user's *already loaded* dialog
// previews. This is not an AI model, predictive analytics, or automated sending.
// It never changes Telegram read/unread flags or accesses more messages.
export function inboxSignals(chat={}){
  const preview=String(chat.preview||'').slice(0,260);
  const text=preview.toLocaleLowerCase();
  const unread=Math.min(9999,Math.max(0,Number(chat.unreadCount||0)));
  const question=/\?|\b(can you|could you|please confirm|when can|are you|do you)\b|(?:можешь|сможешь|когда|ответь|вопрос|подскажи|нужно\s+ли|что\s+думаешь|հարց)/iu.test(text);
  const action=/(?:срочно|сегодня|завтра|крайний срок|до\s+вечера|срок|дедлайн|перезвони|оплатить|сч[её]т|договор|urgent|asap|today|tomorrow|deadline|invoice|payment|պայմանագիր)/iu.test(text);
  const score=(unread>0?20+Math.min(20,unread*2):0)+(question?18:0)
    +(action?25:0)+(chat.pinned?5:0);
  return {score,question,action,needsAttention:unread>0&&(question||action),
    unread};
}
