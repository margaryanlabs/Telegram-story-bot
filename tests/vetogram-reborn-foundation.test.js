import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const studio=read('public/studio.html');
const css=read('public/vetogram-reborn-foundation.css');

test('RB1 has exactly four visible primary destinations and preserves secondary routes',()=>{
  const nav=studio.match(/<nav class="bottom-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav,'primary navigation must exist');
  assert.match(nav,/data-reborn-nav="four"/);
  const destinations=[...nav.matchAll(/data-nav="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(destinations,['telegram','publish','media','privacy']);
  assert.match(studio,/id="profileButton"/);
  assert.match(studio,/data-screen="play"/);
  assert.match(studio,/data-screen="profile"/);
  assert.match(studio,/v6-world-play/);
});

test('RB1 foundation is preserved before the final Reborn CSS bundle',()=>{
  const styles=[...studio.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(styles.length>=30,'previous layers must not be silently deleted');
  const foundation=styles.indexOf('/vetogram-reborn-foundation.css?v=20261105-rb1');
  assert.ok(foundation>=0,'RB1 foundation must remain linked');
  assert.ok(styles.at(-1).startsWith('/vetogram-reborn-ui.css?v='),'RB12 is the last stylesheet');
  assert.ok(foundation<styles.length-1,'foundation must precede the bundled RB8–RB11 layers');
  assert.match(css,/#vetogram\.vetogram-noir \.screen\[data-screen="home"\]/);
  assert.match(css,/data-reborn-nav="four"/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/:not\(\[data-veto-theme="pearl"\]\)/);
  assert.match(css,/body:not\(\.veto-chat-active\):not\(\.veto-chat-thread\)/);
});

test('RB1 does not remove original main routes or private API boundary',()=>{
  for (const screen of ['telegram','publish','media','privacy','profile','play'])
    assert.ok(studio.includes('data-screen="'+screen+'"'),screen);
  const server=read('scripts/vetogram-preview-server.mjs');
  assert.match(server,/pathname\.startsWith\('\/api\/'\)/);
  assert.match(server,/handlePreviewMediaApi\(req,res/);
});
