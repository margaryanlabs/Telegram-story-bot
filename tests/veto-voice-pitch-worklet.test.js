import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function createWorklet(factor){
  const code=read('public/veto-voice-pitch-worklet.js');
  const registered={};
  runInNewContext(code,{
    AudioWorkletProcessor:class {},
    registerProcessor:(name,ctor)=>{registered[name]=ctor},
    Float32Array,Math,Number,
  });
  assert.equal(typeof registered['veto-pitch-shifter'],'function');
  return new registered['veto-pitch-shifter']({processorOptions:{factor}});
}

test('pitch Worklet has bounded buffers and clips invalid DSP samples safely',()=>{
  const low=createWorklet(.79),high=createWorklet(1.24);
  assert.ok(low.factor<1&&high.factor>1);
  assert.equal(low.ring.length,16384);
  for(const worklet of [low,high]){
    let power=0,peaks=0;
    for(let n=0;n<450;n++){
      const input=new Float32Array(128);
      for(let i=0;i<128;i++)input[i]=Math.sin(2*Math.PI*330*(n*128+i)/48000)*.5;
      const output=new Float32Array(128);
      assert.equal(worklet.process([ [input] ],[[output]]),true);
      for(const sample of output){
        assert.ok(Number.isFinite(sample));
        assert.ok(sample<=1&&sample>=-1);
        if(n>40){power+=sample*sample;peaks=Math.max(peaks,Math.abs(sample))}
      }
    }
    assert.ok(power>100,'pitch output must contain real non-silent audio');
    assert.ok(peaks>.1,'preview should be audible');
  }
});

test('Voice Changer is built into actual recorded audio stream, not a cosmetic button',()=>{
 const html=read('public/studio.html'),js=read('public/telegram-chats.js');
 assert.match(html,/data-chat-voice-preset="low"/);
 assert.match(html,/data-chat-voice-preset="high"/);
 assert.match(html,/data-chat-voice-preset="robot"/);
 assert.match(js,/async function processedVoiceStream\(microphone,preset\)/);
 assert.match(js,/await context\.audioWorklet\.addModule\('\/veto-voice-pitch-worklet\.js'\)/);
 assert.match(js,/new AudioWorkletNode\(context,'veto-pitch-shifter'/);
 assert.match(js,/effect=await processedVoiceStream\(stream,preset\)/);
 assert.match(js,/oscillator\.frequency\.value=57/);
 assert.match(js,/recordStream:output\.stream/);
 assert.match(js,/String\(state\.thread\?\.id\)!==origin/);
 assert.match(js,/draft\.preset==='low'/);
 assert.match(js,/draft\.preset==='high'/);
 assert.match(js,/draft\.preset==='robot'/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB/);
});

test('pitch shifter processor never uses network, model API, auth or persistence',()=>{
 const code=read('public/veto-voice-pitch-worklet.js');
 assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon/);
 assert.match(code,/registerProcessor\('veto-pitch-shifter'/);
});
