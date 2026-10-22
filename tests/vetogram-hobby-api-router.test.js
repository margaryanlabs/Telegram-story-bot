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
  // A missing viewer-sync route silently makes every owner session look disconnected.
  assert.ok(router.includes('"viewer-sync": () => import("./viewer-sync.js")'));
  assert.ok(router.includes('"telegram-chats": () => import("./telegram-chats.js")'));
  assert.ok(router.includes('"telegram-stories": () => import("./telegram-stories.js")'));
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

test('all 33 routed handlers import and answer unauthenticated requests without external calls',async()=>{
  const {default:router}=await import('../api/router.js');
  const endpoints=readdirSync(new URL('../api/',import.meta.url)).filter(p=>p.endsWith('.js')&&p!=='router.js').map(p=>p.slice(0,-3));
  const previous=globalThis.fetch,token=process.env.TELEGRAM_BOT_TOKEN;let external=0;
  process.env.TELEGRAM_BOT_TOKEN='router-test-token';
  globalThis.fetch=async()=>{external++;throw Error('External calls are forbidden in router smoke test')};
  try {
    for(const route of endpoints){
      const req={method:'POST',headers:{},body:{},query:{route},url:'/api/router?route='+route};
      const res={headersSent:false,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;this.headersSent=true;return this},end(body){this.body=body;this.headersSent=true},write(){}};
      await router(req,res);
      assert.ok((res.code??res.statusCode)>=200&&(res.code??res.statusCode)<=599,route+' did not answer');
      assert.notEqual(res.body?.error,'Unknown API endpoint',route);
      assert.notEqual(res.body?.error,'Internal server error',route+' failed to load');
      assert.equal(req.url,'/api/'+route);
      assert.equal(req.query.route,undefined);
    }
    assert.ok(external<10,'unexpected outbound work in unauthenticated handlers');
  } finally {globalThis.fetch=previous;if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;}
});
