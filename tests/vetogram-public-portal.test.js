import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePublicPortal,encodePublicPortal,makePublicPortalUrl,PORTAL_SHARE_LIFETIME} from '../public/story-portal-share.js';
import {newStoryDraft,normalizePortal} from '../public/story-engine-core.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const NOW=1792789200000;
const payload={type:'poll',title:'Голосуем: Երևանի Stories',description:'Выбери любимый вариант',options:['Ա', 'Б', 'C'],cta:'Ответить'};

test('public Portal link round trips multilingual text and expires after 30 days',()=>{
  const hash='#'+encodePublicPortal(payload,NOW);
  const result=decodePublicPortal(hash,NOW+1000);
  assert.equal(result.portal.title,payload.title);
  assert.deepEqual(result.portal.options,payload.options);
  assert.equal(result.expires,NOW+PORTAL_SHARE_LIFETIME);
  assert.throws(()=>decodePublicPortal(hash,NOW+PORTAL_SHARE_LIFETIME),/PORTAL_LINK_EXPIRED/);
});
test('share links do not capture owner identity, images, private chat or draft metadata',()=>{
  const draft=newStoryDraft({ownerId:'9988776655',id:'private-secret-id'});
  draft.imageDataUrl='data:image/png;base64,TOP_SECRET_PHOTO';
  draft.caption='PRIVATE_CAPTION_DATA';
  draft.portal=normalizePortal({type:'invite',title:'Birthday',description:'Saturday',cta:'Открыть'});
  const link=makePublicPortalUrl(draft.portal,'https://preview.example',NOW);
  assert.match(link,/^https:\/\/preview\.example\/portal\.html#p=/);
  const decoded=decodePublicPortal(new URL(link).hash,NOW);
  assert.equal(decoded.portal.title,'Birthday');
  const json=JSON.stringify(decoded);
  assert.doesNotMatch(json,/9988776655|TOP_SECRET_PHOTO|PRIVATE_CAPTION_DATA|private-secret-id|ownerId/);
  assert.doesNotMatch(link,/ownerId|imageBase64/);
});
test('public links reject malformed tokens, unknown version and unsafe origin',()=>{
  const link=makePublicPortalUrl(payload,'https://example.com',NOW);
  assert.equal(decodePublicPortal(new URL(link).hash,NOW).portal.type,'poll');
  for(const invalid of ['', '#p=!!', '#p=abc/', '#not-a-portal', '#p='+('a'.repeat(5100))])
    assert.throws(()=>decodePublicPortal(invalid,NOW),/PORTAL_LINK_INVALID/);
  assert.throws(()=>makePublicPortalUrl(payload,'http://example.com',NOW),/PORTAL_HTTPS_ORIGIN_REQUIRED/);
  assert.throws(()=>makePublicPortalUrl(payload,'javascript:alert(1)',NOW),/PORTAL_HTTPS_ORIGIN_REQUIRED|Invalid URL/);
});
test('public link exposes only validated HTTPS targets and bounded Portal fields',()=>{
  const v=normalizePortal({type:'links',title:'Ссылки',linksText:
    'Канал | https://t.me/example\nВторой | https://example.com'});
  const decoded=decodePublicPortal('#'+encodePublicPortal(v,NOW),NOW);
  assert.equal(decoded.portal.links.length,2);
  assert.equal(decoded.portal.links[0].url,'https://t.me/example');
  assert.throws(()=>encodePublicPortal({type:'offer',link:'javascript:alert(1)'},NOW),/HTTPS_LINK/);
  assert.throws(()=>encodePublicPortal({type:'offer',link:'http://example.org'},NOW),/HTTPS_LINK/);
  const long=normalizePortal({type:'offer',title:'A'.repeat(200),description:'B'.repeat(500)});
  assert.equal(decodePublicPortal('#'+encodePublicPortal(long,NOW),NOW).portal.title.length,90);
  assert.equal(decodePublicPortal('#'+encodePublicPortal(long,NOW),NOW).portal.description.length,300);
});
test('shareable Portal is an isolated static page with no data collection and CSP',()=>{
  const html=read('public/portal.html'),ui=read('public/story-portal-page.js'),css=read('public/story-portal-page.css');
  const config=JSON.parse(read('vercel.json'));
  assert.match(html,/id="publicPortalActions"/);
  assert.match(html,/type="module" src="\/story-portal-page\.js/);
  assert.match(ui,/decodePublicPortal\(window\.location\.hash\)/);
  assert.match(ui,/не отправляются и не сохраняются/);
  assert.match(ui,/noopener noreferrer/);
  assert.doesNotMatch(ui,/innerHTML|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(css,/portal-shell/);
  const header=config.headers.find(x=>x.source==='/portal.html');
  assert.ok(header);
  assert.ok(header.headers.some(x=>x.key==='Content-Security-Policy'&&x.value.includes("connect-src 'none'")));
  assert.ok(header.headers.some(x=>x.key==='Referrer-Policy'&&x.value==='no-referrer'));
});
test('sharing requires explicit action and never touches protected Telegram publisher or Vault',()=>{
  const editor=read('public/story-engine.js'),html=read('public/studio.html');
  const pkg=JSON.parse(read('package.json'));
  assert.match(editor,/window\.confirm\('Создать публичную ссылку/);
  assert.match(editor,/makePublicPortalUrl\(portal,window\.location\.origin\)/);
  assert.match(editor,/navigator\.clipboard/);
  assert.match(editor,/requireOwner\(\)/);
  assert.match(html,/id="sePortalCreateLink"/);
  assert.match(html,/id="sePortalPublicLink"/);
  assert.match(html,/без фотографий, сообщений или данных Telegram/);
  assert.match(pkg.scripts.check,/story-portal-page\.js/);
  assert.doesNotMatch(editor,/\/api\/portal|publish_story\(.*portal/);
});
