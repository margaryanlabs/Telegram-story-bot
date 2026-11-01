/* VETOGRAM 6.4 — playback truth and verified-source regression gates.
 * Real playback still must be confirmed on each user's device and region.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const provider=get('public/cinema-provider.js');
const cinema=get('public/cinema.js');
const html=get('public/cinema.html');
const music=get('public/vetogram-music.js');
const licensed=get('public/vetogram-music-licensed-home-63.js');
const musicHtml=get('public/music-module.html');
const service=get('cinema-service/official-rutube.mjs');

test('RUTUBE iframe requires a real playStart or playing event; ready does not certify playback',async()=>{
  let message=null,frame=null;
  const window={
    addEventListener:(type,cb)=>{if(type==='message')message=cb},
    removeEventListener:()=>{},
  };
  const document={createElement:()=>{frame={
    contentWindow:{postMessage:()=>{}},
    setAttribute:()=>{},addEventListener:()=>{},remove:()=>{},
  };return frame}};
  vm.runInNewContext(provider,{window,document,URL,Promise,Error,Number,JSON});
  const filmId='1234567890abcdef1234567890abcdef';
  const events=[],ready=[],errors=[],video={hidden:false};
  const embed=await window.VetogramCinemaProvider.attach({
    video,container:{append:()=>{}},
    source:{type:'iframe',url:'https://rutube.ru/play/embed/'+filmId,licensed:true,license:'original',credit:'Official studio'},
    allowedIframeOrigins:['https://rutube.ru'],
    onReady:()=>ready.push('loaded'),
    onEvent:e=>events.push(e),
    onError:e=>errors.push(e)
  });
  const emit=(type,data={},origin='https://rutube.ru',source=frame.contentWindow)=>message({origin,source,data:JSON.stringify({type,data})});
  emit('player:ready',{videoId:filmId});
  assert.equal(ready.length,1);
  assert.equal(events.length,0,'ready must not be treated as video playing');
  emit('player:playStart',{video_id:filmId});
  assert.equal(events.at(-1).type,'playStarted');
  emit('player:changeState',{state:'playing',videoId:filmId});
  assert.equal(events.at(-1).state,'playing');
  emit('player:error',{text:'video unavailable',videoId:filmId});
  assert.equal(errors.length,1);
  emit('player:playStart',{video_id:'ffffffffffffffffffffffffffffffff'});
  emit('player:playStart',{video_id:filmId},'https://attacker.invalid');
  emit('player:playStart',{video_id:filmId},'https://rutube.ru',{});
  assert.equal(events.length,2,'ignore forged origins, iframe windows and mismatched video IDs');
  embed.cleanup();
  assert.equal(video.hidden,false);
});

test('Cinema hides failed official streams from one-tap list, does not equate ready with play and supports serial genres',()=>{
  assert.match(cinema,/const failedEmbeds=new Set\(\)/);
  assert.match(cinema,/failedEmbeds\.has\(f\.id\)/);
  assert.match(cinema,/event\.type==="playStarted"/);
  assert.match(cinema,/event\.type==="state"&&event\.state==="playing"/);
  assert.match(cinema,/onReady:\(\)=>\{\s*if\(token===state\.request\)setPlayerMessage\("Плеер готов/);
  assert.match(cinema,/failedEmbeds\.add\(f\.id\)/);
  assert.match(html,/id="cinemaSeriesGenres"/);
  assert.match(cinema,/state\.seriesGenre==="Все"/);
  assert.match(html,/cinema-series-popular hidden/,'do not display contemporary serial discovery-only promos');
});

test('two extra RUTUBE rights-holder channels are configured but never bypass author, runtime or embed rights checks',()=>{
  const js=service.replace(/\bexport\s+/g,'');
  const parsed=new Function(js+'\nreturn {CHANNELS,parseVideo};')();
  assert.equal(Object.keys(parsed.CHANNELS).length,8);
  assert.equal(parsed.CHANNELS.rossiya1.id,24620967);
  assert.equal(parsed.CHANNELS.centralpartnership.id,798788);
  const video={id:'fedcba9876543210fedcba9876543210',author:{id:24620967},
    title:'Реальный фильм / Официальная публикация',duration:60*85,
    description:'Полнометражный фильм',is_embeddable:true,is_paid:false};
  const record=parsed.parseVideo(video,'rossiya1');
  assert.ok(record,'valid official long-form release accepted');
  assert.equal(record.player.type,'iframe');
  assert.equal(record.player.licensed,true);
  assert.equal(parsed.parseVideo({...video,author:{id:10}},'rossiya1'),null);
  assert.equal(parsed.parseVideo({...video,is_paid:true},'rossiya1'),null);
  assert.equal(parsed.parseVideo({...video,title:'Трейлер фильма'},'rossiya1'),null);
  for(const key of ['rossiya1','centralpartnership'])assert.ok(html.includes('data-studio="'+key+'"'));
});

test('MP3 session confirms the real playing event; timeout and error quarantine failed source',()=>{
  assert.match(music,/\["play","playing","pause"/);
  assert.match(music,/vetogram:audio-playing/);
  assert.match(licensed,/vetogram:audio-playing/);
  assert.match(licensed,/vetogram:audio-error/);
  assert.match(licensed,/pendingTimer=setTimeout/);
  assert.match(licensed,/unavailable\.add\(key\)/);
  assert.match(licensed,/unavailable\.add\(id\)/);
  assert.match(musicHtml,/id="licensedHomeStatus"/);
  assert.doesNotMatch(musicHtml,/Нажми ▶ — музыка играет/);
});
