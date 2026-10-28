/* Real image-processing regression, no Telegram session or user media. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {prepareInlinePhoto,prepareAvatar} from '../api/telegram-chat-media.js';

test('oversized Telegram image becomes a bounded viewable JPEG preview',async()=>{
  const width=1800,height=1800;
  const pixels=randomBytes(width*height*3);
  const large=await sharp(pixels,{raw:{width,height,channels:3}})
    .jpeg({quality:100}).toBuffer();
  assert.ok(large.length>4*1024*1024,'synthetic photo must exceed the response limit');
  const preview=await prepareInlinePhoto(large);
  assert.ok(Buffer.isBuffer(preview));
  assert.ok(preview.length>0&&preview.length<=4*1024*1024);
  const meta=await sharp(preview).metadata();
  assert.equal(meta.format,'jpeg');
  assert.ok(meta.width<=1440&&meta.height<=1440);
});

test('huge or empty downloads remain blocked',async()=>{
  assert.equal(await prepareInlinePhoto(Buffer.alloc(0)),null);
  assert.equal(await prepareInlinePhoto(Buffer.alloc(16*1024*1024+1)),null);
});

test('large PNG avatar is converted to a bounded JPEG thumbnail',async()=>{
  const input=await sharp(randomBytes(450*450*3),{
    raw:{width:450,height:450,channels:3},
  }).png().toBuffer();
  assert.ok(input.length>180*1024);
  const preview=await prepareAvatar(input);
  assert.ok(Buffer.isBuffer(preview));
  assert.ok(preview.length>0&&preview.length<=180*1024);
  const meta=await sharp(preview).metadata();
  assert.equal(meta.format,'jpeg');
  assert.ok(meta.width<=192&&meta.height<=192);
});

test('avatar download budget rejects invalid and unbounded input',async()=>{
  assert.equal(await prepareAvatar(Buffer.alloc(0)),null);
  assert.equal(await prepareAvatar(Buffer.alloc(2*1024*1024+1)),null);
});
