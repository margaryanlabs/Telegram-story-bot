import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const html=read('public/cinema.html');
const css=read('public/cinema.css');
const script=read('public/cinema.js');
const catalog=read('public/cinema-catalog.js');

test('standalone cinema entrypoint and assets exist, no Lovable runtime',()=>{
  assert.match(html,/<html lang="ru">/);
  assert.match(html,/cinema-catalog\.js/);
  assert.match(html,/cinema\.js/);
  assert.match(html,/veto-telegram-mark\.svg/);
  assert.doesNotMatch(html,/lovable\.app|iframe[^>]+kinogo/i);
  assert.match(css,/--accent:#fa7562/);
  assert.match(css,/--bg:#090d18/);
});
test('all static ID bindings exist in the Cinema HTML',()=>{
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const codeIds=new Set([...script.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]));
  for(const id of codeIds)assert.ok(ids.has(id),'Missing DOM ID: '+id);
  for(const id of ['cinemaVideo','cinemaQuality','cinemaAudio','cinemaGrid','cinemaDetails','cinemaPlayer'])assert.ok(ids.has(id),id);
});
test('standalone Javascript syntax is accepted by Node',()=>{
  for(const f of ['public/cinema.js','public/cinema-catalog.js']){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',resolve(root,f)],{stdio:'pipe'}),f);
  }
});
test('catalog contains unique true films with direct Commons filenames and verified attribution sources',()=>{
  const ctx={window:{}};
  vm.runInNewContext(catalog,ctx,{filename:'cinema-catalog.js'});
  const f=ctx.window.VetogramCinemaCatalog;
  assert.ok(Array.isArray(f)&&f.length>=15);
  assert.equal(new Set(f.map(x=>x.id)).size,f.length);
  for(const x of f){
    assert.ok(x.id&&x.title&&x.original&&x.creator);
    assert.ok(x.license&&/^https:\/\//.test(x.licenseUrl));
    if(x.player) {
      assert.ok(/^https:\/\/rutube\.ru\/play\/embed\/[a-f0-9]{32}$/.test(x.player.url));
      assert.ok(/^https:\/\/rutube\.ru\/video\/[a-f0-9]{32}\/$/.test(x.sourcePage));
      assert.equal(x.player.type,'iframe');
      assert.equal(x.player.licensed,true);
      assert.equal(x.spoken,'Русский');
      assert.ok(x.player.credit&&x.player.license);
    } else {
      assert.ok(/^https:\/\/creativecommons\.org\//.test(x.licenseUrl));
      assert.ok(/^https:\/\//.test(x.site));
      assert.ok(/\.(webm|ogv)$/.test(x.file),x.file);
    }
    assert.deepEqual(Array.from(x.editions),[],'no imaginary dubbed streams');
  }
});
test('cinema contains honest licensed media handling and no piracy domains',()=>{
  assert.match(script,/action:"query"/);
  assert.match(script,/prop:"videoinfo"/);
  assert.match(script,/action:"timedtext"/);
  assert.match(script,/lang:"ru"/);
  assert.match(script,/getCommons/);
  assert.match(script,/localStorage/);
  assert.match(script,/requestPictureInPicture/);
  assert.match(script,/quality|Quality|cinemaQuality/);
  assert.match(script,/VetogramCinemaProvider\.attach/);
  assert.match(html,/cinema-provider\.js/);
  assert.match(html,/id="cinemaVideoWrap"/);
  assert.doesNotMatch(script+catalog,/kinogo|hdrezka|baskino|lostfilm|rutor|torrents?/i);
});
