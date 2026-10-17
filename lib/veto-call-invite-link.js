// Short-lived VETO Calls main Mini App invitation links.
// A link is a bearer capability: anyone holding it can try to claim the room
// until it expires/has been claimed. Do not send it to broad or public chats.
import {parseCallInvite} from './veto-call-signals.js';

const PARAM_PATTERN=/^vc_([A-Za-z0-9_-]{54})$/;
const NAME_PATTERN=/^[A-Za-z0-9_]{5,32}$/;

export function inviteToStartParam(invite){
  const parsed=parseCallInvite(invite);
  const [roomId,secret]=String(invite).trim().slice(7).split('.');
  if(parsed.roomId!==roomId)throw Error('INVALID_INVITE');
  const param='vc_'+Buffer.from(roomId+secret,'hex').toString('base64url');
  if(!PARAM_PATTERN.test(param))throw Error('INVALID_START_PARAM');
  return param;
}
export function startParamToInvite(param){
  const raw=String(param||'').trim();
  if(!PARAM_PATTERN.test(raw))throw Error('INVALID_START_PARAM');
  const bytes=Buffer.from(raw.slice(3),'base64url');
  if(bytes.length!==40 || bytes.toString('base64url')!==raw.slice(3))
    throw Error('INVALID_START_PARAM');
  const hex=bytes.toString('hex');
  const invite=`VETOR1:${hex.slice(0,32)}.${hex.slice(32)}`;
  parseCallInvite(invite);
  return invite;
}
export function makeCallInviteUrl(botUsername,invite){
  const bot=String(botUsername||'').replace(/^@/,'');
  if(!NAME_PATTERN.test(bot))throw Error('INVALID_BOT_USERNAME');
  const url=new URL(`https://t.me/${bot}`);
  url.searchParams.set('startapp',inviteToStartParam(invite));
  return url.toString();
}
