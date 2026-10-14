import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramWebhookHealth } from '../lib/telegram-webhook-health.js';
import { readFileSync } from 'node:fs';

const now = Date.UTC(2026, 9, 14, 18, 0, 0);
const url = 'https://telegram-story-bot-murex.vercel.app/api/webhook-v8';

test('Historical Telegram delivery error is reported without taking an otherwise healthy product offline', () => {
  const result = telegramWebhookHealth({
    url, pending_update_count: 0,
    last_error_message: 'Wrong response from the webhook: 503 Service Unavailable',
    last_error_date: now / 1000 - 3600,
  }, now);
  assert.equal(result.ready, true);
  assert.equal(result.errorStale, true);
  assert.equal(result.errorRecent, false);
  assert.equal(result.pendingUpdates, 0);
});

test('New webhook failure stays degraded, even with zero pending updates', () => {
  const result = telegramWebhookHealth({
    url, pending_update_count: 0,
    last_error_message: 'Wrong response from the webhook: 503',
    last_error_date: now / 1000 - 100,
  }, now);
  assert.equal(result.ready, false);
  assert.equal(result.errorRecent, true);
});

test('Unknown last-error date remains conservatively degraded', () => {
  const result = telegramWebhookHealth({ url, last_error_message:'delivery failed' },now);
  assert.equal(result.ready,false);
});

test('Webhook must be correct HTTPS endpoint, not a lookalike path', () => {
  assert.equal(telegramWebhookHealth({url:'https://example.com/not-webhook-v8'},now).ready,false);
  assert.equal(telegramWebhookHealth({url:'http://example.com/api/webhook-v8'},now).ready,false);
});

test('Existing Mini App and Telegram message flows both use fresh UI build identifiers', () => {
  const studio = readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
  const setup = readFileSync(new URL('../api/setup.js',import.meta.url),'utf8');
  const webhook = readFileSync(new URL('../api/webhook-v7.js',import.meta.url),'utf8');
  assert.ok(studio.includes('/app.js?v=20261014-veto-connect-r2'));
  assert.ok(studio.includes('/privacy.js?v=20261014-veto-connect-r2'));
  assert.match(setup,/CONTROL_BUILD = '20261014-veto-connect-r2'/);
  assert.match(webhook,/CONTROL_BUILD = '20261014-veto-connect-r2'/);
});
