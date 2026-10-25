import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../public/story-soundtrack.js',import.meta.url),'utf8').replace('export function','function');
function harness(supported=false){
  const nodes=new Map(),notices=[],revoked=[],downloads=[],tracks=[];let nextUrl=0;
  function element(id){
    if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,value:'',files:[],handlers:{},
      addEventListener(type,fn){this.handlers[type]=fn},pause(){this.paused=true},load(){},removeAttribute(name){delete this[name]},
      click(){if(this.download)downloads.push(this.download);else return this.handlers.click?.();}
    });return nodes.get(id);
  }
  const winHandlers={},docHandlers={};
  class Audio {
    constructor(){this.handlers={};}addEventListener(key,fn){this.handlers[key]=fn;}async play(){}pause(){}
  }
  class Context {
    async resume(){}async close(){}
    createMediaElementSource(){return {connect(){}};}
    createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[{stop(){}}]}};}
  }
  class Recorder {
    static isTypeSupported(){return true;}
    constructor(stream,{mimeType}){this.mimeType=mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable({data:new Blob(['video-test-bytes'])});this.onstop();}
  }
  const context=vm.createContext({Blob,console,
    document:{getElementById:element,hidden:false,addEventListener:(key,fn)=>{docHandlers[key]=fn},createElement:tag=>tag==='canvas'?{
      captureStream:supported?()=>({addTrack:track=>tracks.push(track),getTracks:()=>tracks}):undefined
    }:element('download')},
    window:{Audio,AudioContext:Context,MediaRecorder:supported?Recorder:undefined,addEventListener:(key,fn)=>{winHandlers[key]=fn}},
    MediaRecorder:Recorder,
    URL:{createObjectURL:()=>`blob:test-${++nextUrl}`,revokeObjectURL:value=>revoked.push(value)},
    setTimeout:fn=>{queueMicrotask(fn);return 1},clearTimeout(){}
  });
  const setup=vm.runInContext(code+';setupStorySoundtrack',context);
  let owner='111';const controller=setup({paint(){},scope:()=>({owner}),isCurrent:scope=>scope.owner===owner,notify:(...args)=>notices.push(args)});
  const choose=file=>{element('seMusicFile').files=[file];element('seMusicFile').handlers.change({target:element('seMusicFile')});};
  return {element,notices,revoked,downloads,choose,controller,winHandlers,docHandlers,setOwner:value=>{owner=value}};
}
test('soundtrack rejects oversized or non-audio files without creating a preview URL',()=>{
  const h=harness();h.choose({type:'image/png',size:10,name:'wrong.png'});
  assert.equal(h.element('seMusicExport').disabled,true);assert.equal(h.notices.at(-1)[1],true);
  h.choose({type:'audio/mpeg',size:16*1024*1024,name:'large.mp3'});
  assert.equal(h.element('seMusicExport').disabled,true);
});
test('unsupported video export reports the limitation without a success or download',async()=>{
  const h=harness();h.choose({type:'audio/mpeg',size:200,name:'music.mp3'});
  await h.element('seMusicExport').handlers.click();assert.equal(h.downloads.length,0);
  assert.match(h.notices.at(-1)[0],/недоступен/);assert.equal(h.notices.at(-1)[1],true);
  h.controller.clear();assert.deepEqual(h.revoked,['blob:test-1']);assert.equal(h.element('seMusicPlayer').hidden,true);
});
test('supported local clip uses recorder output and cleans up on page exit',async()=>{
  const h=harness(true);h.choose({type:'audio/mpeg',size:200,name:'music.mp3'});
  await h.element('seMusicExport').handlers.click();assert.deepEqual(h.downloads,['vetogram-story.mp4']);
  assert.match(h.notices.at(-1)[0],/вручную/);
  h.winHandlers.pagehide();assert.equal(h.element('seMusicPlayer').hidden,true);
  assert.ok(h.revoked.includes('blob:test-1'));
});
