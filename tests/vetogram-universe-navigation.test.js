/* Executes the actual shell controller with deterministic frame/message boundaries.
 * This is lifecycle QA, not browser rendering or Telegram WebView evidence. */
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/vetogram-universe.js',import.meta.url),'utf8');
function fixture(){
 const nodes=new Map(),events=new Map(),timers=[],observers=[];
 const classes=()=>{const set=new Set();return {add:n=>set.add(n),remove:n=>set.delete(n),toggle(n,on){on?set.add(n):set.delete(n);},contains:n=>set.has(n)};};
 function node(id){if(!nodes.has(id))nodes.set(id,{id,dataset:{},hidden:false,classList:classes(),children:[],attrs:{},value:'0',textContent:'',
  setAttribute(k,v){this.attrs[k]=v;},append(el){this.children.push(el);},addEventListener(k,f){this['on'+k]=f;},focus(){},remove(){this.removed=true;},
  click(){this.onclick?.();},contentWindow:{messages:[],postMessage(message,origin){this.messages.push({message,origin});}}});return nodes.get(id);}
 const root={dataset:{vetoTheme:'graphite'},classList:classes()};
 const buttons=['music','cinema','books'].map(name=>{const el=node('button-'+name);el.dataset.v6Module=name;return el;});
 const listeners=(key,fn)=>{if(!events.has(key))events.set(key,[]);events.get(key).push(fn);};
 const emit=(key,event)=>{for(const fn of events.get(key)||[])fn(event);};
 const window={Telegram:{WebApp:{initData:'signed-A',initDataUnsafe:{user:{id:11,first_name:'Первый'}}}},addEventListener:listeners};
 window.VetoTelegramNavigate=screen=>emit('veto:screen-changed',{detail:{screen}});
 let created=0;
 const document={createElement:()=>node("frame-"+(created++)),documentElement:root,getElementById:node,querySelector:()=>({dataset:{screen:'telegram'}}),querySelectorAll:selector=>selector.includes('data-v6-module')?buttons:[],addEventListener:listeners};
 const context=vm.createContext({window,document,location:{origin:'https://vetogram.test',search:''},URLSearchParams,URL,
  setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:fn=>{window.tick=fn;},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}});
 vm.runInContext(source,context);
 function open(name){node('button-'+name).onclick();return node('v6Frames').children.at(-1);}
 function message(frame,data,origin='https://vetogram.test',source=frame.contentWindow){emit('message',{origin,source,data:{channel:'vetogram-media',...data}});}
 return {window,root,node,open,message,emit,timers,observers};
}
test('media modules load on first action only and music survives return to Chats',()=>{
 const f=fixture();assert.equal(f.node('v6Frames').children.length,0);
 const music=f.open('music');assert.match(music.src,/^\/music-module.html\?universe=1$/);
 f.message(music,{type:'ready'});assert.equal(f.node('v6ModuleStatus').hidden,true);
 f.emit('veto:screen-changed',{detail:{screen:'telegram'}});assert.equal(music.removed,undefined);
 const before=f.node('v6Frames').children.length;f.open('music');assert.equal(f.node('v6Frames').children.length,before);
 assert.doesNotMatch(music.src,/signed-A|initData|user=/);
});
test('mini-player follows actual frame state and unrelated messages cannot impersonate audio',()=>{
 const f=fixture(),music=f.open('music');f.emit('veto:screen-changed',{detail:{screen:'telegram'}});
 const data={type:'audio',state:{title:'Личный трек',artist:'Автор',playing:true,position:12,duration:100}};
 f.message(music,data,'https://evil.test');assert.equal(f.node('v6MiniPlayer').hidden,true);
 f.message(music,data,'https://vetogram.test',{});assert.equal(f.node('v6MiniPlayer').hidden,true);
 f.message(music,data);assert.equal(f.node('v6MiniPlayer').hidden,false);assert.equal(f.node('v6NowTitle').textContent,'Личный трек');assert.equal(f.node('v6NowSeek').value,'120');
 f.open('music');assert.equal(f.node('v6MiniPlayer').hidden,true);
});
test('owner change destroys every media document and removes private player metadata',()=>{
 const f=fixture(),music=f.open('music');const cinema=f.open('cinema');
 f.message(music,{type:'audio',state:{title:'Private',artist:'A',duration:30,position:1}});
 f.window.Telegram.WebApp.initData='signed-B';f.window.Telegram.WebApp.initDataUnsafe.user.id=22;f.window.tick();
 assert.equal(music.removed,true);assert.equal(cinema.removed,true);assert.equal(music.src,'about:blank');assert.equal(f.node('v6MiniPlayer').hidden,true);
 const fresh=f.open('music');assert.notEqual(fresh,music);assert.equal(f.window.VetogramUniverse.context().user.id,22);
});
test('module error and retry remain isolated and theme is propagated to existing frames',()=>{
 const f=fixture(),music=f.open('music');f.message(music,{type:'failed'});assert.equal(f.node('v6ModuleRetry').hidden,false);
 f.node('v6ModuleRetry').onclick();assert.equal(music.removed,true);
 const fresh=f.node('v6Frames').children.at(-1);f.message(fresh,{type:'ready'});
 f.root.dataset.vetoTheme='pearl';f.observers[0]();assert.ok(fresh.contentWindow.messages.some(x=>x.message.action==='theme'&&x.message.theme==='pearl'));
});
test('cinema playback asks the music module to pause without changing Messenger controllers',()=>{
 const f=fixture(),music=f.open('music'),cinema=f.open('cinema');f.message(cinema,{type:'video-playing'});
 assert.ok(music.contentWindow.messages.some(x=>x.message.action==='audio'&&x.message.command==='pause'));
 assert.equal(typeof f.window.VetoTelegramNavigate,'function');
});

