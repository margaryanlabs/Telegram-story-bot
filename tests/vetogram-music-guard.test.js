import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/music.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/music.js', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../public/music-entry.js', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');

test('music view is present and linked from Vetogram home', () => {
  assert.match(studio, /id="vetogramMusicLauncher"/);
  assert.match(studio, /music-entry\.js/);
  assert.match(entry, /location\.assign\('\/music\.html'\)/);
  assert.match(html, /id="searchForm"/);
  assert.match(html, /id="audio"/);
  assert.match(html, /id="player"/);
  assert.match(html, /id="favoritesButton"/);
});

test('music provider only searches openly licensed content', () => {
  assert.match(js, /api\.openverse\.org\/v1\/audio/);
  assert.match(js, /license: 'cc0,pdm,by'/);
  assert.match(js, /ACCEPTED = new Set\(\['cc0', 'pdm', 'by'\]\)/);
  assert.doesNotMatch(js, /VK_TOKEN|VK_ADMIN_TOKEN|api\.vk\.com\/method\/audio/);
  assert.doesNotMatch(js, /music\.yandex\.(?:ru|com)\/api/);
});

test('music view uses source attribution and fails visibly for missing tracks', () => {
  assert.match(html, /id="sourceLink"/);
  assert.match(js, /foreign_landing_url/);
  assert.match(js, /license_url/);
  assert.match(js, /audio\.addEventListener\('error'/);
  assert.match(html, /Твой ритм/);
});