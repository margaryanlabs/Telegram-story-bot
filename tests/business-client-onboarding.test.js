import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Privacy screen offers a visible, consent-first Telegram Business onboarding journey', () => {
  const html = source('public/studio.html');
  assert.match(html, /id="privacyBusinessOnboarding"/);
  assert.match(html, /id="privacyBusinessCopyButton"/);
  assert.match(html, /id="privacyBusinessVerifyButton"/);
  assert.match(html, /«Только выбранные чаты»/);
  assert.match(html, /Без Premium/);
  assert.match(html, /Без доступа к секретным чатам/);
  assert.match(html, /@Storypilotlab_bot/);
});

test('Business walkthrough uses Telegram settings, never requests an OTP or expands privileges', () => {
  const code = source('public/privacy.js');
  const guide = code.split('function privacyBusinessGuideSheet()')[1].split('async function mediaRecoveryApi')[0];
  assert.match(guide, /Telegram для бизнеса/);
  assert.match(guide, /Выбери личные чаты|Выбрать личные чаты/);
  assert.match(guide, /data-privacy-copy-bot/);
  assert.match(guide, /data-privacy-recheck-access/);
  assert.match(guide, /Не предоставляй права отправлять или удалять сообщения/);
  assert.doesNotMatch(guide, /send_code|verify_code|2FA|введи код/);
});

test('Onboarding status comes from verified backend Business connection, not local toggles', () => {
  const code = source('public/privacy.js');
  assert.match(code, /renderBusinessOnboarding\(connectionLive, readMessages\)/);
  assert.match(code, /const verified = connectionLive && readMessages/);
  assert.match(code, /await loadTelegramConnection\(\{ silent:false \}\)/);
  assert.match(code, /privacyBusinessVerifyButton/);
  assert.match(code, /privacyBusinessCopyButton/);
  assert.match(code, /if \(!document.hidden && privacyScreenActive\(\)\) \{/);
  const html = source('public/studio.html');
  assert.match(html, /privacy\.js\?v=20261017-veto-business-onboarding-v1/);
});

test('Connect journey retains a mobile layout and never claims to retrieve past deleted chats', () => {
  const css = source('public/app.css');
  const app = source('public/app.js');
  assert.match(css, /\.veto-business-journey/);
  assert.match(css, /@media\(max-width:400px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /архив сохраняет только доступные новые события|Архив сохраняет только доступные новые события/);
});
