import { neonCronAuthorized } from '../lib/neon-scheduler-auth.js';
import { cleanupPrivacyRetentionGlobal } from '../lib/viewer-sync-store.js';

// Internal-only: private media and message retention under per-user consent.
// Disabled until Neon cron relay is explicitly enabled after end-to-end tests.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
 if(!neonCronAuthorized(req))return res.status(401).json({ok:false,error:'Unauthorized'});
 try{
  const result=await cleanupPrivacyRetentionGlobal();
  return res.status(200).json({ok:true,users:Number(result?.users||0)});
 }catch(error){
  console.warn('Neon retention failed',error?.name||'error');
  return res.status(503).json({ok:false,error:'Retention temporarily unavailable'});
 }
}
