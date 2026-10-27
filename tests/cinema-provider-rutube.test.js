import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'public/cinema-provider.js'),'utf8');
function createHarness() {
 const listener=new Map(),messages=[];
 const iframe={
  events:{},contentWindow:{postMessage(data,origin){messages.push({data:JSON.parse(data),origin})}},
  addEventListener(k,fn){this.events[k]=fn},
  setAttribute(){},remove(){this.removed=true}
 };
 const video={hidden:false};
 const container={append(x){this.child=x}};
 const context={
  URL,Promise,window:{addEventListener:(k,cb)=>listener.set(k,cb),
   removeEventListener:k=>listener.delete(k)},
  document:{createElement:()=>iframe}
 };
 vm.runInNewContext(source,context,{filename:'cinema-provider.js'});
 return {listener,messages,iframe,video,container,api:context.window.VetogramCinemaProvider};
}
const src={type:'iframe',url:'https://rutube.ru/play/embed/de108b940b59e5e9d361077328ca9201',
 licensed:true,license:'Public official embed',credit:'Mosfilm'};

test('RUTUBE iframe uses exact allowlisted origin and cleans up',async()=>{
 const h=createHarness();
 const events=[];
 const handle=await h.api.attach({video:h.video,container:h.container,source:src,
  allowedIframeOrigins:['https://rutube.ru'],resumeAt:55,onEvent:e=>events.push(e)});
 assert.equal(handle.mode,'iframe');
 assert.equal(h.video.hidden,true);
 assert.equal(h.container.child.src,src.url);
 const receive=(origin,source,kind,data)=>h.listener.get('message')({
  origin,source,data:JSON.stringify({type:kind,data})
 });
 receive('https://evil.example',h.iframe.contentWindow,'player:currentTime',{time:400});
 receive('https://rutube.ru',{},'player:currentTime',{time:400});
 assert.equal(events.length,0,'ignore messages from other origin/frame');
 receive('https://rutube.ru',h.iframe.contentWindow,'player:ready',{videoId:'de108b940b59e5e9d361077328ca9201'});
 assert.equal(h.messages.length,1);
 assert.equal(h.messages[0].origin,'https://rutube.ru');
 assert.equal(h.messages[0].data.type,'player:setCurrentTime');
 assert.equal(h.messages[0].data.data.time,55);
 receive('https://rutube.ru',h.iframe.contentWindow,'player:durationChange',{duration:400});
 receive('https://rutube.ru',h.iframe.contentWindow,'player:currentTime',{time:120});
 receive('https://rutube.ru',h.iframe.contentWindow,'player:playComplete',{});
 assert.equal(events.length,3);
 assert.equal(events[0].duration,400);
 assert.equal(events[1].time,120);
 assert.equal(events[1].duration,400);
 assert.equal(events[2].type,'ended');
 handle.cleanup();
 assert.equal(h.video.hidden,false);
 assert.equal(h.iframe.removed,true);
 assert.equal(h.listener.has('message'),false);
});
test('rejects untrusted iframe origin',async()=>{
 const h=createHarness();
 await assert.rejects(h.api.attach({video:h.video,container:h.container,source:{...src,url:'https://fake.example/movie'},
   allowedIframeOrigins:['https://rutube.ru']}),/не разрешён/);
 assert.equal(h.listener.size,0);
});
test('rejects unlicensed/invalid iframe playback',async()=>{
 const h=createHarness();
 await assert.rejects(h.api.attach({video:h.video,container:h.container,source:{...src,licensed:false},
  allowedIframeOrigins:['https://rutube.ru']}),/не подтверждён/);
});
