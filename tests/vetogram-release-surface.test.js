import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const publicModules=[
  'app.js','privacy.js','telegram-chats.js','telegram-stories.js',
  'studio-module.js','story-engine.js','vetogram-ai.js',
  'relay-module.js','voice-studio.js','vetogram-command-2026.js',
  'vetogram-mission-2026.js','vetogram-workflows-2026.js'
];

test('all direct API calls in shipped client modules are served by Hobby router',()=>{
  const router=read('api/router.js');
  const declared=[...router.matchAll(/"([a-z][a-z0-9-]+)":\s*\(\)\s*=>\s*import\("\.\/([a-z][a-z0-9-]+)\.js"\)/g)];
  const registered=new Set(declared.map(match=>match[1]));
  assert.ok(registered.size>=35,'unexpectedly small API router');
  assert.equal(registered.size,declared.length,'duplicate route keys');
  for(const match of declared){
    assert.equal(match[1],match[2],'route and imported handler must agree');
    assert.ok(existsSync(fileURLToPath(new URL('../api/'+match[2]+'.js',import.meta.url))),
      'Missing API module: '+match[2]);
  }
  const actual=new Set();
  for(const name of publicModules){
    for(const match of read('public/'+name).matchAll(/\/api\/([a-z][a-z0-9-]+)/g))
      actual.add(match[1]);
  }
  assert.ok(actual.size>=15,'scan likely incomplete');
  for(const endpoint of actual)
    assert.ok(registered.has(endpoint),'Undeployed public API endpoint: /api/'+endpoint);
  for(const mustExist of ['viewer-sync','business-wizard','telegram-chats',
    'telegram-send','telegram-stories','privacy','vetogram-ai',
    'vetogram-tasks','vetogram-reminders'])
    assert.ok(registered.has(mustExist),'Critical route removed: '+mustExist);
});

test('real Mini App HTML includes only locally existing static resources',()=>{
  const html=read('public/studio.html');
  const assetPaths=new Set([...html.matchAll(/(?:href|src)=["'](\/[^"'?#]+)(?:[?#][^"']*)?["']/g)]
    .map(match=>match[1]));
  assert.ok(assetPaths.size>=30,'asset inventory unexpectedly short');
  for(const asset of assetPaths) {
    assert.ok(/^\/[a-zA-Z0-9/_-]+\.(?:css|js|svg|png|webp|ico|woff2?)$/.test(asset),
      'Unexpected path from Mini App: '+asset);
    assert.ok(existsSync(fileURLToPath(new URL('../public'+asset,import.meta.url))),
      'Missing referenced static file: '+asset);
  }
  assert.ok(html.indexOf('/vetogram-finish-2026.css') >
    html.indexOf('/vetogram-experience-2026.css'),'Finishing CSS should load last');
});

test('Vercel builds exactly one server function and preserves API rewrite',()=>{
  const config=JSON.parse(read('vercel.json'));
  const functions=config.builds.filter(item=>item.use==='@vercel/node');
  assert.equal(functions.length,1,'Hobby requires one function only');
  assert.equal(functions[0].src,'api/router.js');
  assert.ok(config.builds.some(item=>item.src==='public/**'&&item.use==='@vercel/static'));
  const apiRoute=config.routes.find(item=>item.src==='^/api/([A-Za-z0-9-]+)$');
  assert.equal(apiRoute?.dest,'/api/router.js?route=$1');
  assert.equal(config.routes.at(-1)?.dest,'/public/$1');
});

test('UI navigation aliases retain Creator separately from Story Engine',()=>{
  const html=read('public/studio.html');
  const app=read('public/app.js');
  const nav=read('public/vetogram-command-2026.js');
  assert.match(app,/creator:\s*'studio'/);
  assert.match(app,/studio:\s*'story-engine'/);
  assert.match(html,/data-nav="studio"/);
  assert.match(html,/data-vg26-destination="creator"/);
  assert.match(nav,/studio\|creator\|story-engine/);
});
