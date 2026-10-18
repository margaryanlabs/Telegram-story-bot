import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  normalizeContactStories,stealthStatus,requireStealth,
  STORY_MEDIA_LIMIT_BYTES,
} from '../lib/telegram-contact-stories.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const now=1800000000;
const user=(id,extra={})=>({id:BigInt(id),firstName:'Мария',contact:true,...extra});
const photo={className:'MessageMediaPhoto',photo:{}};
const story=(id,createdAt=now-30)=>({
  className:'StoryItem',id,date:createdAt,expireDate:now+3600,
  media:photo,caption:'Привет',closeFriends:false,
});
test('only Telegram-visible real contacts appear, no fabricated or expired stories',()=>{
  const entries=[
    {peer:{userId:1n},stories:[story(1),story(2)]},
    {peer:{userId:2n},stories:[story(3)]},
    {peer:{userId:3n},stories:[story(4)]},
    {peer:{userId:4n},stories:[{...story(5),expireDate:now-10}]},
    {peer:{channelId:8n},stories:[story(6)]},
    {peer:{userId:1n},stories:[{...story(7),className:'StoryItemDeleted'}]},
  ];
  const result=normalizeContactStories({users:[
    user(1),user(2,{contact:false}),user(3,{bot:true}),user(4),
  ],peerStories:entries},now);
  assert.equal(result.length,1);
  assert.equal(result[0].userId,'1');
  assert.equal(result[0].stories.length,2);
  assert.deepEqual(result[0].stories.map(s=>s.id),[1,2]);
  assert.equal(result[0].name,'Мария');
  assert.ok(!JSON.stringify(result).includes('accessHash'));
});

test('stealth fail-closed with safety window, cooldown and Telegram activation state',()=>{
  assert.equal(stealthStatus({activeUntilDate:now+500,cooldownUntilDate:now+300},now).active,true);
  assert.equal(stealthStatus({activeUntilDate:now+20,cooldownUntilDate:now+300},now).active,false);
  assert.equal(stealthStatus({activeUntilDate:now+20,cooldownUntilDate:now+300},now).canActivate,false);
  assert.equal(stealthStatus(null,now).active,false);
  assert.equal(requireStealth({activeUntilDate:now+120},now).active,true);
  assert.throws(()=>requireStealth({activeUntilDate:now+89,cooldownUntilDate:now+700},now),
    /STEALTH_NOT_CONFIRMED/);
});

test('backend authenticates Telegram owner and never silently reports story reads',()=>{
  const api=source('api/telegram-stories.js');
  assert.match(api,/validateTelegramMiniApp/);
  assert.match(api,/verifyTelegramClientOwner\(client,ownerId\)/);
  assert.match(api,/sameTelegramAccount/);
  assert.match(api,/getViewerSession/);
  assert.match(api,/requireStealth/);
  assert.match(api,/ActivateStealthMode/);
  assert.match(api,/GetAllStories/);
  assert.match(api,/GetStoriesByID/);
  assert.ok(api.indexOf('ensureStealth(client,snapshot.stealthMode)')<
    api.indexOf('downloadContactStory(client,story,user)'));
  assert.doesNotMatch(api,/new Api\.stories\.(ReadStories|IncrementStoryViews)/);
  assert.ok(STORY_MEDIA_LIMIT_BYTES<=4*1024*1024);
  assert.match(api,/private, no-store/);
});

test('stories are wired into the existing chat page, not a second app',()=>{
  const html=source('public/studio.html'),ui=source('public/telegram-stories.js');
  assert.match(html,/telegram-stories\.css/);
  assert.match(html,/telegram-stories\.js/);
  assert.match(ui,/\.veto-mirror-heading/);
  assert.match(ui,/loadStories\(/);
  assert.match(ui,/data-veto-story-person/);
  assert.match(ui,/closeViewer\(/);
  assert.match(ui,/X-Telegram-Init-Data/);
  assert.match(ui,/x-veto-stealth-until/);
  assert.doesNotMatch(ui,/localStorage|sessionStorage/);
  assert.doesNotMatch(ui,/sendReaction|incrementStoryViews|readStories/);
});
