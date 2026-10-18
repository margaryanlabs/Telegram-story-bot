import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function deliveryHarness(){
  const ui=read('public/telegram-chats.js');
  const start=ui.indexOf('function renderDeliveryStatus(){');
  const end=ui.indexOf('function threadNotice(',start);
  assert.ok(start>=0 && end>start);
  const nodes=new Map(['telegramThreadDeliveryStatus','telegramThreadDeliveryText','telegramThreadDeliveryIcon']
    .map(id=>[id,{hidden:true,dataset:{},textContent:'',
      removeAttribute(name){if(name==='data-state')delete this.dataset.state;}}]));
  const env={nodes,state:{thread:{id:'12'},ownerInitData:'account-one',deliveryStage:null},
    tg:{initData:'account-one'}};
  const source='const state=env.state,tg=env.tg,$=id=>env.nodes.get(id);\n'+
    ui.slice(start,end)+'\nthis.renderDeliveryStatus=renderDeliveryStatus;this.setDeliveryStatus=setDeliveryStatus;';
  const sandbox={env};
  runInNewContext(source,sandbox);
  return {...sandbox,env};
}

test('delivery widget never claims read receipts and rejects stale owner/chat',()=>{
 const {env,setDeliveryStatus,renderDeliveryStatus}=deliveryHarness();
 setDeliveryStatus('accepted','12','voice');
 assert.equal(env.nodes.get('telegramThreadDeliveryStatus').hidden,false);
 assert.match(env.nodes.get('telegramThreadDeliveryText').textContent,/не означает.*прочитано/);
 setDeliveryStatus('uncertain','12','voice');
 assert.match(env.nodes.get('telegramThreadDeliveryText').textContent,/Проверь оригинальный Telegram/);
 const last=env.state.deliveryStage;
 setDeliveryStatus('accepted','99','voice');
 assert.equal(env.state.deliveryStage,last);
 env.tg.initData='account-two';
 renderDeliveryStatus();
 assert.equal(env.nodes.get('telegramThreadDeliveryStatus').hidden,true);
});

test('photo lightbox only opens owner-scoped blob URLs already fetched in this tab',()=>{
 const ui=read('public/telegram-chats.js');
 const html=read('public/studio.html');
 const css=read('public/chat-media.css');
 const viewer=ui.slice(ui.indexOf('function photoButtonMarkup('),ui.indexOf('function inlineImage('));
 assert.match(viewer,/resetOwner\(\)/);
 assert.match(viewer,/state\.mediaPreviewUrls\.get\(String\(messageId\)\)/);
 assert.match(viewer,/state\.mediaUrls\.includes\(href\)/);
 assert.match(viewer,/href\.startsWith\('blob:'\)/);
 assert.match(viewer,/showModal\(/);
 assert.match(ui,/closePhotoViewer\(\);\s*state\.ownerInitData=current/);
 assert.match(ui,/function revokeMediaUrls\(\)\{\s*closePhotoViewer\(\)/);
 assert.match(html,/id="telegramThreadPhotoDialog"/);
 assert.match(html,/id="telegramThreadPhotoSave"/);
 assert.match(css,/\.veto-mirror-photo-dialog::backdrop/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(html,/chat-media\.css\?v=20261018-inline-media-v6/);
});

test('saved and live audio is listened to in chat without implicit downloads',()=>{
 const ui=read('public/telegram-chats.js');
 const section=ui.slice(ui.indexOf('async function openArchivedFile('),ui.indexOf('function visibleMessageAnchor('));
 assert.match(section,/mime\.startsWith\('audio\/'\)/);
 assert.match(section,/blob\.type\.startsWith\('audio\/'\)/);
 assert.match(section,/audio\.controls=true;audio\.preload='metadata'/);
 assert.match(section,/state\.mediaPreviewUrls\.set\(String\(id\),href\)/);
 assert.match(section,/ownerKey!==String\(tg\?\.initData\|\|''\)/);
 assert.match(ui,/Слушать сохранённое аудио/);
 assert.match(ui,/Слушать в переписке/);
 assert.match(ui,/event\.target\.closest\('\[data-mirror-photo\]'\)/);
});

test('outgoing UI shows accepted as Telegram-accepted, not delivered/read',()=>{
 const ui=read('public/telegram-chats.js');
 const html=read('public/studio.html'),css=read('public/chat-media.css');
 assert.match(ui,/setDeliveryStatus\('sending',chatId/);
 assert.match(ui,/setDeliveryStatus\('accepted',chatId/);
 assert.match(ui,/setDeliveryStatus\(error\?\.uncertain\?'uncertain':'failed'/);
 assert.match(ui,/setDeliveryStatus\(error\.uncertain\?'uncertain':'failed'/);
 assert.match(ui,/title="Telegram принял отправку, статус прочтения неизвестен"/);
 assert.match(ui,/lastRichFailure=\{intent,nonce\}/);
 assert.match(html,/id="telegramThreadDeliveryStatus"/);
 assert.match(css,/veto-mirror-delivery-status\[data-state="uncertain"\]/);
 assert.match(css,/veto-mirror-media-reveal audio/);
});
