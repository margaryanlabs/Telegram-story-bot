import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const setup = readFileSync(new URL('../api/setup.js', import.meta.url), 'utf8');

test('webhook setup never overwrites a manual BotFather identity by default', () => {
  assert.match(setup, /const syncPublicProfile = process\.env\.BOT_PROFILE_SYNC === 'true'/);
  assert.match(setup, /const syncPublicPhoto = syncPublicProfile && process\.env\.BOT_PROFILE_PHOTO_SYNC === 'true'/);
  assert.match(setup, /if \(syncPublicProfile\) for \(const languageCode/);
  assert.match(setup, /const profilePhotoUpdated = syncPublicPhoto \? await setVetoBotProfilePhoto/);
  const descriptions = setup.slice(setup.indexOf('const shortDescriptions'), setup.indexOf("await tg(token, 'setChatMenuButton'"));
  assert.match(descriptions, /setMyShortDescription/);
  assert.match(descriptions, /setMyDescription/);
  assert.match(setup.slice(setup.indexOf('if (syncPublicProfile) {'),setup.indexOf("await tg(token, 'setChatMenuButton'")), /setMyShortDescription/);
});

test('setup POST still requires an operator secret; GET does not mutate profile', () => {
  assert.match(setup, /const setupSecret = String\(process\.env\.SETUP_SECRET/);
  assert.match(setup, /crypto\.timingSafeEqual\(expectedBuffer, providedBuffer\)/);
  const getSection = setup.slice(setup.indexOf("if (req.method === 'GET')"),setup.indexOf('const setupSecret ='));
  assert.doesNotMatch(getSection,/setMyName|setMyProfilePhoto|setWebhook/);
});
