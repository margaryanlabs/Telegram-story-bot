
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STORY_TEMPLATES,PORTAL_TYPES,RETENTION_DAYS,newStoryDraft,
 normalizeDraft,normalizePortal,remixDraft,draftFromBrief,isExpired,safeExternalUrl,templateById} from '../public/story-engine-core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Story Engine comes with 10 original 9:16 templates and five Portal models',()=>{
  assert.equal(STORY_TEMPLATES.length,10);
  assert.equal(new Set(STORY_TEMPLATES.map(t=>t.id)).size,10);
  assert.equal(PORTAL_TYPES.length,5);
  for(const t of STORY_TEMPLATES)assert.match(t.start,/^#[0-9a-f]{6}$/i);
  assert.equal(templateById('missing').id,'noir');
});
test('all story drafts require a real owner ID and preserve selected retention',()=>{
  assert.throws(()=>newStoryDraft({ownerId:''}),/TELEGRAM_OWNER_REQUIRED/);
  const d=newStoryDraft({ownerId:'123',now:1000,id:'draft-1'});
  d.title='A very important moment';d.retentionDays=90;
  const back=normalizeDraft(d,'123',2000);
  assert.equal(back.title,d.title);assert.equal(back.retentionDays,90);
  assert.equal(back.ownerId,'123');assert.equal(back.id,'draft-1');
  assert.equal(back.branding,false,'watermark is opt-in, never forced');
  assert.equal(back.textY,d.textY);assert.equal(back.fontSize,51);
  assert.throws(()=>normalizeDraft(d,'456'),/DRAFT_OWNER_MISMATCH/);
  assert.deepEqual(RETENTION_DAYS,[7,30,90,180,365]);
});
test('expired drafts are removed by age only when client loads its own vault',()=>{
  const d=newStoryDraft({ownerId:'123',now:1000,id:'expire'});
  d.retentionDays=7;
  assert.equal(isExpired(d,1000+7*86400000-1),false);
  assert.equal(isExpired(d,1000+7*86400000),true);
});
test('Portal rejects scripts, plaintext links and credentials while retaining HTTPS',()=>{
  assert.equal(safeExternalUrl('javascript:alert(1)'),'');
  assert.equal(safeExternalUrl('http://example.com'),'');
  assert.equal(safeExternalUrl('https://user:pass@example.com'),'');
  assert.equal(safeExternalUrl('https://example.com/invite'),'https://example.com/invite');
  assert.throws(()=>normalizePortal({type:'offer',link:'javascript:alert(1)'}),/HTTPS_LINK/);
  const portal=normalizePortal({type:'invite',title:'VETO',description:'Join us',link:'https://example.com',cta:'Open'});
  assert.equal(portal.title,'VETO');assert.equal(portal.link,'https://example.com/');
});
test('Remix never copies another owner or private image or existing Portal',()=>{
  const mine=newStoryDraft({ownerId:'123',id:'first',now:100});
  mine.remixable=true;mine.imageDataUrl='data:image/png;base64,AAAA';
  mine.portal=normalizePortal({type:'links',title:'Link',link:'https://example.com'});
  assert.throws(()=>remixDraft(mine,'456'),/OWNER_MISMATCH/);
  const copy=remixDraft(mine,'123',{id:'copy',now:200});
  assert.equal(copy.id,'copy');assert.equal(copy.ownerId,'123');
  assert.equal(copy.imageDataUrl,'');assert.equal(copy.portal,null);
  assert.equal(copy.templateId,mine.templateId);
  assert.throws(()=>remixDraft({...mine,remixable:false},'123'),/NOT_ALLOWED/);
});
test('offline brief helper is deterministic and does not pretend to generate AI media',()=>{
  const d=draftFromBrief('Birthday party', '123',{id:'idea',now:200});
  assert.equal(d.templateId,'birthday');
  assert.equal(d.imageDataUrl,'');
  assert.match(d.subtitle,/Birthday party/);
  assert.equal(d.ownerId,'123');
});
test('the real VETOGRAM Mini App integrates a new screen but keeps the legacy Stories publisher',()=>{
  const html=read('public/studio.html');
  const app=read('public/app.js');
  const ui=read('public/story-engine.js');
  assert.match(html,/data-screen="story-engine"/);
  assert.match(html,/id="seCanvas" width="540" height="960"/);
  assert.match(html,/type="module" src="\/story-engine\.js/);
  assert.match(html,/id="storyFileInput"/);
  assert.match(app,/'story-engine':'story-engine'/);
  assert.match(app,/'story-engine':'studio'/);
  assert.match(ui,/window\.VetoTelegramNavigate\?\.\('publish'\)/);
  assert.match(ui,/new DataTransfer\(\)/);
  assert.match(ui,/input\.dispatchEvent\(new Event\('change'/);
  assert.doesNotMatch(ui,/publish_story|TELEGRAM_BOT_TOKEN|sendMessage\(/);
});
test('Portal is visibly a local-only preview, not a falsely live public URL',()=>{
  const html=read('public/studio.html'),ui=read('public/story-engine.js');
  assert.match(html,/не публичная ссылка/);
  assert.match(html,/не кликабельная ссылка Telegram/);
  assert.match(ui,/Публичной ссылки пока нет/);
  assert.match(ui,/ownerId===state.owner/);
  assert.match(read('public/story-engine-core.js'),/data:image/);
});


test('slow photo decoding and export never carry an old Telegram owner into a new identity',()=>{
  const ui=read('public/story-engine.js');
  assert.match(ui,/sourceOwner=state\.owner,sourceId=state\.draft\.id/);
  assert.match(ui,/state\.owner!==sourceOwner \|\| owner\(\)!==sourceOwner/);
  assert.match(ui,/selectedOwner=state\.owner,selectedDraftId=state\.draft\.id/);
  assert.match(ui,/owner\(\)!==selectedOwner \|\| state\.owner!==selectedOwner/);
  assert.match(ui,/exportOwner=state\.owner,exportDraftId=state\.draft\.id/);
  assert.match(ui,/Аккаунт или черновик изменился/);
  assert.match(ui,/if\(state\.owner!=='0'\)/);
  assert.match(ui,/window\.addEventListener\('focus'/);
});

test('asynchronous photo, draft, and export flows never cross Telegram identities',()=>{
  const ui=read('public/story-engine.js');
  assert.match(ui,/state\.draft\?\.id!==d\.id/);
  assert.match(ui,/state\.owner!==requestedOwner \|\| d\.ownerId!==requestedOwner/);
  assert.match(ui,/reader\.onload=[\s\S]*?owner\(\)!==selectedOwner/);
  assert.match(ui,/toBlob\(resolve,'image\/jpeg',[\s\S]*?owner\(\)!==exportOwner/);
  assert.match(ui,/if\(state\.owner!=='0'\)\{/);
  assert.match(ui,/pageshow/);
});
