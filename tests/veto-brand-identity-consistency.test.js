import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html = read('public/studio.html');
const svg = read('public/veto-telegram-mark.svg');
const css = read('public/veto-messenger-rebirth.css');
const setup = read('api/setup.js');

test('VETO uses its real original split-V silhouette (not fabricated V-star)',()=>{
  assert.match(svg,/viewBox="0 0 40 40"/);
  assert.ok(svg.includes('M8.5 11.5 19.7 29 15 29 6.8 16.1Z'));
  assert.ok(svg.includes('M31.5 11.5 20.3 29H25l8.2-12.9Z'));
  assert.match(svg,/vetoSilver/);
  assert.match(svg,/vetoFlame/);
  assert.doesNotMatch(html,/aria-hidden="true">V<span>✦<\/span>/);
  assert.match(html,/class="veto-inbox-signature" aria-hidden="true"><img src="\/veto-telegram-mark\.svg\?v=20261019-brand-v2"/);
  assert.match(html,/class="veto-inbox-wordmark">VETO/);
});

test('One consistent mark appears in welcome, command center, inbox, tab and favicon',()=>{
  assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/veto-telegram-mark\.svg\?v=20261019-brand-v2"/);
  assert.match(html,/class="veto-nav-brand-mark" src="\/veto-telegram-mark\.svg\?v=20261019-brand-v2"/);
  assert.match(html,/class="veto-welcome-brand"><img src="\/veto-telegram-mark\.svg\?v=20261019-brand-v2"/);
  assert.match(html,/class="veto-intro-orbit"><img src="\/veto-telegram-mark\.svg\?v=20261019-brand-v2"/);
  assert.match(html,/class="veto-logo-halo"><img src="\/veto-telegram-mark\.svg\?v=20261019-brand-v2"/);
  assert.ok(!html.includes('src="/veto-telegram-mark.svg"'));
  assert.ok(!html.includes('href="/veto-telegram-mark.svg"'));
});

test('The bot setup can render the same canonical SVG when authorized',()=>{
  const quote=String.fromCharCode(96);
  assert.ok(setup.includes('const VETO_MARK_SVG = '+quote+svg.trim()+quote+';'));
  assert.match(setup,/sharp\(Buffer\.from\(VETO_MARK_SVG\)\)/);
});

test('Brandmark uses original geometry with accessible text and mobile sizing',()=>{
  assert.match(css,/\.veto-inbox-signature img\{/);
  assert.match(css,/\.veto-inbox-wordmark\{/);
  assert.match(css,/\.veto-nav-brand-mark\{/);
  assert.match(css,/@media\(max-width:440px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.doesNotMatch(css,/\.veto-inbox-signature span\{/);
  assert.match(html,/class="veto-inbox-title-copy"><span class="veto-inbox-wordmark">VETO/);
});

test('The actual branded SVG rasterizes for browser previews and Telegram bot photo',async()=>{
  const rendered=await sharp(Buffer.from(svg)).resize(256,256).png().toBuffer();
  const meta=await sharp(rendered).metadata();
  assert.equal(meta.width,256);
  assert.equal(meta.height,256);
  assert.ok(rendered.length>1000);
  const jpeg=await sharp(Buffer.from(svg)).resize(640,640).flatten({background:'#000000'}).jpeg().toBuffer();
  assert.ok(jpeg.length>3000);
});
