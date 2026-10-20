import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// Keep this audit small and deterministic: only user-facing app/bot sources,
// not legacy DB migration keys, internal storage IDs or historic docs.
const PUBLIC_FILES = [
  'public/studio.html',
  'public/app.js',
  'public/privacy.js',
  'public/telegram-chats.js',
  'public/studio-module.js',
  'public/brand-pack.js',
  'api/webhook-v7.js',
  'api/webhook-v8.js',
  'api/setup.js',
];

test('VetoTG is the public identity, and Business instructions point only to the new bot', () => {
  const html = read('public/studio.html');
  const privacy = read('public/privacy.js');
  const webhook = read('api/webhook-v7.js');
  const setup = read('api/setup.js');

  assert.match(html, /<title>VetoTG —/);
  assert.match(html, /<strong>VetoTG<\/strong>/);
  assert.match(privacy, /const username = '@Vetotg_bot'/);
  assert.match(privacy, /Введи @Vetotg_bot/);
  assert.match(webhook, /@Vetotg_bot/);
  assert.match(setup, /name: 'VetoTG'/);
  assert.match(setup, /text: 'VetoTG'/);
  assert.match(setup, /TELEGRAM_EXPECTED_BOT_USERNAME/);
});

test('no deprecated bot link or product name remains in customer-facing source', () => {
  // Lowercase storylab flags and persisted identifiers are intentionally left intact.\n  for (const path of PUBLIC_FILES) {
    const source = read(path);
    assert.doesNotMatch(source, /@Storypilotlab_bot|StoryLab|VETO Telegram/, `stale public branding in ${path}`);
  }
});
