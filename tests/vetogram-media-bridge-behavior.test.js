import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../public/vetogram-media-bridge.js',import.meta.url),'utf8');

function eventTarget(){
 const listeners=new Map();
 return {
  addEventListener(name,handler){
   const list=listeners.get(name)||[];list.push(handler);listeners.set(name,list);
  },
  fire(name,event={}){for(const handler of listeners.get(name)||[])handler(event);}
 };
}

function setup(pathname='/cinema.html'){
 const window=eventTarget(), document=eventTarget();
 let backgroundPauses=0;
 const video=eventTarget(),watch=eventTarget(),audio=eventTarget();
 let videoPauses=0,audioPauses=0,playerCloses=0;
 video.pause=()=>{videoPauses++;};audio.pause=()=>{audioPauses++;};
 audio.paused=false;audio.ended=false;audio.error=null;audio.readyState=4;
 audio.currentTime=0;audio.duration=120;
 const messages=[];
 const parent={postMessage(value,origin){messages.push({value,origin});}};
 const location={origin:'https://vetogram.test',pathname};
 window.VetogramMediaContext={embedded:true,scope:'device'};
 window.VetogramCinema={openTab(){}};
 window.VetogramMusic={showPage(){},now(){return null;}};
 window.VetogramBooks={openSavedByKey(){return true;},pauseBackgroundWork(){backgroundPauses++;}};
 const close={click(){playerCloses++;}};
 const player={classList:{contains(name){return false;}}};
 document.getElementById=id=>id==='cinemaVideo'?video:id==='cinemaDetailsWatch'?watch:
  id==='audio'?audio:id==='cinemaPlayerClose'?close:id==='cinemaPlayer'?player:null;
 document.querySelectorAll=()=>[];
 const ctx={window,document,location,parent,setTimeout(){return 1;},clearTimeout(){}};
 vm.runInNewContext(code,ctx,{filename:'vetogram-media-bridge.js',timeout:1000});
 const count=()=>messages.filter(m=>m.value.type==='video-playing').length;
 return {window,document,video,watch,audio,parent,messages,count,location,
  get videoPauses(){return videoPauses;},
  get audioPauses(){return audioPauses;},
  get playerCloses(){return playerCloses;},
  get backgroundPauses(){return backgroundPauses;}};
}

test('clicking Watch never falsely tells parent playback started',()=>{
 const media=setup();
 assert.ok(media.messages.some(m=>m.value.type==='ready'));
 const before=media.count();
 media.watch.fire('click');
 media.video.fire('waiting');
 media.video.fire('pause');
 assert.equal(media.count(),before);
});

test('native video playing notifies parent, using same-origin target',()=>{
 const media=setup();
 media.video.fire('playing');
 assert.equal(media.count(),1);
 assert.equal(media.messages.at(-1).origin,media.location.origin);
});

test('validated provider playback event notifies parent, but only when received',()=>{
 const media=setup();
 assert.equal(media.count(),0);
 media.window.fire('vetogram:cinema-playing');
 assert.equal(media.count(),1);
});

test('rejected iframe playback does not dispatch a phantom start event',()=>{
 const media=setup();
 media.video.fire('error');
 media.video.fire('waiting');
 media.watch.fire('click');
 assert.equal(media.count(),0);
});

test('hiding Cinema after navigating to Chats pauses native video and closes the embedded player',()=>{
 const media=setup('/cinema.html');
 media.window.fire('message',{source:media.parent,origin:media.location.origin,
  data:{channel:'vetogram-universe',action:'visible',visible:false}});
 assert.equal(media.videoPauses,1);
 assert.equal(media.playerCloses,1);
});

test('hiding Music in the host does not forcibly pause user audio',()=>{
 const media=setup('/music-module.html');
 assert.ok(media.messages.some(message=>message.value.type==='ready'));
 media.window.fire('message',{source:media.parent,origin:media.location.origin,
  data:{channel:'vetogram-universe',action:'visible',visible:false}});
 assert.equal(media.audioPauses,0);
});

test('hiding Books cancels background prefetch but retains the active reader',()=>{
 const media=setup('/books.html');
 assert.ok(media.messages.some(message=>message.value.type==='ready'));
 media.window.fire('message',{source:media.parent,origin:media.location.origin,
  data:{channel:'vetogram-universe',action:'visible',visible:false}});
 assert.equal(media.backgroundPauses,1);
});

test('metadata-only saved music returns search status, never false playback success',async()=>{
 const media=setup('/music-module.html');
 media.window.VetogramCinema=null;
 media.window.VetogramBooks=null;
 media.window.VetogramMusic.openSavedById=()=>Promise.resolve('search');
 media.window.fire('message',{source:media.parent,origin:media.location.origin,
  data:{channel:'vetogram-universe',action:'open-item',id:'metadata:123',requestId:11}});
 await new Promise(resolve=>setImmediate(resolve));
 const reply=media.messages.find(m=>m.value.type==='open-item-status'&&m.value.requestId===11);
 assert.equal(reply?.value.ok,false);
 assert.equal(reply?.value.status,'search');
});

test('saved audio stream item returns opened only after the module accepted it',async()=>{
 const media=setup('/music-module.html');
 media.window.VetogramCinema=null;
 media.window.VetogramBooks=null;
 media.window.VetogramMusic.openSavedById=()=>Promise.resolve(true);
 media.window.fire('message',{source:media.parent,origin:media.location.origin,
  data:{channel:'vetogram-universe',action:'open-item',id:'local:123',requestId:14}});
 await new Promise(resolve=>setImmediate(resolve));
 const reply=media.messages.find(m=>m.value.type==='open-item-status'&&m.value.requestId===14);
 assert.equal(reply?.value.ok,true);
 assert.equal(reply?.value.status,'opened');
});

test('cross-origin and wrong-parent commands are ignored',async()=>{
 const media=setup('/music-module.html');
 let calls=0;
 media.window.VetogramMusic.openSavedById=()=>{calls++;return true;};
 const command={channel:'vetogram-universe',action:'open-item',id:'track1',requestId:9};
 media.window.fire('message',{source:media.parent,origin:'https://attacker.test',data:command});
 media.window.fire('message',{source:{},origin:media.location.origin,data:command});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,0);
 assert.equal(media.messages.filter(m=>m.value.type==='open-item-status').length,0);
});
