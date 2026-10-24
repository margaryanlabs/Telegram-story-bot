// Bot API getBusinessConnection validates the connection owner, not delivery.
// user_chat_id is the chat ID with that user, NOT the Telegram account user.id.
// Bot API docs deliberately define them as distinct properties.
export function businessConnectionReadiness(ownerId,requestedConnectionId,connection){
  const expectedOwner=String(ownerId||''),expectedConnection=String(requestedConnectionId||'');
  const validOwner=/^[1-9]\d{0,19}$/.test(expectedOwner);
  const validConnection=expectedConnection.length>0 && expectedConnection.length<=256;
  const match=validOwner&&validConnection&&connection&&typeof connection==='object'&&
    String(connection.id||'')===expectedConnection&&
    String(connection.user?.id||'')===expectedOwner&&
    Number.isSafeInteger(connection.user_chat_id)&&connection.user_chat_id>0&&
    typeof connection.is_enabled==='boolean';
  if(!match)return {botApi:'not-verified',serverState:'not-verified',
    storiesPermission:'unknown',messageEventsProven:false};
  if(!connection.is_enabled)return {botApi:'disabled',serverState:'verified',
    storiesPermission:'not-granted',messageEventsProven:false};
  const rights=connection.rights;
  return {botApi:'verified',serverState:'verified',
    storiesPermission:rights?.can_manage_stories===true?'granted':
      rights&&typeof rights==='object'?'not-granted':'unknown',
    messageEventsProven:false};
}
