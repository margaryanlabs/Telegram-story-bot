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
  assert.match(html, /Доступность Business зависит от настроек Telegram и может требовать Premium/);
  assert.match(html, /Без доступа к секретным чатам/);
  assert.match(html, /@vetotg_bot/);
});

test('Business walkthrough uses Telegram settings, never requests an OTP or expands privileges', () => {
  const code = source('public/privacy.js');
  const guide = code.split('function privacyBusinessGuideSheet()')[1].split('async function mediaRecoveryApi')[0];
  assert.match(guide, /Telegram для бизнеса/);
  assert.match(guide, /Выбери личные чаты|Выбрать личные чаты/);
  assert.match(guide, /data-privacy-copy-bot/);
  assert.match(guide, /data-privacy-recheck-access/);
  assert.match(guide, /не нужны права отвечать, удалять сообщения или отмечать их прочитанными/);
  assert.doesNotMatch(guide, /send_code|verify_code|2FA|введи код/);
});

test('Onboarding status comes from verified backend Business connection, not local toggles', () => {
  const code = source('public/privacy.js');
  assert.match(code, /renderBusinessOnboarding\(connectionLive, readMessages\)/);
  assert.match(code, /const verified = connectionLive && !failed/);
  assert.match(code, /const operational = complete && connectionLive && !privacyState\.connection\.error && !privacyState\.degraded/);
  assert.match(code, /await loadTelegramConnection\(\{ silent:false \}\)/);
  assert.match(code, /privacyBusinessVerifyButton/);
  assert.match(code, /privacyBusinessCopyButton/);
  assert.match(code, /if \(!document.hidden && privacyScreenActive\(\)\) \{/);
  const html = source('public/studio.html');
  assert.match(html, /privacy\.js\?v=20261017-veto-telegram-chat-ui-v2/);
});

test('Business message updates do not require the Telegram mark-as-read permission', () => {
  const privacy = source('public/privacy.js');
  const diagnostics = source('api/privacy.js');
  assert.match(privacy, /const operational = complete && connectionLive && !privacyState\.connection\.error/);
  assert.match(diagnostics, /ok: businessLive,\n      label: 'Business message events'/);
  assert.match(diagnostics, /can_read_messages grants MARK-AS-READ/);
  assert.match(diagnostics, /send a test message in an allowed private chat/);
  assert.doesNotMatch(privacy, /complete && connectionLive && readMessages/);
});

test('Connect journey retains a mobile layout and never claims to retrieve past deleted chats', () => {
  const css = source('public/app.css');
  const app = source('public/app.js');
  assert.match(css, /\.veto-business-journey/);
  assert.match(css, /@media\(max-width:400px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /архив сохраняет только доступные новые события|Архив сохраняет только доступные новые события/);
});
