import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dialogInfo,messageInfo,combineLiveAndPreserved} from '../api/telegram-chats.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Telegram Live Chats normalizes private, bots, groups, channels and self without fabricated chats',()=>{
  const base={id:123n,title:'Чат <опасно>',message:{
    id:11,date:Math.floor(Date.now()/1000),message:'Текст <script>x</script>',
  },unreadCount:4,pinned:true};
  const personal=dialogInfo({...base,isUser:true,entity:{id:123n,firstName:'Аня'}});
  const bot=dialogInfo({...base,isUser:true,entity:{id:123n,bot:true,username:'Some_Bot'}});
  const group=dialogInfo({...base,isGroup:true,entity:{id:888n,title:'Group'}});
  const channel=dialogInfo({...base,isChannel:true,entity:{id:999n,broadcast:true,username:'news'}});
  const saved=dialogInfo({...base,isUser:true,entity:{id:123n,self:true}});
  assert.equal(personal.type,'private');
  assert.equal(bot.type,'bot');
  assert.equal(group.type,'group');
  assert.equal(channel.type,'channel');
  assert.equal(saved.type,'saved');
  assert.equal(personal.id,'123');
  assert.equal(personal.unreadCount,4);
  assert.equal(personal.preview,'Текст <script>x</script>');
  assert.equal(bot.nativeUrl,'https://t.me/Some_Bot');
});

test('Telegram Live Chats reads message metadata without returning session or MTProto file access hashes',()=>{
  const msg=messageInfo({
    id:17,date:Math.floor(Date.now()/1000),out:true,
    message:'Hello\nworld',photo:{},editDate:123,accessHash:'private',sender:{firstName:'Аня'},
  },true);
  assert.equal(msg.id,17);
  assert.equal(msg.out,true);
  assert.equal(msg.media,'photo');
  assert.equal(msg.text,'Hello\nworld'.replace(/\n/g,' '));
  assert.equal(msg.edited,true);
  assert.ok(!('accessHash' in msg));
  assert.ok(!('session' in msg));
  assert.ok(!('fileId' in msg));
});

test('Live Chats API is isolated to verified owner Telegram Mini App session',()=>{
  const api=read('api/telegram-chats.js');
  assert.ok(api.includes('validateTelegramMiniApp('));
  assert.ok(api.includes('getViewerSession(userId)'));
  assert.ok(api.includes('sameTelegramAccount(userId, linked.telegram_account_user_id)'));
  assert.ok(api.includes('verifyTelegramClientOwner(client,userId)'));
  assert.ok(api.includes("openJson(linked.session_ciphertext,'session:'+userId)"));
  assert.ok(api.includes("if(req.method!=='POST')"));
  assert.ok(api.includes('dialog=dialogs.find')||api.includes('dialogs.find(d=>safeId(d.id)===chatId)'));
  assert.ok(api.includes("Cache-Control','private, no-store"));
  assert.ok(!api.includes('importUserHistoryBatch'));
  assert.ok(!api.includes('markRead'));
  assert.ok(!api.includes('sendMessage'));
});

test('Pagination on dialogs and messages is bounded and older messages cannot target unrelated peers',()=>{
  const api=read('api/telegram-chats.js');
  assert.ok(api.includes('const PAGE_SIZE=50;'));
  assert.ok(api.includes('const MAX_DIALOGS=500;'));
  assert.ok(api.includes('const MESSAGE_PAGE=35;'));
  assert.ok(api.includes('getDialogs({limit:totalToFetch})'));
  assert.ok(api.includes('getDialogs({limit:MAX_DIALOGS})'));
  assert.ok(api.includes('client.getMessages(dialog.entity'));
  assert.ok(api.includes('offsetId:cursor'));
  assert.ok(api.includes("if(!dialog)return {missing:true"));
});

test('Premium live inbox has first-class Home and Privacy entry points and dedicated full page',()=>{
  const html=read('public/studio.html'), app=read('public/app.js');
  assert.ok(html.includes('data-screen="telegram"'));
  assert.ok(html.includes('id="telegramMirrorList"'));
  assert.ok(html.includes('id="telegramThreadMessages"'));
  assert.ok(html.includes('id="telegramMirrorSearch"'));
  assert.ok(html.includes('id="telegramMirrorMore"'));
  assert.ok(html.includes('id="telegramThreadOlder"'));
  assert.ok(html.includes('id="telegramThreadOpenNative"'));
  assert.ok(html.includes('veto-mirror-home-open'));
  assert.ok(html.includes('veto-mirror-privacy-entrance'));
  assert.ok(html.includes('data-open-screen="telegram"'));
  assert.ok(app.includes("telegram: 'telegram'"));
  assert.ok(app.includes("telegram:'privacy'"));
});

