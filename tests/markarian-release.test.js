import test from 'node:test';
import assert from 'node:assert/strict';
import {vetogramStagingMarker} from '../lib/markarian-release.js';
test('never publishes build identity without staging-only enablement',()=>{
 for(const env of [{},{MARKARIAN_RELEASE_ENABLED:'staging-only'},
  {MARKARIAN_RELEASE_ENABLED:'production',MARKARIAN_ENVIRONMENT:'staging',MARKARIAN_SOURCE_SHA:'a'.repeat(40)},
  {MARKARIAN_RELEASE_ENABLED:'staging-only',MARKARIAN_ENVIRONMENT:'production',MARKARIAN_SOURCE_SHA:'a'.repeat(40)},
  {MARKARIAN_RELEASE_ENABLED:'staging-only',MARKARIAN_ENVIRONMENT:'staging',MARKARIAN_SOURCE_SHA:'main'}])
  assert.equal(vetogramStagingMarker(env),null);
});
test('staging marker contains only product, source, environment and schema',()=>{
 const report=vetogramStagingMarker({MARKARIAN_RELEASE_ENABLED:'staging-only',MARKARIAN_ENVIRONMENT:'staging',MARKARIAN_SOURCE_SHA:'b'.repeat(40),SECRET:'LEAK'});
 assert.equal(report.product,'vetogram');
 assert.equal(report.commit,'b'.repeat(40));
 assert.equal(Object.keys(report).length,5);
 assert.doesNotMatch(JSON.stringify(report),/LEAK|SECRET/);
});