test('retry preserves the requested film and media page after a failed iframe',()=>{
 const f=fixture();f.window.VetogramUniverse.open('cinema','search','film-42');
 const first=f.node('v6Frames').children.at(-1);
 assert.equal(first.src,'/cinema.html?universe=1');
 f.message(first,{type:'ready'});
 assert.ok(first.contentWindow.messages.some(x=>x.message.action==='page'&&x.message.page==='search'));
 assert.ok(first.contentWindow.messages.some(x=>x.message.action==='open-item'&&x.message.id==='film-42'));
 f.message(first,{type:'failed'});
 assert.equal(f.node('v6ModuleRetry').hidden,false);
 f.node('v6ModuleRetry').onclick();
 assert.equal(first.removed,true);
 assert.equal(first.src,'about:blank');
 const second=f.node('v6Frames').children.at(-1);
 assert.notEqual(first,second);
 assert.equal(second.src,'/cinema.html?universe=1');
 f.message(second,{type:'ready'});
 assert.ok(second.contentWindow.messages.some(x=>x.message.action==='page'&&x.message.page==='search'));
 assert.ok(second.contentWindow.messages.some(x=>x.message.action==='open-item'&&x.message.id==='film-42'));
});
test('empty music cannot open full-player and an unavailable source closes it',()=>{
 const f=fixture(),full=f.node('v61Player');
 full.hidden=true;
 f.node('v6NowOpen').onclick();assert.equal(full.hidden,true);
 const music=f.open('music');
 f.message(music,{type:'ready'});
 f.message(music,{type:'audio',state:{id:'song',title:'Song',artist:'Artist',position:0,duration:100,playing:true}});
 f.node('v6NowOpen').onclick();assert.equal(full.hidden,false);
 f.message(music,{type:'audio',state:null});
 assert.equal(full.hidden,true);
 assert.equal(f.node('v61PlayerTitle').textContent,'Твоя музыка');
 assert.equal(f.node('v6NowTitle').textContent,'');
});

test('Chats → Music → Cinema → Books → Chats keeps one frame each and routes visibility correctly',()=>{
 const f=fixture(),music=f.open('music');
 f.message(music,{type:'ready'});
 const visible=frame=>frame.contentWindow.messages.filter(x=>x.message.action==='visible').at(-1)?.message.visible;
 assert.equal(visible(music),true);
 const cinema=f.open('cinema');f.message(cinema,{type:'ready'});
 assert.equal(visible(music),false);
 assert.equal(visible(cinema),true);
 const books=f.open('books');f.message(books,{type:'ready'});
 assert.equal(visible(cinema),false);
 assert.equal(visible(books),true);
 f.window.VetoTelegramNavigate('telegram');
 for(const frame of [music,cinema,books])assert.equal(visible(frame),false);
 assert.equal(f.node('v6Frames').children.length,3);
 f.window.VetoTelegramNavigate('media');
 assert.equal(visible(books),true);
 const before=f.node('v6Frames').children.length;
 f.open('music');
 assert.equal(visible(music),true);
 assert.equal(visible(books),false);
 assert.equal(f.node('v6Frames').children.length,before);
 for(const frame of [music,cinema,books])assert.equal(frame.removed,undefined);
});

