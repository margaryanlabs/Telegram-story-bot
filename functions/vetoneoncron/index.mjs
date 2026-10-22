// Neon scheduled trigger relay for VetoTG.
// Disabled until end-to-end authorization, inbox and vault checks pass.
// Trigger authenticity: Neon removes spoofed X-Neon-* request headers.
const ROUTES={
 '/watch':{target:'/api/viewer-watch',method:'GET'},
 '/automation':{target:'/api/automation-run',method:'POST'},
 '/backup':{target:'/api/privacy-backup-worker',method:'POST'},
 '/cleanup':{target:'/api/neon-maintenance',method:'POST'},
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
export default {
 async fetch(request){
  const pathname=new URL(request.url).pathname;
  if(request.method!=='POST'||!Object.hasOwn(ROUTES,pathname))
   return json({ok:false,error:'unsupported_trigger_route'},404);
  if(!request.headers.get('x-neon-trigger-invocation-id'))
   return json({ok:false,error:'neon_trigger_required'},403);
  if(process.env.VETO_NEON_CRON_ENABLED!=='true')
   return json({ok:false,skipped:true,reason:'cron_release_gate_disabled'});
  const secret=String(process.env.VETO_NEON_CRON_SECRET||'');
  const base=String(process.env.VETO_NEON_CRON_TARGET||'').replace(/\/$/,'');
  if(secret.length<32||!/^https:\/\/[a-z0-9.-]+\.vercel\.app$/.test(base))
   return json({ok:false,error:'cron_target_not_configured'},503);
  const route=ROUTES[pathname],ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),45000);
  try{
   const response=await fetch(base+route.target,{
    method:route.method,headers:{authorization:'Bearer '+secret,
     ...(route.method==='POST'?{'content-type':'application/json'}:{})},
    ...(route.method==='POST'?{body:'{}'}:{}),signal:ctrl.signal,
   });
   return json({ok:response.ok,httpStatus:response.status,target:route.target,
    scheduledAt:new Date().toISOString()},response.ok?200:503);
  }catch{return json({ok:false,error:'relay_unavailable'},503)}
  finally{clearTimeout(timeout)}
 }
};
