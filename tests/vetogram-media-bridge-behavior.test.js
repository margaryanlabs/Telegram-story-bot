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
 const video=eventTarget(),watch=eventTarget();
 const messages=[];
 const parent={postMessage(value,origin){messages.push({value,origin});}};
 const location={origin:'https://vetogram.test',pathname};
 window.VetogramMediaContext={embedded:true,scope:'device'};
 window.VetogramCinema={openTab(){}};
 document.getElementById=id=>id==='cinemaVideo'?video:id==='cinemaDetailsWatch'?watch:null;
 document.querySelectorAll=()=>[];
 const ctx={window,document,location,parent,setTimeout(){return 1;},clearTimeout(){}};
 vm.runInNewContext(code,ctx,{filename:'vetogram-media-bridge.js',timeout:1000});
 const count=()=>messages.filter(m=>m.value.type==='video-playing').length;
 return {window,video,watch,messages,count,location};
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
