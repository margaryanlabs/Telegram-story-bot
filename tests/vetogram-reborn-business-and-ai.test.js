import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('public/app.js'),html=read('public/studio.html');
const privacy=read('public/privacy.js'),api=read('api/business-wizard.js');
const ai=read('public/vetogram-reborn-ai.js'),css=read('public/vetogram-noir.css');

test('Business onboarding is in-app first; manual remains an optional fallback only',()=>{
  const wizard=html.indexOf('class="veto-business-wizard-highlight"');
  const manual=html.indexOf('class="veto-business-manual-fallback"');
  assert.ok(wizard>0 && manual>wizard);
  assert.match(html,/id="privacyBusinessWizardButton">Включить Anti-Delete/);
  assert.match(html,/id="privacyBusinessDetailsButton">Как работает доступ/);
  assert.match(privacy,/function businessUnavailableSheet/);
  assert.match(privacy,/if \(result.enabled === false\) \{ businessUnavailableSheet\(\); return; \}/);
  assert.match(app,/Anti-Delete подключается в Vetogram/);
  assert.match(privacy,/<summary>Резервная ручная настройка/);
  assert.doesNotMatch(app,/Settings → Telegram Business \/ Business → Chatbots/);
});

test('no blanket Business rights or all-private scope are preselected',()=>{
  assert.match(privacy,/value==='selected-private'\?'checked':''/);
  assert.doesNotMatch(privacy,/value==='all-private'\?'checked':''/);
  assert.match(privacy,/id="businessWizardAntiDelete"/);
  assert.match(privacy,/id="businessWizardStories"/);
  assert.match(privacy,/antiDeleteConsent:\$\('businessWizardAntiDelete'\)\?\.checked===true/);
  assert.match(privacy,/storiesConsent:\$\('businessWizardStories'\)\?\.checked===true/);
  assert.doesNotMatch(privacy,/antiDeleteConsent:[^\n]+\|\| \(businessWizardSnapshot/);
  assert.doesNotMatch(privacy,/storiesConsent:[^\n]+\|\| \(businessWizardSnapshot/);
});

test('Business permission UI never reuses a prior account consent or chat list',()=>{
  const request=privacy.slice(privacy.indexOf('async function businessWizardRequest('),
    privacy.indexOf('let businessWizardSnapshot',privacy.indexOf('async function businessWizardRequest(')));
  assert.match(request,/const lease=ownerLease\(\)/);
  assert.match(request,/const signedOwner=lease\.signed/);
  assert.match(request,/assertOwner\(lease\)/);
  assert.match(request,/x-telegram-init-data':signedOwner/);
  assert.match(privacy,/businessWizardSignedOwner/);
  assert.match(privacy,/!businessWizardSnapshot \|\| String\(tg\?\.initData\|\|''\)!==businessWizardSignedOwner/);
});

test('production Business gate checks Neon migration before any session or Telegram write',()=>{
  const on=api.indexOf('if (!unifiedOnboardingEnabled())');
  const ready=api.indexOf('const readiness=await businessWriteReadiness()');
  const readSession=api.indexOf('const session = await getViewerSession');
  assert.ok(on>0 && ready>on && readSession>ready);
  assert.match(api,/selectedStorageProvider\(\) !== 'neon'/);
  assert.doesNotMatch(api,/VERCEL_ENV !== 'production'\) return \{ready:true\}/);

  assert.match(api,/Number\(result\?\.schemaVersion\)>=5/);
  assert.match(api,/result\.businessLeaseReady===true/);
  assert.match(api,/state:'requires-server-readiness'/);
  assert.match(api,/Серверная защита подключения ещё не подготовлена/);
  assert.doesNotMatch(api,/CREATE TABLE|ALTER TABLE/);
});

test('AI conversation is visible ahead of real composer and examples are local-only',()=>{
  const screen=html.indexOf('data-screen="ai"');
  const conversation=html.indexOf('class="vtai-panel veto-reborn-ai-conversation"',screen);
  const form=html.indexOf('<h2 data-ui-text="askVetoAI">Напиши VETO AI</h2>',screen);
  assert.ok(screen>0&&conversation>screen&&form>conversation);
  assert.equal((html.match(/id="vtaiThread"/g)||[]).length,1);
  assert.match(html,/vetogram-reborn-ai\.js\?v=/);
  assert.doesNotThrow(()=>new vm.Script(ai));
  assert.match(ai,/input\.value=sample/);
  assert.match(ai,/input\.value\.trim\(\)/);
  assert.doesNotMatch(ai,/fetch\(|localStorage|sessionStorage|vtaiCreate\.click\(/);
  assert.match(css,/veto-reborn-ai-conversation/);
  assert.match(css,/veto-mirror-search-wrap/);
});
