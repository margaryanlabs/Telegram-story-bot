/* Pure offline guard: it must block missing assets and privacy regressions.
 * No paid CI, network, database or Telegram APIs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {inspectReleaseSurface} from '../scripts/vetogram-release-surface-check.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const read=path=>readFileSync(join(root,path),'utf8');
const actual=()=>({
  html:read('public/studio.html'),
  app:read('public/app.js'),
  story:read('public/story-engine.js'),
  ai:read('public/vetogram-ai.js'),
  exists:relative=>existsSync(join(root,relative)),
  readSource:relative=>readFileSync(join(root,relative),'utf8')
});
const check=change=>inspectReleaseSurface({...actual(),...change});

test('the real release entrypoint has valid local assets, routes and signed Story flow',()=>{
  const status=check();
  assert.deepEqual(status.errors,[]);
  assert.equal(status.ok,true);
  assert.ok(status.counts.uniqueDomIds>=100);
  assert.ok(status.counts.localAssets>=20);
  assert.ok(status.counts.screens>=10);
});
test('missing actual CSS/JS file is a release blocker',()=>{
  const status=check({exists:()=>false});
  assert.equal(status.ok,false);
  assert.ok(status.errors.some(error=>error.startsWith('MISSING_ASSET: ')));
});
test('duplicate DOM IDs are blocked before mobile QA',()=>{
  const original=actual();
  const status=check({html:original.html.replace(
    '</body>','<div id="storyPortalConfirm"></div></body>'
  )});
  assert.ok(status.errors.some(error=>error.startsWith('DUPLICATE_DOM_IDS:')));
});
test('a prechecked public Portal checkbox is a release blocker',()=>{
  const original=actual();
  const changed=original.html.replace(
    'id="storyPortalConfirm" type="checkbox" />',
    'id="storyPortalConfirm" type="checkbox" checked />'
  );
  assert.notEqual(changed,original.html);
  const status=check({html:changed});
  assert.ok(status.errors.includes('PORTAL_MUST_REQUIRE_FRESH_OPT_IN'));
});
test('loading dependent Story controller before app.js is blocked',()=>{
  const original=actual();
  const first='/app.js?v=20261026-v4-8';
  const dependent='/story-engine.js?v=20261025-v4-6';
  assert.ok(original.html.includes(first)&&original.html.includes(dependent));
  const status=check({html:original.html.replaceAll(first,'TEST_SWAP')
    .replaceAll(dependent,first).replaceAll('TEST_SWAP',dependent)});
  assert.ok(status.errors.includes('WRONG_BOOTSTRAP_ORDER: /story-engine.js'));
});
test('missing signed AI→Story or owner epoch invalidation must block release',()=>{
  const original=actual();
  const unsafeStory=original.story.replace(
    "const requestedSigned=String(requested?.signed||'');",
    "const requestedSigned='';"
  );
  assert.notEqual(unsafeStory,original.story);
  const storyResult=check({story:unsafeStory});
  assert.ok(storyResult.errors.includes('MISSING_SIGNED_AI_STORY_HANDOFF'));
  const unsafeApp=original.app.replace('viewerOwnerEpoch++;','// owner epoch disabled');
  assert.notEqual(unsafeApp,original.app);
  const appResult=check({app:unsafeApp});
  assert.ok(appResult.errors.includes('MISSING_OWNER_EPOCH_INVALIDATION'));
});

test('a missing imported module breaks the offline release gate',()=>{
  const safe=actual();
  const result=check({readSource:path=>{
    const text=safe.readSource(path);
    return path==='public/story-engine.js'
      ?text+"\nimport './this-script-must-not-exist.js';"
      :text;
  }});
  assert.ok(result.errors.some(error=>error.startsWith(
    'MISSING_MODULE_IMPORT: public/story-engine.js -> public/this-script-must-not-exist.js'
  )));
});
test('a module imported from a classic script is rejected',()=>{
  const safe=actual();
  const result=check({readSource:path=>{
    const text=safe.readSource(path);
    return path==='public/app.js'?text+"\nimport './story-engine-core.js';":text;
  }});
  assert.ok(result.errors.includes('UNDECLARED_MODULE_SCRIPT: public/app.js'));
});

test('Portal opt-in cannot be smuggled via reordered HTML attributes',()=>{
  const original=actual();
  const tag='<input id="storyPortalConfirm" type="checkbox" />';
  assert.ok(original.html.includes(tag));
  for(const attack of [
    '<input checked id="storyPortalConfirm" type="checkbox" />',
    '<input checked="false" type="checkbox" id="storyPortalConfirm" />',
    '<input type="checkbox" id="storyPortalConfirm" checked />',
    '<input checked="checked" id="storyPortalConfirm" type="checkbox" />'
  ]){
    const result=check({html:original.html.replace(tag,attack)});
    assert.ok(result.errors.includes('PORTAL_MUST_REQUIRE_FRESH_OPT_IN'),attack);
  }
});
