import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  calculatePhotoPinch, applyStoryTemplate, newStoryDraft
} from '../public/story-engine-core.js';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const start={zoom:1,photoX:0,photoY:0,distance:100,centerX:150,centerY:220};

test('photo pinch zooms boundedly inside the real 9:16 editor',()=>{
  const normal=calculatePhotoPinch(start,{x:50,y:220},{x:250,y:220},300,530);
  assert.equal(normal.photoZoom,2);
  assert.equal(normal.photoX,0);
  assert.equal(normal.photoY,0);
  const maximum=calculatePhotoPinch(start,{x:-500,y:220},{x:800,y:220},300,530);
  assert.equal(maximum.photoZoom,2.5);
  const minimum=calculatePhotoPinch({...start,zoom:2}, {x:140,y:220},{x:160,y:220},300,530);
  assert.equal(minimum.photoZoom,1);
  assert.equal(minimum.photoX,0);
  assert.equal(minimum.photoY,0);
});

test('photo pan uses two-finger center and clamps against extreme moves',()=>{
  const baseline={...start,zoom:1.5};
  const moved=calculatePhotoPinch(baseline,{x:130,y:235},{x:230,y:235},300,530);
  assert.ok(moved.photoX>0);
  assert.ok(moved.photoY>0);
  const clamped=calculatePhotoPinch(baseline,{x:10000,y:-3000},{x:10100,y:-3000},300,530);
  assert.equal(clamped.photoX,1);
  assert.equal(clamped.photoY,-1);
});

test('invalid gestures cannot introduce NaN or infinite photo transformations',()=>{
  assert.throws(()=>calculatePhotoPinch(null,{x:0,y:0},{x:1,y:1},300,530),/STORY_GESTURE_INVALID/);
  assert.throws(()=>calculatePhotoPinch(start,{x:0,y:0},{x:1,y:1},0,530),/STORY_GESTURE_INVALID/);
  assert.throws(()=>calculatePhotoPinch(start,{x:NaN,y:0},{x:1,y:1},300,530),/STORY_GESTURE_INVALID/);
  assert.throws(()=>calculatePhotoPinch(start,{x:0,y:0},{x:1,y:1},300,Infinity),/STORY_GESTURE_INVALID/);
});

test('gesture wiring preserves original owner, image, layer and undo paths',()=>{
  const engine=read('story-engine.js');
  for(const text of [
    "canvas.addEventListener('pointermove'",
    'calculatePhotoPinch(g,a,b,rect.width,rect.height)',
    "historyGroup='';checkpoint();",
    'owner()!==g.owner',
    'state.draft?.id!==g.draftId',
    'photoPointers.size===2',
    'activePhotoGesture',
    "canvas.addEventListener('dblclick'",
    "'vetogram:story-layer-selected'"
  ])assert.ok(engine.includes(text),text);
  const model=newStoryDraft({ownerId:'123',id:'private-draft'});
  const changed=applyStoryTemplate({...model,imageDataUrl:'data:image/png;base64,AAAA'},'voyage');
  assert.equal(changed.ownerId,'123');
  assert.equal(changed.imageDataUrl,'data:image/png;base64,AAAA');
});

test('thread menu is real native disclosure and preserves existing action handlers',()=>{
  const experience=read('vetogram-experience-v4.js');
  const html=read('studio.html');
  assert.match(experience,/threadBar\.querySelector\('\[data-open-screen="ai"\]'\)/);
  assert.match(experience,/byId\('telegramThreadReplyAI'\)/);
  assert.match(experience,/byId\('telegramThreadBriefAI'\)/);
  assert.match(experience,/byId\('telegramThreadRefresh'\)/);
  assert.match(experience,/tools\.append\(button\)/);
  assert.match(experience,/threadView\.hidden/);
  assert.match(experience,/vetogram:story-layer-selected/);
  assert.match(html,/id="telegramThreadSearchToggle"/);
  assert.match(html,/id="telegramThreadBack"/);
});

test('selected-message AI draft retains user confirmation and owner checks',()=>{
  const chats=read('telegram-chats.js');
  const actions=read('vetogram-chat-experience-v4.js');
  const part=chats.split('window.VetoTelegramPrepareSelectedAiReply = messageId => {')[1]?.split('\n  };')[0];
  assert.ok(part,'AI callback is actually defined');
  assert.match(part,/Number\.isSafeInteger\(id\)/);
  assert.match(part,/!message\|\|message\.out\|\|message\.deleted\|\|message\.preservedOnly/);
  assert.match(part,/window\.confirm/);
  assert.match(part,/signed!==String\(tg\?\.initData\|\|''\)/);
  assert.match(part,/generation!==state\.threadGeneration/);
  assert.match(part,/vetogram:ai-prefill/);
  assert.doesNotMatch(part,/\bfetch\s*\(/);
  assert.doesNotMatch(part,/\/api\//);
  assert.match(actions,/VetoTelegramPrepareSelectedAiReply/);
  assert.match(actions,/buttons\.ai\.disabled/);
});
