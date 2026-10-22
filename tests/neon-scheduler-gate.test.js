import test from 'node:test';
import assert from 'node:assert/strict';
import {neonCronAuthorized} from '../lib/neon-scheduler-auth.js';

test('Neon cron fails closed until provider, explicit enable flag and long secret all match',()=>{
  const keys=['VETO_STORAGE_PROVIDER','VETO_NEON_CRON_ENABLED','CRON_SECRET'];
  const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    process.env.VETO_STORAGE_PROVIDER='neon';
    process.env.CRON_SECRET='e'.repeat(48);
    const req={headers:{authorization:'Bearer '+process.env.CRON_SECRET}};
    delete process.env.VETO_NEON_CRON_ENABLED;
    assert.equal(neonCronAuthorized(req),false);
    process.env.VETO_NEON_CRON_ENABLED='true';
    assert.equal(neonCronAuthorized(req),true);
    assert.equal(neonCronAuthorized({headers:{authorization:'Bearer wrong'}}),false);
    process.env.VETO_STORAGE_PROVIDER='supabase';
    assert.equal(neonCronAuthorized(req),false);
  } finally {
    for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
  }
});
