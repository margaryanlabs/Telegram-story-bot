import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { streamStoryMedia } from '../lib/story-media-stream.js';

test('contact Stories larger than 4 MB are returned by streamed response', async () => {
  const bytes = Buffer.alloc(5 * 1024 * 1024 + 144, 0x32);
  const res = new PassThrough({ highWaterMark: 64 * 1024 });
  const headers = {};
  res.setHeader = (k,v) => {headers[k.toLowerCase()]=v;return res;};
  res.status = code => {res.statusCode=code;return res;};
  let received = 0;
  res.on('data',chunk=> { received+=chunk.length; });
  await streamStoryMedia(res,bytes,'video/mp4');
  assert.equal(res.statusCode,200);
  assert.equal(received,bytes.length);
  assert.equal(headers['content-type'],'video/mp4');
  assert.equal(headers['x-veto-story-mode'],'ghost-no-receipt');
  assert.equal(headers['cache-control'],'private, no-store, max-age=0');
});

test('untrusted media types are refused before streaming', async () => {
  const res = new PassThrough();
  res.setHeader = ()=>res;
  await assert.rejects(streamStoryMedia(res,Buffer.from('nope'),'text/html'),/UNSUPPORTED_STORY_MEDIA/);
});

test('phone selector defaults to Russia +7, supports +374 and does not double-select +7',()=>{
  const html=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../public/veto-device-polish.css',import.meta.url),'utf8');
  assert.match(html,/🇷🇺 Россия · \+7/);
  assert.match(html,/🇦🇲 Армения · \+374/);
  assert.match(html,/viewerPhoneCountry/);
  assert.match(html,/const phone = local\.startsWith\('\+'\) \? local : prefix \+ local/);
  assert.equal((html.match(/\['\+7','/g)||[]).length,1);
  assert.match(css,/\.veto-phone-entry/);
  assert.match(css,/@media\(max-width:370px\)/);
});
