import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { streamStoryMedia } from '../lib/story-media-stream.js';
import { STORY_MEDIA_LIMIT_BYTES } from '../lib/telegram-contact-stories.js';
const src = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('private Story video larger than 4 MB streams in chunks, not a buffered function response',async()=>{
  const size=5*1024*1024+123,buffer=Buffer.alloc(size,1);
  const headers={},writes=[];
  const res={
    writableEnded:false,destroyed:false,
    setHeader(k,v){headers[k.toLowerCase()]=v},
    status(n){this.statusCode=n;return this},
    flushHeaders(){this.flushed=true},
    write(chunk){writes.push(chunk.length);return true},
    end(){this.writableEnded=true}
  };
  await streamStoryMedia(res,buffer,'video/mp4');
  assert.equal(res.statusCode,200);
  assert.equal(headers['content-type'],'video/mp4');
  assert.equal(headers['content-length'],String(size));
  assert.equal(headers['x-veto-story-mode'],'ghost-no-receipt');
  assert.match(headers['cache-control'],/no-store/);
  assert.equal(writes.reduce((a,b)=>a+b,0),size);
  assert.ok(writes.every(n=>n<=64*1024));
  assert.ok(writes.length>70);
  assert.equal(res.writableEnded,true);
  assert.equal(STORY_MEDIA_LIMIT_BYTES,32*1024*1024);
});

test('stream refuses unknown media and empty files',async()=>{
  const res={setHeader(){}};
  await assert.rejects(()=>streamStoryMedia(res,Buffer.alloc(20),'image/svg+xml'),/UNSUPPORTED_STORY_MEDIA/);
  await assert.rejects(()=>streamStoryMedia(res,Buffer.alloc(0),'image/jpeg'),/EMPTY_STORY_MEDIA/);
});

test('phone selector contains Russian, Armenian, Georgian and UAE dialing and accepts full international paste',()=>{
  const app=src('public/app.js');
  assert.match(app,/viewerPhoneCountry/);
  assert.match(app,/Россия · \+7/);
  assert.match(app,/Армения · \+374/);
  assert.match(app,/Грузия · \+995/);
  assert.match(app,/ОАЭ · \+971/);
  assert.match(app,/local\.startsWith\('\+'\) \? local : prefix \+ local/);
});

test('device polish loads after all other styles, protects iOS safe areas and foldable views',()=>{
  const html=src('public/studio.html');
  const css=src('public/veto-russian-mobile.css');
  assert.match(html,/veto-russian-mobile\.css/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/max-width:480px/);
  assert.match(css,/max-width:850px/);
  assert.match(css,/min-width:851px/);
  assert.match(css,/prefers-reduced-motion/);
});
