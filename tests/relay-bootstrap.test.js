import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Emergency Relay works outside the Telegram Mini App', () => {
  const html = read('public/relay.html');
  const api = read('api/relay-bootstrap.js');

  assert.match(html, /Emergency Access/);
  assert.match(html, /Telegram не открывается/);
  assert.match(html, /Звонки не гарантируются/);
  assert.match(html, /Ручная настройка/);
  assert.match(html, /noindex,nofollow,noarchive/);

  assert.match(api, /publicBootstrap:true/);
  assert.match(api, /callsGuaranteed:false/);
  assert.match(api, /manual:/);
  assert.doesNotMatch(api, /validateTelegramMiniApp/);
});

test('Emergency Relay caches shell and multiple routes for fallback', () => {
  const client = read('public/relay-bootstrap.js');
  const worker = read('public/relay-sw.js');

  assert.match(client, /veto-relay-bootstrap-routes-v1/);
  assert.match(client, /localStorage/);
  assert.match(client, /fetchRoute\(\[primary\.relay\?\.id\]/);
  assert.match(client, /source:'cache'/);
  assert.match(client, /current\.tgUrl \|\| current\.connectUrl/);
  assert.match(client, /serviceWorker\.register/);

  assert.match(worker, /veto-relay-shell-v1/);
  assert.match(worker, /\/relay\.html/);
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
});

test('Mini App exposes emergency fallback and avoids promising voice calls', () => {
  const html = read('public/studio.html');
  const client = read('public/relay-module.js');

  assert.match(html, /Аварийный доступ/);
  assert.match(html, /Звонки — без гарантии стабильности/);
  assert.match(html, /Telegram не открывается совсем/);
  assert.match(client, /openEmergencyAccess/);
  assert.match(client, /Связь отвечает слишком долго/);
  assert.match(client, /Нет интернета/);
});

test('Vercel applies no-store and anti-indexing policy to public Relay config', () => {
  const vercel = read('vercel.json');

  assert.match(vercel, /\/api\/relay-bootstrap/);
  assert.match(vercel, /no-store, max-age=0/);
  assert.match(vercel, /noindex, nofollow, noarchive/);
  assert.match(vercel, /Content-Security-Policy/);
});
