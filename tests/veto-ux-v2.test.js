import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

test('VETO Telegram v2 exposes a real brand mark and cinematic dark shell', () => {
  const html = read('public/studio.html');
  const css = read('public/app.css');

  assert.match(html, /veto-telegram-mark\.svg/);
  assert.match(html, /id="connectTelegramButton"/);
  assert.match(html, /class="veto-stage-fx"/);
  assert.match(css, /VETO TELEGRAM v2 — forced dark/);
  assert.match(css, /--bg:#06080d!important/);
  assert.match(css, /@keyframes vetoGlassSweep/);
  assert.match(css, /@keyframes vetoScan/);
});

test('regular Telegram account link is a first-class connection path', () => {
  const app = read('public/app.js');
  const miniapp = read('api/miniapp.js');
  const publisher = read('lib/story-app-publisher.js');

  assert.match(app, /QR \/ номер телефона/);
  assert.match(app, /data-sheet-action="account-connect"/);
  assert.match(app, /Telegram Business.*Optional|Business.*optional/i);
  assert.match(miniapp, /getViewerSession/);
  assert.match(miniapp, /connectionMode/);
  assert.match(miniapp, /publishPhotoStoryUserSession/);
  assert.match(publisher, /export async function publishPhotoStoryUserSession/);
  assert.match(publisher, /export async function deleteStoryUserSession/);
});

test('Telegram host chrome is forced to the VETO dark visual system', () => {
  const app = read('public/app.js');

  assert.match(app, /setHeaderColor\?\.\('#000000'\)/);
  assert.match(app, /setBackgroundColor\?\.\('#000000'\)/);
  assert.match(app, /setBottomBarColor\?\.\('#030303'\)/);
});

test('bot setup pushes VETO Telegram identity to Telegram', () => {
  const setup = read('api/setup.js');

  assert.match(setup, /setMyName/);
  assert.match(setup, /name: 'VETO Telegram'/);
  assert.match(setup, /setMyProfilePhoto/);
  assert.match(setup, /profilePhotoUpdated = await setVetoBotProfilePhoto\(token\)/);
  assert.match(setup, /veto-telegram\.jpg/);
  assert.match(setup, /getUserProfilePhotos/);
  assert.match(setup, /20261007-veto-telegram-v2-profile/);
  assert.match(setup, /brand: 'VETO Telegram v2'/);
});
