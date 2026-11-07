// Authentication-only deep links must never point at visual-review hosts.
export function vetogramAppUrl({screen='chats',chatId=null,filter=null}={}) {
  const configured=String(process.env.VETOGRAM_APP_URL||process.env.STORY_PILOT_BASE_URL||'').trim();
  if(!configured)return null;
  try {
    const url=new URL(configured);
    if(url.protocol!=='https:'||url.username||url.password)return null;
    url.pathname='/studio.html';url.search='';url.hash='';
    url.searchParams.set('screen',screen);
    if(chatId!==null)url.searchParams.set('chat',String(chatId));
    if(filter)url.searchParams.set('filter',String(filter));
    return url.toString();
  } catch {return null;}
}
