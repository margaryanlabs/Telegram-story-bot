import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNpmLock} from '../lib/vetogram-lock-audit.js';
const manifest={dependencies:{'@neondatabase/serverless':'1.0.2','sharp':'0.34.5'}};
const good={lockfileVersion:3,packages:{
  '':{dependencies:manifest.dependencies},
  'node_modules/@neondatabase/serverless':{version:'1.0.2',
    resolved:'https://registry.npmjs.org/@neondatabase/serverless/-/serverless-1.0.2.tgz',
    integrity:'sha512-'+ 'A'.repeat(88)},
  'node_modules/sharp':{version:'0.34.5',
    resolved:'https://registry.npmjs.org/sharp/-/sharp-0.34.5.tgz',
    integrity:'sha512-'+ 'A'.repeat(88)}
}};
test('lock audit accepts a direct manifest whose resolution entries exist',()=>{
  const report=auditNpmLock(manifest,good);
  assert.equal(report.ok,true);
  assert.equal(report.declaredCount,2);
});
test('lock audit rejects stale root specs and missing dependency resolution',()=>{
  const stale={lockfileVersion:3,packages:{
    '':{dependencies:{sharp:'0.34.5'}},
    'node_modules/sharp':{version:'0.34.5'}
  }};
  const report=auditNpmLock(manifest,stale);
  assert.equal(report.ok,false);
  assert.deepEqual(report.mismatches.map(x=>x.name),['@neondatabase/serverless']);
  assert.deepEqual(report.missingPackages,['@neondatabase/serverless']);
});
test('lock audit catches missing node_modules entries despite matching root metadata',()=>{
  const malformed={lockfileVersion:3,packages:{
    '':{dependencies:manifest.dependencies},
    'node_modules/sharp':{version:'0.34.5'}
  }};
  const report=auditNpmLock(manifest,malformed);
  assert.equal(report.ok,false);
  assert.deepEqual(report.mismatches,[]);
  assert.deepEqual(report.missingPackages,['@neondatabase/serverless']);
});
test('lock audit fails on old lockfiles and rejects invalid inputs',()=>{
  assert.equal(auditNpmLock(manifest,{...good,lockfileVersion:1}).ok,false);
  assert.throws(()=>auditNpmLock(null,good),/LOCK_AUDIT_INPUT_INVALID/);
});


test('lock audit rejects incorrect exact pinned version even when root matches',()=>{
  const tampered=structuredClone(good);
  tampered.packages['node_modules/@neondatabase/serverless'].version='1.0.1';
  const report=auditNpmLock(manifest,tampered);
  assert.equal(report.ok,false);
  assert.deepEqual(report.invalidResolutions,
    [{name:'@neondatabase/serverless',reason:'VERSION_MISMATCH'}]);
});
test('lock audit rejects missing integrity and missing registry resolution',()=>{
  const tampered=structuredClone(good);
  delete tampered.packages['node_modules/sharp'].integrity;
  delete tampered.packages['node_modules/@neondatabase/serverless'].resolved;
  const report=auditNpmLock(manifest,tampered);
  assert.equal(report.ok,false);
  assert.deepEqual(report.invalidResolutions,[
    {name:'@neondatabase/serverless',reason:'MISSING_RESOLVED'},
    {name:'sharp',reason:'MISSING_INTEGRITY'}
  ]);
});
test('lock audit accepts legitimate local symlink entries without integrity',()=>{
  const local={dependencies:{'@acme/linked':'workspace:*'}};
  const link={lockfileVersion:3,packages:{
    '':{dependencies:local.dependencies},
    'node_modules/@acme/linked':{link:true,resolved:'packages/linked'}
  }};
  assert.equal(auditNpmLock(local,link).ok,true);
});
