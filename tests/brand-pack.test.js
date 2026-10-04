import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { generateBrandPack, knockoutNearWhite } from '../api/emoji-studio.js';

async function fixtureLogo() {
  const red = Buffer.from(
    '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="100" height="100" fill="#ffffff"/>' +
    '<rect x="20" y="20" width="60" height="60" rx="8" fill="#d71920"/>' +
    '<rect x="40" y="40" width="20" height="20" rx="3" fill="#ffffff"/>' +
    '</svg>'
  );
  return sharp(red).png().toBuffer();
}

test('background cleanup removes only edge-connected white', async () => {
  const source = await fixtureLogo();
  const cleaned = await knockoutNearWhite(source);
  const { data, info } = await sharp(cleaned).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.ok(info.width >= 58 && info.width <= 62);
  assert.ok(info.height >= 58 && info.height <= 62);

  const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
  assert.ok(data[center] > 235);
  assert.ok(data[center + 1] > 235);
  assert.ok(data[center + 2] > 235);
  assert.ok(data[center + 3] > 240);
});

test('brand pack generates six consistent Telegram assets', async () => {
  const source = await fixtureLogo();
  const assetDataUrl = 'data:image/png;base64,' + source.toString('base64');
  const result = await generateBrandPack({
    assetDataUrl,
    kind: 'custom_emoji',
    count: 6,
    accent: '',
  });

  assert.equal(result.assets.length, 6);
  assert.match(result.accent, /^#[0-9A-F]{6}$/);
  assert.ok(result.assets.every(item => item.assetDataUrl.startsWith('data:image/webp;base64,')));
  assert.deepEqual(result.assets.map(item => item.id), ['core', 'done', 'private', 'watch', 'priority', 'focus']);
});
