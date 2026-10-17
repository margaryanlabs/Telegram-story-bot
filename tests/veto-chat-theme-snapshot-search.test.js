import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all four chat themes recolor BOTH list and conversation with high-contrast text tokens',()=>{
  const html=read('public/studio.html'),css=read('public/chat-themes.css');
  for(const theme of ['graphite','pearl','slate','linen']){
    assert.ok(html.includes('data-chat-theme-option="'+theme+'"'));
    assert.ok(css.includes('data-chat-theme="'+theme+'"')||
      (theme==='graphite'&&css.includes('.veto-mirror{')));
  }
  assert.ok(html.includes('id="telegramChatThemes"'));
  assert.ok(html.indexOf('veto-chat-appearance')<html.indexOf('id="telegramChatsView"'));
  assert.ok(html.includes('src="/chat-theme.js?'));
  assert.ok(html.includes('href="/chat-themes.css?'));
  for(const name of ['--ct-bg','--ct-text','--ct-muted','--ct-in','--ct-out',
    '--ct-line','--ct-active','--ct-active-ink','--ct-input']){
    assert.ok(css.includes(name+':'),'Missing palette token '+name);
  }
  for(const key of ['.veto-mirror-bubble.outgoing','.veto-mirror-thread-body',
    '.veto-mirror-search-wrap','.veto-mirror-chat','.veto-mirror-metrics',
    '.veto-chat-search','.veto-mirror-privacy-diagnostics']){
    assert.ok(css.includes(key),'Missing chat context '+key);
  }
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(!css.includes('body[data-chat-theme'));
});

test('appearance selection persists ONLY theme enum, never Telegram content/IDs/tokens',()=>{
  const src=read('public/chat-theme.js');
  const buttons=['graphite','pearl','slate','linen'].map(s=>({
    dataset:{chatThemeOption:s},textContent:s,classList:{
      selected:false,toggle(k,on){if(k==='selected')this.selected=on;},
    },setAttribute(k,value){this[k]=value;},
  }));
  let click,stored={},painted;
  const panel={querySelectorAll:()=>buttons,contains:()=>true,
    addEventListener:(event,fn)=>{if(event==='click')click=fn;}};
  const root={dataset:{}};
  const window={localStorage:{getItem:k=>stored[k],setItem:(k,v)=>{stored[k]=v;}},
    addEventListener:()=>{},Telegram:{WebApp:{HapticFeedback:{selectionChanged:()=>{}}}}};
  const document={getElementById:k=>({telegramMirror:root,telegramChatThemes:panel})[k]};
  vm.runInNewContext(src,{window,document,Set});
  assert.equal(root.dataset.chatTheme,'graphite');
  click({target:{closest:()=>buttons[1]}});
  assert.equal(root.dataset.chatTheme,'pearl');
  assert.equal(buttons[1].getAttribute,undefined);
  assert.equal(buttons[1]['aria-pressed'],'true');
  assert.equal(stored['veto-chat-appearance-v1'],'pearl');
  assert.equal(Object.values(stored).length,1);
  assert.ok(!src.includes('initData'));
  assert.ok(!src.includes('chatId'));
  assert.ok(!src.includes('sendMessage'));
});

test('encrypted preview whitelists minimal chat-list metadata and discards messages and access tokens',()=>{
  const js=read('public/chat-snapshot-cache.js');
  const a=js.indexOf('  function clean(rows){'),b=js.indexOf('  async function save(',a);
  assert.ok(a>=0&&b>a);
  const sanitize=vm.runInNewContext(js.slice(a,b)+'\nclean',{MAX:60});
  const input={id:'123',title:'Personal',type:'private',date:'2026-10-17T10:00:00Z',
    pinned:true,unreadCount:9,preview:'PRIVATE SECRET MESSAGE',
    session:'AUTH SESSION',username:'secret',text:'VERY SECRET',
    token:'bot token',message:{text:'bad'},inbox:{preview:'private'},deletedCount:1};
  const res=sanitize([input]);
  assert.equal(res.length,1);
  assert.equal(res[0].id,'123');
  assert.equal(res[0].title,'Personal');
  assert.equal(res[0].deletedCount,1);
  const encoded=JSON.stringify(res);
  for(const secret of ['PRIVATE SECRET','AUTH SESSION','VERY SECRET','bot token','secret','message','preview','inbox'])
    assert.ok(!encoded.includes(secret),'No private data: '+secret);
  assert.ok(js.includes("AES-GCM"));
  assert.ok(js.includes("false,['encrypt','decrypt']"));
  assert.ok(js.includes('additionalData:new TextEncoder()'));
  assert.ok(js.includes('await subtle.encrypt('));
  assert.ok(js.includes('await subtle.decrypt('));
  assert.ok(js.includes('15*60*1000'));
  assert.ok(js.includes('const DB='));
  assert.ok(!js.includes('localStorage'));
});

test('encrypted cache can only be restored after server-signed Telegram owner verification and expires',()=>{
  const api=read('api/telegram-chats.js'),ui=read('public/telegram-chats.js');
  assert.ok(api.includes("if(action==='verify')"));
  assert.ok(api.includes('const owner=validateTelegramMiniApp('));
  assert.ok(api.includes("sameTelegramAccount(userId,linked.telegram_account_user_id)"));
  assert.ok(api.includes("cacheAllowed:active"));
  assert.ok(api.includes("cacheMaxAgeSeconds:900"));
  assert.ok(ui.includes("const identity=await request('verify')"));
  assert.ok(ui.includes('if(!identity.cacheAllowed'));
  assert.ok(ui.includes('window.VetoChatsSnapshot.load(identity.ownerId)'));
  assert.ok(ui.includes('window.VetoChatsSnapshot.save(state.cacheOwnerId,state.chats)'));
  assert.ok(ui.includes('window.VetoChatsSnapshot.clear(oldCacheId)'));
  assert.ok(ui.includes('state.cacheDenied=true'));
  assert.ok(ui.includes('cachedPreview'));
  assert.ok(ui.includes('КЭШ · НЕ LIVE'));
});

test('search is bounded to one authenticated Telegram chat and does not mark messages read',()=>{
  const api=read('api/telegram-chats.js'),ui=read('public/telegram-chats.js'),html=read('public/studio.html');
  assert.ok(api.includes("action==='search'"));
  assert.ok(api.includes('searchQuery.length<2||searchQuery.length>80'));
  assert.ok(api.includes('verifyTelegramClientOwner(client,userId)'));
  assert.ok(api.includes('getMessages(dialog.entity,{'));
  assert.ok(api.includes('search:searchQuery,limit:25'));
  assert.ok(api.includes("scope:'selected-telegram-chat'"));
  assert.ok(api.includes("if(!dialog)throw Error('CHAT_NOT_OWNED')"));
  assert.ok(!api.includes('readHistory('));
  assert.ok(!api.includes('sendMessage('));
  assert.ok(html.includes('id="telegramThreadSearchPanel"'));
  assert.ok(html.includes('id="telegramThreadSearchResults"'));
  assert.ok(ui.includes("request('search',{chatId,query})"));
  assert.ok(ui.includes('safe(row.text'));
  assert.ok(ui.includes("if(generation!==state.searchGeneration"));
  assert.ok(!read('public/chat-snapshot-cache.js').includes('searchQuery'));
});