test('stale asynchronous open failures cannot overwrite a newer item result',()=>{
 const f=fixture(),books=f.open('books');
 f.message(books,{type:'ready'});
 f.window.VetogramUniverse.open('books',undefined,'old-book');
 const old=books.contentWindow.messages.filter(x=>x.message.action==='open-item').at(-1)?.message;
 f.window.VetogramUniverse.open('books',undefined,'new-book');
 const newer=books.contentWindow.messages.filter(x=>x.message.action==='open-item').at(-1)?.message;
 assert.ok(old&&newer&&old.requestId<newer.requestId);
 assert.equal(newer.id,'new-book');
 f.message(books,{type:'open-item-status',ok:false,requestId:old.requestId});
 assert.equal(f.node('v6ModuleStatus').hidden,true);
 f.message(books,{type:'open-item-status',ok:false,requestId:newer.requestId});
 assert.equal(f.node('v6ModuleStatus').hidden,false);
 f.message(books,{type:'open-item-status',ok:true,requestId:newer.requestId});
 assert.equal(f.node('v6ModuleStatus').hidden,true);
 f.message(books,{type:'open-item-status',ok:false,requestId:1});
 assert.equal(f.node('v6ModuleStatus').hidden,true);
});

test('account ID switch invalidates old frames even before Telegram refreshes initData string',()=>{
 const f=fixture(),music=f.open('music');
 f.window.VetoTelegramNavigate('telegram'); // mini-player is intentionally hidden while Music itself is foreground.
 f.message(music,{type:'audio',state:{id:'owned',title:'Private audio',artist:'Owner',duration:90,position:1}});
 assert.equal(f.node('v6MiniPlayer').hidden,false);
 const signedBefore=f.window.Telegram.WebApp.initData;
 f.window.Telegram.WebApp.initDataUnsafe.user.id=999;
 f.window.tick();
 assert.equal(f.window.Telegram.WebApp.initData,signedBefore);
 assert.equal(music.removed,true);
 assert.equal(music.src,'about:blank');
 assert.equal(f.node('v6MiniPlayer').hidden,true);
 assert.equal(f.node('v6NowTitle').textContent,'');
});

test('failed Music frame keeps retry visible after navigating away and back',()=>{
 const f=fixture(),music=f.open('music');
 f.message(music,{type:'failed'});
 assert.equal(f.node('v6ModuleRetry').hidden,false);
 f.open('cinema');
 f.open('music');
 assert.equal(f.node('v6ModuleRetry').hidden,false);
 assert.match(f.node('v6ModuleStatus').textContent,/Ошибка раздела/);
 f.node('v6ModuleRetry').onclick();
 const fresh=f.node('v6Frames').children.at(-1);
 assert.notEqual(fresh,music);
 assert.equal(music.src,'about:blank');
 assert.equal(f.node('v6ModuleRetry').hidden,true);
 f.message(fresh,{type:'ready'});
 assert.equal(f.node('v6ModuleStatus').hidden,true);
});
test('background iframe timeout remains recoverable on next media visit',()=>{
 const f=fixture(),music=f.open('music'),pending=f.timers.at(-1);
 assert.equal(typeof pending,'function');
 f.window.VetoTelegramNavigate('telegram');
 pending(); // Simulates the real 18-second timer while Chats is foreground.
 f.open('music');
 assert.equal(f.node('v6ModuleRetry').hidden,false);
 assert.match(f.node('v6ModuleStatus').textContent,/не ответил/);
});
test('frame loading failure before ready retains retry on a later visit',()=>{
 const f=fixture(),books=f.open('books');
 books.onerror();
 f.window.VetoTelegramNavigate('telegram');
 f.open('books');
 assert.equal(f.node('v6ModuleRetry').hidden,false);
 assert.match(f.node('v6ModuleStatus').textContent,/не загрузился/);
});
