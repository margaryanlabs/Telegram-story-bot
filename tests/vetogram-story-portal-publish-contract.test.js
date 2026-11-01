/* V4.6: actual public Portal codec versus server-side Story validator.
 * These tests do NOT publish to Telegram or connect a real Business account.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makePublicPortalUrl,decodePublicPortal} from '../public/story-portal-share.js';
import {validateStoryPortalLink,buildPortalStoryArea,PORTAL_STORY_MAX_URL_LENGTH}
  from '../lib/story-portal-media-area.js';

const example={
  type:'offer',title:'Открытие коллекции',
  description:'Новый выпуск уже доступен.',cta:'Подробнее'
};

test('client-generated Portal URL is accepted by actual server validator',()=>{
  const url=makePublicPortalUrl(example,'https://vetogram.test');
  assert.ok(url.length<=PORTAL_STORY_MAX_URL_LENGTH);
  assert.equal(validateStoryPortalLink(url,{host:'vetogram.test'}),url);
  const parsed=decodePublicPortal(new URL(url).hash);
  assert.equal(parsed.portal.title,example.title);
  const area=buildPortalStoryArea(url);
  assert.equal(area.length,1);
  assert.equal(area[0].type.type,'link');
  assert.equal(area[0].type.url,url);
});
test('no cross-site, HTTP, query, credentials or arbitrary paths allowed',()=>{
  const url=makePublicPortalUrl(example,'https://vetogram.test');
  const invalid=[
    url.replace('vetogram.test','attacker.test'),
    url.replace('https:','http:'),
    url.replace('/portal.html','/login.html'),
    url.replace('#p=','?s=1#p='),
    url.replace('https://','https://alice:secret@'),
  ];
  for(const item of invalid)
    assert.throws(()=>validateStoryPortalLink(item,{host:'vetogram.test'}));
  assert.deepEqual(buildPortalStoryArea(null),[]);
});
test('server rejects oversized URL and an expired public Portal',()=>{
  const old=makePublicPortalUrl(example,'https://vetogram.test',Date.now()-32*86400000);
  assert.throws(()=>validateStoryPortalLink(old,{host:'vetogram.test'}),
    /STORY_PORTAL_LINK_INVALID_OR_EXPIRED/);
  const url=makePublicPortalUrl(example,'https://vetogram.test');
  const tooLong=url+'q'.repeat(PORTAL_STORY_MAX_URL_LENGTH);
  assert.throws(()=>validateStoryPortalLink(tooLong,{host:'vetogram.test'}),
    /STORY_PORTAL_LINK_TOO_LONG/);
});
test('publisher and server agree on explicit standard Business audience',()=>{
  const server=readFileSync(new URL('../api/miniapp.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(server,/if \(settings\.audience !== 'standard' \|\| !canPublishBusiness\)/);
  assert.match(server,/portalLink = validateStoryPortalLink\(body\.portalLink/);
  assert.match(server,/portalAreaAttached: Boolean\(portalLink && story\.transport === 'bot-api'\)/);
  assert.match(app,/if\(attachPortal && state\.audience!=='standard'\)/);
  assert.match(app,/if\(attachPortal && state\.businessPermissions\?\.stories!==true\)/);
});
