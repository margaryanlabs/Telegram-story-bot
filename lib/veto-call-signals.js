import crypto from 'node:crypto';

// Short invite contains NO raw SDP, message text, Telegram session or recipient ID.
// Sending the invite is an explicit capability grant to one Telegram-verified user.
export const CALL_TTL_MS=8*60*1000;
const ROOM_PATTERN=/^[a-f0-9]{32}$/;
const SECRET_PATTERN=/^[a-f0-9]{48}$/;
const SDP_LIMIT=30_000;

export function newCallInvite(){
  const roomId=crypto.randomBytes(16).toString('hex');
  const secret=crypto.randomBytes(24).toString('hex');
  return {roomId,secret,invite:`VETOR1:${roomId}.${secret}`,tokenHash:callInviteHash(secret)};
}
export function callInviteHash(secret){
  if(!SECRET_PATTERN.test(String(secret||'')))throw new Error('INVALID_INVITE_SECRET');
  return crypto.createHash('sha256').update(secret).digest('hex');
}
export function parseCallInvite(raw){
  const text=String(raw||'').trim();
  const match=/^VETOR1:([a-f0-9]{32})\.([a-f0-9]{48})$/.exec(text);
  if(!match)throw new Error('INVALID_INVITE');
  return {roomId:match[1],tokenHash:callInviteHash(match[2])};
}
export function checkCallRoom(roomId){
  if(!ROOM_PATTERN.test(String(roomId||'')))throw new Error('INVALID_ROOM');
  return roomId;
}
export function checkCallDescription(value,type){
  const sdp=String(value||'');
  if(sdp.length<50||sdp.length>SDP_LIMIT||!sdp.startsWith('v=0\r\n')||
    !['offer','answer'].includes(type))
    throw new Error('INVALID_SDP');
  // SDP type is supplied as an explicit call action. Reject obviously malformed
  // copy-paste or HTML. WebRTC setRemoteDescription performs final protocol check.
  if(/[<>\u0000]/.test(sdp))throw new Error('INVALID_SDP');
  return sdp;
}
