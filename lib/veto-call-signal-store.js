import {signStoryPilotRequest} from './viewer-sync-signing.js';

// Dedicated, isolated service: no changes to Stories/Ghost Privacy storage.
const SIGNAL_URL='https://xvtmgzzaomolnvkcgosk.supabase.co/functions/v1/veto-call-signal';
async function callSignalStore(op,args={}){
  const payload=signStoryPilotRequest({op,args});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(SIGNAL_URL,{
      method:'POST',
      headers:{'content-type':'application/json',
        'x-story-timestamp':payload.timestamp,
        'x-story-signature':payload.signature},
      body:payload.body,signal:controller.signal,
    });
    const body=await response.json().catch(()=>({}));
    if(response.ok&&body?.ok)return body.data;
    // Preserve only enumerated app error codes; never leak SDP, DB errors or tokens.
    const safeErrors=new Set(['call_room_limit','call_invite_unavailable','call_recipient_unavailable',
      'call_access_denied','call_bad_actor','call_bad_room','call_bad_invitation',
      'call_bad_description']);
    throw Error(safeErrors.has(body.error)?body.error:'call_store_unavailable');
  }finally{clearTimeout(timeout);}
}
export const probeCallStore=()=>callSignalStore('call_probe',{});
export const getCallPreferences=userId=>callSignalStore('call_preferences_get',{userId});
export const setCallPreferences=(userId,enabled)=>callSignalStore('call_preferences_set',{userId,enabled});
export const createCallRoom=(callerId,roomId,tokenHash,offerSdp,recipientId=null)=>
  callSignalStore('call_create',{callerId,roomId,tokenHash,offerSdp,recipientId});
export const inspectCallRoom=(userId,roomId,tokenHash)=>
  callSignalStore('call_inspect',{userId,roomId,tokenHash});
export const answerCallRoom=(userId,roomId,tokenHash,answerSdp)=>
  callSignalStore('call_answer',{userId,roomId,tokenHash,answerSdp});
export const pollCallRoom=(userId,roomId)=>
  callSignalStore('call_poll',{userId,roomId});
export const endCallRoom=(userId,roomId)=>
  callSignalStore('call_end',{userId,roomId});
