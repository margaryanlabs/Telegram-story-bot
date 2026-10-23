import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AI_MODES,normalizeAiInput,normalizeAiOutput,systemInstruction}
  from '../lib/vetogram-ai-core.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('AI assistant has bounded modes, prompt and client-supplied history only',()=>{
  assert.deepEqual(AI_MODES,['chat','translate','reply','story','campaign']);
  assert.throws(()=>normalizeAiInput({mode:'autopilot',prompt:'send everything'}),/AI_MODE_INVALID/);
  assert.throws(()=>normalizeAiInput({mode:'chat',prompt:'x'}),/AI_PROMPT_REQUIRED/);
  const input=normalizeAiInput({mode:'chat',prompt:'x'.repeat(4500),
    history:Array.from({length:15},(_,i)=>({role:i%2?'assistant':'user',text:'T'.repeat(1000)}))});
  assert.equal(input.prompt.length,3000);
  assert.equal(input.history.length,6);
  assert.ok(input.history.every(r=>r.text.length<=800));
  assert.match(systemInstruction('chat'),/cannot read, send, schedule or publish/);
});
test('Story AI responses are typed, truncated and cannot contain fake actions',()=>{
  const obj=normalizeAiOutput('story','{"title":"A","subtitle":"B","caption":"C"}');
  assert.deepEqual(obj.story,{title:'A',subtitle:'B',caption:'C'});
  assert.throws(()=>normalizeAiOutput('story','not json'),/AI_STORY_FORMAT_INVALID/);
  assert.throws(()=>normalizeAiOutput('story','{"title":"","subtitle":""}'),/AI_STORY_FORMAT_INVALID/);
  const campaign=normalizeAiOutput('campaign',JSON.stringify({title:'Sale',subtitle:'Offer',caption:'Now',portal:{type:'offer',title:'Buy',description:'Details',cta:'Открыть'}}));
  assert.equal(campaign.portal.type,'offer');
  assert.throws(()=>normalizeAiOutput('campaign',JSON.stringify({title:'Sale',subtitle:'Offer',portal:{type:'unknown'}})),/AI_PORTAL_FORMAT_INVALID/);
  const plain=normalizeAiOutput('reply','Reply yes');
  assert.equal(plain.story,undefined);
  assert.equal(plain.text,'Reply yes');
});
test('Hobby router preserves existing Telegram endpoints and registers AI',()=>{
  const src=read('api/router.js');
  assert.match(src,/"telegram-send": \(\) => import/);
  assert.match(src,/"telegram-chats": \(\) => import/);
  assert.match(src,/"vetogram-ai": \(\) => import/);
  assert.match(src,/"viewer-sync": \(\) => import/);
});
test('AI endpoint never sends messages or fetches Telegram dialogs',()=>{
  const src=read('api/vetogram-ai.js');
  assert.match(src,/validateTelegramMiniApp/);
  assert.match(src,/x-vetogram-ai-consent/);
  assert.match(src,/VETOGRAM_AI_ENABLED/);
  assert.match(src,/private, no-store/);
  assert.doesNotMatch(src,/sendOwnerMessage|withBackupClient|client\.getDialogs|getViewerSession/);
  assert.match(src,/requiresOwnerApproval:true/);
});
test('AI UI requires reviewed send, and Story Engine is review-only',()=>{
  const ui=read('public/studio.html'),client=read('public/vetogram-ai.js'),story=read('public/story-engine.js');
  assert.match(ui,/data-screen="ai"/);
  assert.match(ui,/id="vtaiConsent"/);
  assert.match(ui,/id="vtaiApplyStory"/);
  assert.match(ui,/data-ai-mode="story"/);
  assert.match(ui,/data-vtai-mode="campaign"/);
  assert.match(ui,/id="vtaiReplacePortal"/);
  assert.match(story,/normalizePortal\(\{/);
  assert.match(client,/window\.confirm\(/);
  assert.match(client,/crypto\.randomUUID/);
  assert.match(client,/action:'send_message'/);
  assert.match(client,/VetoTelegramApplyAiStory/);
  assert.match(story,/vetogram:ai-story-suggestion/);
  assert.match(story,/owner\(\)!==requestedOwner/);
  assert.match(story,/state\.draft\.caption=trimText/);
  assert.match(story,/function exportToPublisher/);
  assert.doesNotMatch(client,/autoSend|backgroundSend|setInterval\(/);
});
test('AI screen wiring and syntax check integrated into project',()=>{
  const app=read('public/app.js'),pkg=JSON.parse(read('package.json'));
  assert.match(app,/ai: 'ai'/);
  assert.match(app,/ai:'home'/);
  assert.match(pkg.scripts.check,/node --check public\/vetogram-ai\.js/);
});
