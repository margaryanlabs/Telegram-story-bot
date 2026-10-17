// Dedicated VETO Calls signaling Edge Function.
// Does NOT modify Telegram Stories, Ghost Privacy, existing store RPC or sessions.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.58.0";
import nacl from "npm:tweetnacl@1.0.3";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const VERCEL_PUBLIC_KEY="FvnaVTxBDvxvK5wFkIxBw_Y_2XxotSphSsh9qh3xfGY";
const MAX_SKEW_MS=120000;
const db=createClient(SUPABASE_URL,SERVICE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},
});
function json(value: unknown,status=200){
  return new Response(JSON.stringify(value),{
    status,headers:{"content-type":"application/json; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff"},
  });
}
function b64url(value: string){
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const raw=atob(padded);
  return Uint8Array.from(raw,x=>x.charCodeAt(0));
}
function verifySignedRequest(request: Request,rawBody: string){
  const timestamp=request.headers.get("x-story-timestamp")??"";
  const signature=request.headers.get("x-story-signature")??"";
  const ts=Number(timestamp);
  if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>MAX_SKEW_MS)
    throw new Error("invalid_signature");
  const publicKey=b64url(VERCEL_PUBLIC_KEY);
  const signatureBytes=b64url(signature);
  if(publicKey.length!==32||signatureBytes.length!==64)
    throw new Error("invalid_signature");
  const payload=new TextEncoder().encode(`${timestamp}.${rawBody}`);
  if(!nacl.sign.detached.verify(payload,signatureBytes,publicKey))
    throw new Error("invalid_signature");
}