test('Live Chat frontend does not duplicate Telegram session or cache private message bodies',()=>{
  const ui=read('public/telegram-chats.js');
  assert.ok(ui.includes("'x-telegram-init-data':tg.initData"));
  assert.ok(ui.includes("request('list'"));
  assert.ok(ui.includes("request('thread'"));
  assert.ok(ui.includes('function renderMessages('));
  assert.ok(ui.includes('safe(message.text)')||ui.includes('safe(text)'));
  assert.ok(ui.includes('data-mirror-filter'));
  assert.ok(ui.includes("window.VetoTelegramNavigate?.('home')"));
  assert.ok(!ui.includes('localStorage'));
  assert.ok(!ui.includes('sessionStorage'));
  assert.ok(!ui.includes('TelegramClient('));
  assert.ok(!ui.includes("method:'PUT'"));
});

test('Live chat is read-only and native open action is limited to Telegram destinations',()=>{
  const api=read('api/telegram-chats.js'),ui=read('public/telegram-chats.js'),html=read('public/studio.html');
  assert.ok(api.includes("scope:'read-only-cloud-chats'"));
  assert.ok(api.includes('readOnly:true,isCopy:chat.archiveOnly===true'));
  assert.ok(html.includes('Открыть в Telegram'));
  assert.ok(ui.includes('t\\.me') || ui.includes("https://t.me"));
  assert.ok(ui.includes("link.removeAttribute('href')"));
  assert.ok(!api.includes('readHistory'));
});

test('Real Telegram unread and archived dialogs are discoverable by category',()=>{
  const d=dialogInfo({id:19n,title:'Важный чат',isUser:true,archived:true,
    entity:{id:19n,username:'sample'},unreadCount:17});
  assert.equal(d.archived,true);
  assert.equal(d.unreadCount,17);
  const ui=read('public/telegram-chats.js'),html=read('public/studio.html');
  assert.ok(ui.includes("state.filter==='unread'"));
  assert.ok(ui.includes("state.filter==='archived'"));
  assert.ok(html.includes('data-mirror-filter="unread"'));
  assert.ok(html.includes('data-mirror-filter="archived"'));
});



test('Previously captured Telegram deletions remain visible in a live chat with explicit provenance',()=>{
  const rows=combineLiveAndPreserved([
    {id:10,text:'Original',date:'2026-10-11T15:05:00.000Z',out:false},
    {id:12,text:'Current message',date:'2026-10-11T15:07:00.000Z',out:false},
  ],[
    {id:10,text:'Copied before deletion',date:'2026-10-11T15:05:00.000Z',
      out:false,saved:true,deleted:true,media:'photo',mediaAvailable:true},
    {id:11,text:'Already deleted in Telegram',date:'2026-10-11T15:06:00.000Z',
      out:false,saved:true,deleted:true},
  ]);
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(x=>x.id),[10,11,12]);
  assert.equal(rows[0].saved,true);
  assert.equal(rows[0].deleted,true);
  assert.equal(rows[0].mediaAvailable,true);
  assert.equal(rows[1].preservedOnly,true);
  assert.equal(rows[1].text,'Already deleted in Telegram');
  assert.equal(rows[2].saved,undefined);
});
test('Preserved-only chat is accessible without a live Telegram session and never invents missing history',()=>{
 const api=read('api/telegram-chats.js'),ui=read('public/telegram-chats.js');
 assert.ok(api.includes('archiveThreads(userId)'));
 assert.ok(api.includes("if(!chat && threadArchive)chat=archivedDialog(threadArchive)"));
 assert.ok(api.includes("if(warning && !history.length)return respond(res,409"));
 assert.ok(api.includes('listPrivacyMessages(ownerId,chatId,ARCHIVE_PAGE,offset)'));
 assert.ok(api.includes("deleted:Boolean(row.deleted_at),saved:true"));
 assert.ok(api.includes('archiveHasMore:stored.hasMore'));
 assert.ok(ui.includes("data-mirror-filter"));
 assert.ok(ui.includes("message.deleted"));
 assert.ok(ui.includes("УДАЛЕНО В TELEGRAM · СОХРАНЕНО В VETO"));
 assert.ok(ui.includes("state.archiveHasMore"));
 assert.ok(ui.includes('state.archiveOffset'));
 assert.ok(!api.includes('Telegram can recover already deleted messages'));
});
test('Previously deleted media is available only through authenticated Media Vault, never a public file URL',()=>{
 const api=read('api/telegram-chats.js'),ui=read('public/telegram-chats.js');
 assert.ok(ui.includes("'x-telegram-init-data':tg.initData"));
 assert.ok(ui.includes("'/api/privacy-media?'"));
 assert.ok(ui.includes('URL.createObjectURL(blob)'));
 assert.ok(ui.includes('revokeMediaUrls()'));
 assert.ok(api.includes("mediaAvailable:Boolean(row.media_file_id)||row.media_archive_status==='archived'"));
 assert.ok(!api.includes('signedUrl:'));
});
