import crypto from 'node:crypto';

// Coturn REST API (RFC-style TURN temporary credentials):
// username = expiresUnixSeconds:randomSessionId
// credential = base64(HMAC-SHA1(sharedSecret, username))
// TURN credentials are ephemeral, never logged or sent without Telegram auth.
export const VETO_STUN={urls:'stun:stun.l.google.com:19302'};
const MAX_URLS=3;
const TURN_TTL_SECONDS=2*60*60; // enough for a bounded long conversation

export function parseTurnUrls(value){
  const list=String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!list.length||list.length>MAX_URLS)return [];
  // Valid WebRTC TURN URL (no URL userinfo/password, no query except transport).
  const valid=/^turns?:[a-zA-Z0-9.-]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/;
  if(list.some(url=>url.length>160||!valid.test(url)))return [];
  return [...new Set(list)];
}
export function createIceConfig({secret='',turnUrls='',now=Date.now(),randomId}={}){
  const urls=parseTurnUrls(turnUrls);
  const server={iceServers:[VETO_STUN],relayConfigured:false};
  if(!secret||secret.length<24||!urls.length)return server;
  const expiresAt=Math.floor(now/1000)+TURN_TTL_SECONDS;
  const sessionId=randomId||crypto.randomBytes(10).toString('hex');
  if(!/^[a-f0-9]{20}$/.test(sessionId))throw Error('INVALID_TURN_SESSION');
  const username=expiresAt+':'+sessionId;
  const credential=crypto.createHmac('sha1',secret).update(username).digest('base64');
  return {iceServers:[VETO_STUN,{urls,username,credential}],relayConfigured:true,
    credentialsExpireAt:new Date(expiresAt*1000).toISOString()};
}
