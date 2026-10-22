import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureBusinessMessage, listPrivacyThreads } from '../lib/viewer-sync-store.js';

// These are Supabase gateway contract tests with a mocked fetch. Preview uses
// Neon without Neon credentials, so pin the mocked provider explicitly.
const previousProvider = process.env.VETO_STORAGE_PROVIDER;
process.env.VETO_STORAGE_PROVIDER = 'supabase';
after(() => {
  if (previousProvider === undefined) delete process.env.VETO_STORAGE_PROVIDER;
  else process.env.VETO_STORAGE_PROVIDER = previousProvider;
});


function source(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Telegram privacy ingestion sends one bounded store request', async () => {
  const priorFetch = globalThis.fetch;
  const priorHash = process.env.TELEGRAM_API_HASH;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_API_HASH = 'test-hash';
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  let attempts = 0;
  globalThis.fetch = async (_url, options) => {
    attempts++;
    const payload = JSON.parse(options.body);
    assert.equal(payload.op, 'capture_business_message');
    return { ok: true, json: async () => ({ ok: true, data: { captured: true } }) };
  };
  try {
    assert.equal((await captureBusinessMessage({ chat_id: '4' })).captured, true);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorHash === undefined) delete process.env.TELEGRAM_API_HASH;
    else process.env.TELEGRAM_API_HASH = priorHash;
    if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = priorToken;
  }
});

test('Store failure is not silently acknowledged by capture helper', async () => {
  const priorFetch = globalThis.fetch;
  const priorHash = process.env.TELEGRAM_API_HASH;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_API_HASH = 'test-hash';
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    throw new Error('upstream unavailable');
  };
  try {
    await assert.rejects(captureBusinessMessage({ chat_id: '4' }), /upstream unavailable/);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorHash === undefined) delete process.env.TELEGRAM_API_HASH;
    else process.env.TELEGRAM_API_HASH = priorHash;
    if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = priorToken;
  }
});

test('Archive reads are bounded and recoverable', async () => {
  const priorFetch = globalThis.fetch;
  const priorHash = process.env.TELEGRAM_API_HASH;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_API_HASH = 'test-hash';
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, json: async () => ({ ok: true, data: { threads: [{ chatId: '1' }] } }) };
  };
  try {
    const response = await listPrivacyThreads('17');
    assert.equal(response.threads.length, 1);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorHash === undefined) delete process.env.TELEGRAM_API_HASH;
    else process.env.TELEGRAM_API_HASH = priorHash;
    if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = priorToken;
  }
});

test('Webhook retries failed message and delete capture instead of dropping updates', () => {
  const src = source('api/webhook-v7.js');
  assert.match(src, /privacy_message_archive_unavailable/);
  assert.match(src, /privacy_delete_archive_unavailable/);
  assert.match(src, /res\.status\(503\)/);
  assert.match(src, /if \(activityConnectionId && !privacyActivity\)/);
  assert.doesNotMatch(src, /\/\/ Privacy storage must never make Telegram retry the entire webhook update\./);
});

test('Temporary Telegram verification failures keep existing Business rights', () => {
  const src = source('api/webhook-v7.js');
  assert.match(src, /verificationDeferred: true/);
  assert.match(src, /live: Boolean\(settings\.bc\)/);
});

test('Chats do not disappear when one conversation exceeds the old 600-event cap', () => {
  const store = source('supabase/functions/story-pilot-store/index.ts');
  const start = store.indexOf('async function opListPrivacyThreads(');
  const end = store.indexOf('async function opListDeletedFeed(', start);
  assert.ok(start >= 0 && end > start);
  const handler = store.slice(start, end);
  assert.match(handler, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(handler, /\.range\(offset, offset \+ pageSize - 1\)/);
});
