/** Build HTTPS Telegram WebApp link from an explicit canonical owner origin.
 * Never guess a Vercel domain or use untrusted request host headers.
 */
export function archiveWebAppUrl(configuredOrigin, chatId) {
 if(typeof configuredOrigin!=='string'||!configuredOrigin.trim())return null;
 try{
  const parsed=new URL(configuredOrigin.trim());
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||
    parsed.search||parsed.hash||parsed.pathname!=='/'||
    !parsed.hostname.includes('.')||parsed.hostname==='localhost'||
    parsed.port||!/^[a-z0-9.-]+$/i.test(parsed.hostname))return null;
  const chat=String(chatId||'');
  if(!/^-?\d{1,22}$/.test(chat))return null;
  const url=new URL('/studio.html',parsed.origin);
  url.searchParams.set('screen','chats');
  url.searchParams.set('chat',chat);
  url.searchParams.set('v','20261016-veto-smart-inbox-v1');
  return url.toString();
 }catch{return null;}
}
