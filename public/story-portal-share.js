import {normalizePortal} from './story-engine-core.js';

// Public Portal = self-contained, *unsigned* share card. No owner's Telegram
// data, photo, chat history or private drafts enter the URL fragment.
// Fragments stay in the browser and are not sent to hosting servers.
export const PORTAL_SHARE_MAX_BYTES=3400;
export const PORTAL_SHARE_LIFETIME=30*86400000;
function base64url(bytes){
  let binary='';for(const x of bytes)binary+=String.fromCharCode(x);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64url(token){
  if(!/^[A-Za-z0-9_-]{1,5000}$/.test(token)||token.length%4===1)
    throw Error('PORTAL_LINK_INVALID');
  const binary=atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-token.length%4)%4));
  return Uint8Array.from(binary,x=>x.charCodeAt(0));
}
export function encodePublicPortal(portal,now=Date.now()){
  if(!Number.isFinite(now)||now<0)throw Error('PORTAL_LINK_INVALID_DATE');
  const safe=normalizePortal(portal);
  const doc={v:1,created:Math.floor(now),expires:Math.floor(now+PORTAL_SHARE_LIFETIME),portal:safe};
  const bytes=new TextEncoder().encode(JSON.stringify(doc));
  if(bytes.length>PORTAL_SHARE_MAX_BYTES)throw Error('PORTAL_LINK_TOO_LARGE');
  return 'p='+base64url(bytes);
}
export function decodePublicPortal(fragment,now=Date.now()){
  if(!Number.isFinite(now))throw Error('PORTAL_LINK_INVALID_DATE');
  const token=String(fragment||'').replace(/^#/,'');
  if(!/^p=[A-Za-z0-9_-]{1,5000}$/.test(token))throw Error('PORTAL_LINK_INVALID');
  let raw;
  try{
    const bytes=fromBase64url(token.slice(2));
    if(bytes.length>PORTAL_SHARE_MAX_BYTES)throw Error('PORTAL_LINK_TOO_LARGE');
    raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch(e){
    if(e.message==='PORTAL_LINK_TOO_LARGE')throw e;
    throw Error('PORTAL_LINK_INVALID');
  }
  if(raw?.v!==1 || !Number.isSafeInteger(raw.created) || !Number.isSafeInteger(raw.expires) ||
    raw.created<0 || raw.created>now+300000 ||
    raw.expires<=raw.created || raw.expires>raw.created+PORTAL_SHARE_LIFETIME)
    throw Error('PORTAL_LINK_INVALID');
  if(raw.expires<=now)throw Error('PORTAL_LINK_EXPIRED');
  return {portal:normalizePortal(raw.portal),expires:raw.expires,created:raw.created};
}
export function makePublicPortalUrl(portal,origin,now=Date.now()){
  const url=new URL('/portal.html',String(origin||''));
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&url.hostname==='localhost'))
    throw Error('PORTAL_HTTPS_ORIGIN_REQUIRED');
  if(url.username || url.password)throw Error('PORTAL_HTTPS_ORIGIN_REQUIRED');
  url.hash=encodePublicPortal(portal,now);
  return url.toString();
}
