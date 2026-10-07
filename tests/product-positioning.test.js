import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('Ghost Mode is the only user-facing product brand', () => {
  const surfaces = [
    'public/studio.html',
    'public/app.js',
    'api/setup.js',
    'api/webhook-v7.js',
  ].map(read).join('\n');

  assert.doesNotMatch(surfaces, /Telegram Control/);
  assert.doesNotMatch(surfaces, /Story Pilot/);
  assert.match(surfaces, /Ghost Mode/);
});

test('home exposes the complete control layer', () => {
  const html = read('public/studio.html');

  assert.match(html, /id="homeSecurityCard"/);
  assert.match(html, /id="homeAutomationsCard"/);
  assert.match(html, />Security</);
  assert.match(html, />Automations</);
  assert.match(html, /Private control layer for Telegram/);
});

test('legacy technical identifiers stay backward compatible', () => {
  const setup = read('api/setup.js');
  const webhook = read('api/webhook-v7.js');

  assert.match(setup, /STORY_PILOT_BASE_URL/);
  assert.match(webhook, /storypilot:/);
});
