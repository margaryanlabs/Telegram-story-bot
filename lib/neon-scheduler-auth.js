import crypto from 'node:crypto';
import { selectedStorageProvider } from './storage-provider.js';

// Cron relay authorization is server-only and active exclusively on Neon.
export function neonCronAuthorized(req) {
 if(selectedStorageProvider()!=='neon')return false;
 const secret=String(process.env.CRON_SECRET||'');
 const got=String(req.headers?.authorization||'');
 if(secret.length<32||!got.startsWith('Bearer '))return false;
 const actual=Buffer.from(got.slice(7),'utf8'),expected=Buffer.from(secret,'utf8');
 return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
}
