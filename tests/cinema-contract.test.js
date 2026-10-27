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
const provider=read('public/cinema-provider.js');

test('standalone cinema entrypoint and assets exist, no Lovable runtime',()=>{
  assert.match(html,/<html lang="ru">/);
  assert.match(html,/cinema-catalog\.js/);
  assert.match(html,/cinema-artwork\.js/);
  assert.match(html,/id="cinemaOpenSource"/);
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
  for(const f of ['public/cinema.js','public/cinema-catalog.js','public/cinema-provider.js','public/cinema-artwork.js']){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',resolve(root,f)],{stdio:'pipe'}),f);
  }
});
test('catalog contains unique true films with direct Commons filenames and verified attribution sources',()=>{
  const ctx={window:{}};
  vm.runInNewContext(catalog,ctx,{filename:'cinema-catalog.js'});
  const f=ctx.window.VetogramCinemaCatalog;
  assert.ok(Array.isArray(f)&&f.length>=20);
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

test('official RUTUBE player adapter validates rights metadata and rejects unsafe embeds',()=>{
  const context={window:{},URL};
  vm.runInNewContext(provider,context,{filename:'cinema-provider.js'});
  const adapter=context.window.VetogramCinemaProvider;
  assert.ok(adapter);
  assert.equal(adapter.detectType({url:'https://licensed.example/movie/playlist.m3u8'}),'hls');
  assert.equal(adapter.detectType({type:'iframe',url:'https://rutube.ru/play/embed/xyz'}),'iframe');
  assert.throws(()=>adapter.assertAuthorized({url:'https://rutube.ru/play/embed/test'}),/не подтверждён/);
  assert.throws(()=>adapter.assertAuthorized({url:'http://rutube.ru/play/embed/test',licensed:true,license:'ok',credit:'ok'}),/HTTPS/);
  assert.equal(adapter.assertAuthorized({url:'https://rutube.ru/play/embed/test',licensed:true,license:'ok',credit:'ok'}).licensed,true);
});

test('two verified official Lenfilm films are present in offline seed',()=>{
 const ctx={window:{}};vm.runInNewContext(catalog,ctx);
 const films=ctx.window.VetogramCinemaCatalog;
 for(const id of ['lenfilm-old-hottabych','lenfilm-wedding-malinovka']){
   const film=films.find(x=>x.id===id);
   assert.ok(film,'missing '+id);
   assert.match(film.sourcePage,/^https:\/\/rutube\.ru\/video\/[a-f0-9]{32}\/$/);
   assert.equal(film.spoken,'Русский');
 }
});

test('premium Russian movies shelf and approved source selector stay wired',()=>{
 assert.match(html,/id="cinemaRussian"/);
 assert.match(html,/id="cinemaRussianRail"/);
 assert.match(html,/id="cinemaProviderSelect"/);
 assert.match(html,/id="cinemaSourceSwitch"/);
 assert.match(script,/fetchApprovedSources/);
 assert.match(script,/approvedSources/);
 assert.match(script,/\/sources/);
 assert.match(script,/function sourceLabel/);
 assert.match(css,/cinema-russian-rail/);
 assert.match(css,/cinema-source-switch/);
});

test('provider fallback never traps viewer behind a modal overlay',()=>{
 assert.match(script,/providerFeedbackTimer/);
 assert.match(script,/cinemaOpenSource/);
 assert.match(script,/cinemaPlayerMessage/);
 assert.match(css,/\.cinema-loading\.is-provider/);
 assert.match(css,/pointer-events:none/);
 assert.match(html,/Открыть видео у источника/);
});
