import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../public/privacy.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../api/business-wizard.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = ui.indexOf('function renderBusinessWizardPicker(result)');
const end = ui.indexOf('async function openBusinessWizard()', start);
assert.ok(start >= 0 && end > start, 'Business wizard renderer must exist');
const wizard = ui.slice(start, end);

test('first-run Business wizard offers all personal chats without manual chat selection', () => {
  assert.match(wizard, /value==='all-private'\?'checked':''/);
  assert.doesNotMatch(wizard, /value==='selected-private'\?'checked':''/);
  assert.match(wizard, /все личные чаты, включая новые/);
  // Existing owners must retain their current, possibly narrower recipient scope.
  assert.match(wizard, /value="preserve" checked/);
});

test('suggested scope must never imply consent or auto-enable Anti-Delete', () => {
  assert.match(wizard, /<input type="checkbox" id="businessWizardConsent">/);
  assert.match(wizard, /<input type="checkbox" id="businessWizardAntiDelete">/);
  assert.match(wizard, /<input type="checkbox" id="businessWizardStories"/);
  assert.match(wizard, /data-business-apply="1" disabled/);
  assert.match(api, /body\.consent !== true/);
  assert.match(api, /body\.antiDeleteConsent === true/);
});

test('release flag and server write readiness still guard Telegram Business writes', () => {
  assert.match(api, /!unifiedOnboardingEnabled\(\)/);
  assert.match(api, /readiness\?\.ready!==true/);
  assert.match(api, /withBusinessWriteLock\(ownerId/);
});

test('personal login handoff covers phone OTP, 2FA and QR without silently granting Business access', () => {
  assert.match(app, /function offerBusinessConsentAfterLogin\(\)/);
  assert.equal((app.match(/offerBusinessConsentAfterLogin\(\);/g)||[]).length,3);
  assert.match(app, /owner!==String\(tg\?\.initData\|\|''\)/);
  assert.match(app, /VetoTelegramOpenUnifiedOnboarding\(\{automatic:true\}\)/);
  assert.match(ui, /if \(result\.enabled === false\) return false/);
  // The follow-up is read-only until explicit selection and fresh consent.
  assert.match(api, /action === 'prepare'/);
  assert.match(api, /body\.consent !== true/);
});