// A VETO call room contains only ephemeral offer/answer SDP. SDP may reveal
// network information, so never include it in logs or permit browser Data API
// reads. The server-proven Telegram identity is supplied by signed Vercel only.
function callId(value: unknown) {
  const id=String(value??'');
  if (!/^\d{1,20}$/.test(id) || id==='0') throw new Error('call_bad_actor');
  return id;
}
function callRoom(value: unknown) {
  const room=String(value??'');
  if (!/^[a-f0-9]{32}$/.test(room)) throw new Error('call_bad_room');
  return room;
}
function callHash(value: unknown) {
  const hash=String(value??'');
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('call_bad_invitation');
  return hash;
}
function callSdp(value: unknown) {
  const sdp=String(value??'');
  if(sdp.length<50||sdp.length>30000||!sdp.startsWith('v=0\r\n'))
    throw new Error('call_bad_description');
  return sdp;
}
async function opCallGetPreferences(args:any){
  const actor=callId(args.userId);
  const {data,error}=await db.from('story_pilot_call_optins')
    .select('notifications_enabled').eq('telegram_user_id',actor).maybeSingle();
  if(error)throw error;
  return {notificationsEnabled:data?.notifications_enabled===true};
}
async function opCallSetPreferences(args:any){
  const actor=callId(args.userId);
  if(typeof args.enabled!=='boolean')throw new Error('call_bad_preference');
  const {error}=await db.from('story_pilot_call_optins').upsert({
    telegram_user_id:actor,notifications_enabled:args.enabled,
    updated_at:new Date().toISOString(),
  },{onConflict:'telegram_user_id'});
  if(error)throw error;
  return {notificationsEnabled:args.enabled};
}
// Claims one alert slot only for an explicitly opted-in account.
// Atomic conditional UPDATE keeps concurrent callers from flooding a recipient.
async function claimRecipientSlot(recipient:string,now:Date){
  const earliest=new Date(now.getTime()-3*60*1000).toISOString();
  const {data,error}=await db.from('story_pilot_call_optins')
    .update({last_alert_at:now.toISOString(),updated_at:now.toISOString()})
    .eq('telegram_user_id',recipient).eq('notifications_enabled',true)
    .or('last_alert_at.is.null,last_alert_at.lt.'+earliest)
    .select('telegram_user_id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('call_recipient_unavailable');
}

async function opCallCreate(args: any){
  const caller=callId(args.callerId),room=callRoom(args.roomId),hash=callHash(args.tokenHash);
  const sdp=callSdp(args.offerSdp);
  const recipient=args.recipientId==null?null:callId(args.recipientId);
  if(recipient===caller)throw new Error('call_bad_recipient');
  const now=new Date(),expires=new Date(now.getTime()+8*60*1000);
  const {count,error:counterError}=await db.from('story_pilot_call_rooms')
    .select('room_id',{count:'exact',head:true}).eq('caller_id',caller)
    .gt('expires_at',now.toISOString());
  if(counterError)throw counterError;
  if(Number(count||0)>=3)throw new Error('call_room_limit');
  if(recipient)await claimRecipientSlot(recipient,now);
  const {error}=await db.from('story_pilot_call_rooms').insert({
    room_id:room,invite_hash:hash,caller_id:caller,recipient_id:recipient,offer_sdp:sdp,status:'offered',
    created_at:now.toISOString(),expires_at:expires.toISOString(),
  });
  if(error){
    // Idempotent only when retried with the exact same caller and invitation.
    if(error.code==='23505'){
      const {data:existing}=await db.from('story_pilot_call_rooms')
        .select('room_id,caller_id').eq('room_id',room).eq('caller_id',caller)
        .eq('invite_hash',hash).maybeSingle();
      if(existing)return {roomId:room,expiresAt:expires.toISOString()};
    }
    throw error;
  }
  return {roomId:room,expiresAt:expires.toISOString()};
}
async function opCallInspect(args: any){
  const room=callRoom(args.roomId),hash=callHash(args.tokenHash),actor=callId(args.userId);
  const {data,error}=await db.from('story_pilot_call_rooms')
    .select('room_id,caller_id,callee_id,recipient_id,status,offer_sdp,expires_at')
    .eq('room_id',room).eq('invite_hash',hash)
    .gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error)throw error;
  if(!data||String(data.caller_id)===actor||data.status!=='offered'||data.callee_id||
    (data.recipient_id&&String(data.recipient_id)!==actor))
    throw new Error('call_invite_unavailable');
  return {roomId:room,callerId:String(data.caller_id),offerSdp:data.offer_sdp,
    expiresAt:data.expires_at};
}
async function opCallAnswer(args: any){
  const room=callRoom(args.roomId),hash=callHash(args.tokenHash),actor=callId(args.userId);
  const sdp=callSdp(args.answerSdp);
  const {data,error}=await db.from('story_pilot_call_rooms')
    .update({callee_id:actor,answer_sdp:sdp,status:'answered'})
    .eq('room_id',room).eq('invite_hash',hash)
    .eq('status','offered').is('callee_id',null)
    .neq('caller_id',actor)
    .or('recipient_id.is.null,recipient_id.eq.'+actor)
    .gt('expires_at',new Date().toISOString())
    .select('room_id,caller_id,callee_id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('call_invite_unavailable');
  return {roomId:room,callerId:String(data.caller_id),calleeId:actor,status:'answered'};
}
async function opCallPoll(args: any){
  const room=callRoom(args.roomId),actor=callId(args.userId);
  const {data,error}=await db.from('story_pilot_call_rooms')
    .select('caller_id,callee_id,answer_sdp,status,expires_at')
    .eq('room_id',room).eq('caller_id',actor).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('call_invite_unavailable');
  if(new Date(data.expires_at).getTime()<Date.now())return {status:'expired'};
  return data.status==='answered'&&data.answer_sdp
    ?{status:'answered',answerSdp:data.answer_sdp,calleeId:String(data.callee_id)}
    :{status:'offered'};
}
async function opCallEnd(args: any){
  const room=callRoom(args.roomId),actor=callId(args.userId);
  const {data,error}=await db.from('story_pilot_call_rooms')
    .select('caller_id,callee_id').eq('room_id',room).maybeSingle();
  if(error)throw error;
  if(!data)return {closed:true};
  if(String(data.caller_id)!==actor&&String(data.callee_id||'')!==actor)
    throw new Error('call_access_denied');
  const {error:deleteError}=await db.from('story_pilot_call_rooms').delete().eq('room_id',room);
  if(deleteError)throw deleteError;
  return {closed:true};
}


// Signed, read-only health proof for the *actual* call signaling database.
// This performs a bounded private table query; returns no room/user/SDP data.
async function opCallProbe(_args:any){
  const {error}=await db.from('story_pilot_call_rooms')
    .select('room_id',{head:true,count:'exact'}).limit(1);
  if(error)throw new Error('call_store_unavailable');
  return {signaling:'ready',database:'ready',retentionMinutes:8};
}

const operations:Record<string,(args:any)=>Promise<any>>={
  call_probe:opCallProbe,
  call_preferences_get:opCallGetPreferences,
  call_preferences_set:opCallSetPreferences,
  call_create:opCallCreate,
  call_inspect:opCallInspect,
  call_answer:opCallAnswer,
  call_poll:opCallPoll,
  call_end:opCallEnd,
};
Deno.serve(async request=>{
  if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  if(!SUPABASE_URL||!SERVICE_KEY)return json({ok:false,error:"not_configured"},503);
  try{
    const raw=await request.text();
    if(raw.length>65000)throw new Error("invalid_request");
    verifySignedRequest(request,raw);
    const input=JSON.parse(raw||"{}");
    const op=String(input?.op??"");
    const fn=Object.hasOwn(operations,op)?operations[op]:null;
    if(!fn)throw new Error("invalid_operation");
    const data=await fn(input.args??{});
    return json({ok:true,data});
  }catch(error){
    const msg=error instanceof Error?error.message:"unknown";
    const status=msg==="invalid_signature"?401:
      msg==="call_room_limit"?429:
      msg==="call_invite_unavailable"?410:
      msg==="call_access_denied"?403:
      msg==="call_recipient_unavailable"?410:
      /^(invalid_|call_bad_)/.test(msg)?400:503;
    // No SDP, invite code, Telegram token, DB connection, message text, or owner
    // identifiers in logs. Only short error codes to support health metrics.
    const safe=/^(invalid_|call_bad_|call_invite_unavailable|call_room_limit|call_access_denied|call_recipient_unavailable)/.test(msg)
      ?msg:"call_store_unavailable";
    return json({ok:false,error:safe},status);
  }
});
