import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Hobby adapter exposes every existing API endpoint via one function without changing handlers',()=>{
  const config=JSON.parse(read('vercel.json'));
  assert.equal(config.builds.filter(item=>item.use==='@vercel/node').length,1);
  assert.equal(config.builds[0].src,'api/router.js');
  assert.equal(config.functions,undefined);
  assert.ok(config.routes.some(route=>route.dest==='/api/router.js?route=$1'));
  const router=read('api/router.js');
  const endpoints=readdirSync(new URL('../api/',import.meta.url))
    .filter(path=>path.endsWith('.js')&&path!=='router.js')
    .map(path=>path.slice(0,-3));
  for(const endpoint of endpoints){
    assert.ok(router.includes(JSON.stringify(endpoint)+': () => import('),
      'missing endpoint '+endpoint);
    assert.ok(router.includes(JSON.stringify('./'+endpoint+'.js')),
      'missing handler '+endpoint);
  }
  assert.equal((router.match(/: \(\) => import\(/g)||[]).length,endpoints.length);
});
test('Hobby adapter preserves source request path and does not touch Telegram authentication',()=>{
  const router=read('api/router.js');
  assert.match(router,/req\.url = '\/api\/' \+ route/);
  assert.match(router,/Object\.prototype\.hasOwnProperty\.call\(endpointLoaders,route\)/);
  assert.doesNotMatch(router,/getViewerSession|TELEGRAM_BOT_TOKEN|business_connection_id|updateConnectedBot/i);
});
