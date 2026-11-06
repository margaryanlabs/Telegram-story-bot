/* RB5 — 2FA stage expiry must match the durable server challenge. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('api/viewer-sync.js');
const ui=read('public/app.js');
const verifyStart=api.indexOf("    if (action === 'verify_code') {");
const branchStart=api.indexOf('      if (result.needsPassword) {',verifyStart);
const branchEnd=api.indexOf('      try {\n        requireOwnTelegramAccount(',branchStart);
assert.ok(verifyStart>0&&branchStart>verifyStart&&branchEnd>branchStart);
const twoFactorBranch=api.slice(branchStart,branchEnd);
const between=(start,end)=>{
  const a=ui.indexOf(start),b=ui.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing real UI function: '+start);
  return ui.slice(a,b);
};
const resultSource=between('  async function renderViewerLoginResult(data) {','  function viewerResendControls() {');
const passwordSource=between('  function viewerPasswordSheet(hint = \'\') {','  function viewerQrSheet() {');

test('phone-code-to-2FA saves and returns the same fresh challenge expiry',async()=>{
  let saved=null,response=null;
  const scope={
    result:{needsPassword:true,session:'not-a-real-session'},
    auth:{phone:'fake'},
    challenge:{created_at:'2026-11-05T00:00:00.000Z'},
    userId:'123',AUTH_TTL_MS:600000,Date,
    sealJson:async()=>'encrypted-stub',
    saveAuthChallenge:async row=>{saved=row;},
    res:{status(status){this.code=status;return this},json(body){response=body;return this}},
  };
  const execute=vm.runInNewContext('(async function(){'+twoFactorBranch+'})',scope);
  await execute();
  assert.equal(response.stage,'password');
  assert.equal(response.needsPassword,true);
  assert.equal(response.expiresAt,saved.expires_at);
  assert.equal(saved.stage,'password');
  assert.equal(saved.challenge_ciphertext,'encrypted-stub');
  assert.ok(Date.parse(saved.expires_at)>Date.now()+9*60_000);
  assert.doesNotMatch(twoFactorBranch,/send_code|resend_code/);
});

test('phone login password transition exposes resumable status before showing password modal',async()=>{
  const viewerState={loginPending:{stage:'code',expiresAt:'old'}},calls=[];
  const fn=vm.runInNewContext(resultSource+';renderViewerLoginResult',{
    viewerState,
    renderViewerPendingLoginNotice:()=>calls.push('pending'),
    viewerPasswordSheet:()=>calls.push('password'),
  });
  const expiry=new Date(Date.now()+600000).toISOString();
  await fn({stage:'password',needsPassword:true,expiresAt:expiry});
  assert.equal(viewerState.loginPending.expiresAt,expiry);
  assert.equal(viewerState.loginPending.stage,'password');
  assert.deepEqual(calls,['pending','password']);
});

test('2FA sheet names its actual entry route and closing keeps durable challenge',()=>{
  const viewerState={loginPending:{stage:'qr_password'}};
  let html='';
  const fn=vm.runInNewContext(passwordSource+';viewerPasswordSheet',{
    viewerState,openSheet:value=>{html=value;},escapeHtml:x=>String(x),
  });
  fn('hint');
  assert.match(html,/✓ QR/);
  assert.match(html,/✓ Подтверждение/);
  assert.match(html,/Закрыть \(вход сохранится\)/);
  assert.doesNotMatch(html,/✓ Номер/);
  viewerState.loginPending.stage='password';
  fn();
  assert.match(html,/✓ Номер/);
  assert.match(html,/✓ Код/);
});

test('code verification path keeps new 2FA expiry and offers a resume option',()=>{
  const verify=ui.slice(ui.indexOf("    if (action === 'viewer-verify-code') {"),
    ui.indexOf("    if (action === 'viewer-verify-password') {"));
  assert.match(verify,/expiresAt:data\.expiresAt\|\|viewerState\.loginPending\?\.expiresAt\|\|null/);
  assert.match(verify,/renderViewerPendingLoginNotice\(\);\s*viewerPasswordSheet\(\);/);
  assert.doesNotMatch(verify,/viewerApi\('send_code'/);
});
