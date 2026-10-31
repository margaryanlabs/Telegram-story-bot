import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../public/vetogram-music.js",import.meta.url),"utf8");
const start=source.indexOf("function clearFailedTrack(");
const end=source.indexOf("function playTrack(",start);
assert.ok(start>=0&&end>start,"shipping clearFailedTrack must exist");
const helper=source.slice(start,end);

test("failed playback clears stale song, metadata and audio and revokes pending generation",()=>{
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{textContent:"previous",replaceChildren(){this.childrenCleared=true}});return elements.get(id)};
 const state={now:{title:"Older song"},queue:[{id:1}],index:0,playRequested:true};
 const audio={src:"https://example.test/audio.mp3",paused:false,pause(){this.paused=true},removeAttribute(name){if(name==="src")this.src=""},load(){this.loaded=true}};
 const navigator={mediaSession:{metadata:{title:"Older song"},playbackState:"playing"}};
 let syncs=0;
 const context=vm.createContext({audio,state,$,navigator,syncPlayer(){syncs++},playbackGeneration:10});
 vm.runInContext(helper+"; clearFailedTrack()",context);
 assert.equal(state.now,null);assert.equal(state.queue.length,0);
 assert.equal(state.index,-1);assert.equal(state.playRequested,false);
 assert.equal(audio.src,"");assert.equal(audio.loaded,true);
 assert.equal($("miniTitle").textContent,"Выбери песню");
 assert.equal($("studioArtist").textContent,"");
 assert.equal(navigator.mediaSession.metadata,null);
 assert.equal(navigator.mediaSession.playbackState,"none");
 assert.equal(vm.runInContext("playbackGeneration",context),11);
 assert.equal(syncs,1);
});
test("rejection is generation-guarded and autoplay errors retain a manual Play path",()=>{
 assert.match(source,/if\(generation!==playbackGeneration\)return;/);
 assert.match(source,/err\?\.name==="NotAllowedError"/);
 assert.match(source,/if\(event==="error"&&audio\.error&&audio\.src\)/);
 assert.doesNotMatch(source,/window\.VetogramExperimental/);
});
