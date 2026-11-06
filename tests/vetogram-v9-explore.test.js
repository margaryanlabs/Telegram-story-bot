/* V9 editorial navigation source contracts. Does not use network, secrets or Telegram. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const edition='20261106-v9-03';
const screens=['studio','cinema','books','music-module'];

test('V9 explore assets exist, parse and respect reduced motion',()=>{
  assert.ok(existsSync(new URL('../public/vetogram-v9-explore.js',import.meta.url)));
  const js=read('public/vetogram-v9-explore.js');
  const css=read('public/vetogram-v9-explore.css');
  assert.doesNotThrow(()=>new Function(js));
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/v9-arcade-launch\[hidden\]/);
  assert.match(css,/v9-arcade-active #vpQuickGames/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|postMessage|TELEGRAM_BOT_TOKEN/);
});

test('Every source shell mounts a single, cache-consistent V9 navigation',()=>{
  for(const name of screens){
    const html=read('public/'+name+'.html');
    assert.equal((html.match(/<script[^>]+vetogram-v9-explore\.js\?/g)||[]).length,1,name+' JS');
    assert.equal((html.match(/<link[^>]+vetogram-v9-explore\.css\?/g)||[]).length,1,name+' CSS');
    const assets=[...html.matchAll(/(?:src|href)=["']((?:\/|\.\/)[^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)]
      .map(match=>match[1]);
    assert.ok(assets.length>5,name+' linked assets');
    for(const asset of assets)assert.ok(asset.endsWith('?v='+edition),
      name+' mixed or uncached: '+asset);
  }
});

test('Native Games remain six offline controllers and have one catalog',()=>{
  const html=read('public/studio.html');
  const css=read('public/vetogram-v9-explore.css');
  const js=read('public/vetogram-v9-explore.js');
  const expected=['reaction','pairs','tic','2048','mines','snake'];
  for(const id of expected){
    assert.match(html,new RegExp('data-v9-launch="'+id+'"'));
    assert.match(html,new RegExp('data-vp-game="'+id+'"'));
  }
  assert.equal((html.match(/data-v9-launch="/g)||[]).length,6);
  assert.match(js,/v9-arcade-filter-tabs/);
  assert.match(js,/aria-pressed/);
  assert.match(css,/not\(\.v9-arcade-active\) #vpQuickGames/);
  assert.match(css,/\.vp-mini\[hidden\]/);
});

test('Cinema and Books use their real native controllers and single media dock',()=>{
  const js=read('public/vetogram-v9-explore.js');
  const cinema=read('public/cinema.html');
  const books=read('public/books.html');
  assert.match(js,/\.v79-media-switcher/);
  assert.match(js,/\.cinema-section-nav/);
  assert.match(cinema,/id="cinemaTabs"/);
  assert.match(cinema,/id="cinemaHero"/);
  assert.match(books,/id="reader"/);
  assert.match(books,/id="bookSearch"/);
});
