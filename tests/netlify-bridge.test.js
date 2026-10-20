import test from 'node:test';
import assert from 'node:assert/strict';
import { toNetlify } from '../netlify/lib/legacy-adapter.mjs';

test('Netlify adapter preserves Telegram JSON, headers and query params', async () => {
  const request = new Request('https://example.netlify.app/api/webhook-v8?source=telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'example' },
    body: JSON.stringify({ update_id: 1234 }),
  });
  const response = await toNetlify(request, (req, res) => {
    assert.equal(req.headers['x-telegram-bot-api-secret-token'], 'example');
    assert.equal(req.query.source, 'telegram');
    assert.deepEqual(req.body, { update_id: 1234 });
    assert.equal(req.url, '/api/webhook-v8?source=telegram');
    res.status(201).json({ ok: true });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
});

test('Netlify adapter preserves binary media payloads and response headers', async () => {
  const response = await toNetlify(new Request('https://example.netlify.app/api/privacy-media'), (_req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(Buffer.from([1, 2, 3, 4]));
  });
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([1, 2, 3, 4]));
});

test('Netlify adapter supports direct res.statusCode + res.end', async () => {
  const response = await toNetlify(new Request('https://example.netlify.app/api/relay', { method: 'POST' }), (_req, res) => {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end('{"ok":false}');
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false });
});

test('Netlify adapter rejects incomplete responses', async () => {
  const response = await toNetlify(new Request('https://example.netlify.app/api/health'), () => {});
  assert.equal(response.status, 502);
});
