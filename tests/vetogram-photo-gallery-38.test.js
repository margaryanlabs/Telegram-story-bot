import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=n=>readFileSync(new URL('../public/'+n,import.meta.url),'utf8');
const chats=read('telegram-chats.js'),html=read('studio.html'),css=read('vetogram-finish-2026.css');
const start=chats.indexOf('  function loadedPhotoIds(){');
const end=chats.indexOf('  function inlineImage(message){',start);
assert.ok(start>=0&&end>start);
const gallery=chats.slice(start,end);

function fixture(owner='signed',available=true){
  const urls=['blob:photo1','blob:photo2','blob:photo3'];
  const state={thread:{id:'thread'},ownerInitData:'signed',activePhotoId:null,
    messages:[{id:11},{id:42},{id:72}],mediaUrls:available?urls:[urls[1]],
    mediaPreviewUrls:new Map([['11',urls[0]],['42',urls[1]],['72',urls[2]]]),
    mediaMimeByUrl:new Map([[urls[0],'image/jpeg'],[urls[1],'image/png'],[urls[2],'image/webp']])};
  const image={alt:'',removeAttribute(name){delete this[name]}};
  const save={removeAttribute(name){delete this[name]}};
  const prev={hidden:true},next={hidden:true},count={hidden:true,textContent:''};
  const dialog={open:false,showModal(){this.open=true},close(){this.open=false}};
  const elements={telegramThreadPhotoFull:image,telegramThreadPhotoSave:save,
    telegramThreadPhotoDialog:dialog,telegramThreadPhotoPrev:prev,
    telegramThreadPhotoNext:next,telegramThreadPhotoCount:count};
  const actions=runInNewContext(gallery+';({loadedPhotoIds,openPhotoViewer,closePhotoViewer,moveLoadedPhoto})',
    {state,tg:{initData:owner},resetOwner:()=>false,$:id=>elements[id]});
  return {state,image,save,prev,next,count,dialog,...actions};
}
test('real gallery shows previously loaded owner photos and counter',()=>{
  const f=fixture();assert.equal(Array.from(f.loadedPhotoIds()).join(','),'11,42,72');
  f.openPhotoViewer(42);assert.equal(f.dialog.open,true);
  assert.equal(f.image.src,'blob:photo2');assert.equal(f.save.download,'vetogram-photo-42.png');
  assert.equal(f.count.textContent,'2 из 3 загруженных');
  assert.equal(f.prev.hidden,false);assert.equal(f.next.hidden,false);
});
test('prev/next never wraps or mislabels downloaded media',()=>{
  const f=fixture();f.openPhotoViewer(42);f.moveLoadedPhoto(-1);
  assert.equal(f.state.activePhotoId,'11');assert.equal(f.save.download,'vetogram-photo-11.jpg');
  f.moveLoadedPhoto(-1);assert.equal(f.state.activePhotoId,'11');assert.equal(f.prev.hidden,true);
  f.moveLoadedPhoto(1);f.moveLoadedPhoto(1);
  assert.equal(f.state.activePhotoId,'72');assert.equal(f.save.download,'vetogram-photo-72.webp');
  f.moveLoadedPhoto(1);assert.equal(f.state.activePhotoId,'72');assert.equal(f.next.hidden,true);
});
test('gallery refuses different signed owner and evicted media',()=>{
  const wrong=fixture('other-owner');wrong.openPhotoViewer(42);
  assert.equal(wrong.dialog.open,false);assert.equal(wrong.loadedPhotoIds().length,0);
  const one=fixture('signed',false);one.openPhotoViewer(42);
  assert.equal(Array.from(one.loadedPhotoIds()).join(','),'42');
  assert.equal(one.count.hidden,true);one.moveLoadedPhoto(1);
  assert.equal(one.state.activePhotoId,'42');
});
test('closing clears active image and blob download reference',()=>{
  const f=fixture();f.openPhotoViewer(42);f.closePhotoViewer();
  assert.equal(f.state.activePhotoId,null);assert.equal(f.dialog.open,false);
  assert.equal(f.count.hidden,true);
  assert.equal(f.image.hasOwnProperty('src'),false);
  assert.equal(f.save.hasOwnProperty('href'),false);
});
test('buttons, swipe and arrow keys are wired to existing on-device photos',()=>{
  for(const id of ['telegramThreadPhotoPrev','telegramThreadPhotoNext',
    'telegramThreadPhotoCount','telegramThreadPhotoStage','telegramThreadPhotoSave'])
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(chats,/'telegramThreadPhotoPrev'\)\?\.addEventListener\('click'/);
  assert.match(chats,/'telegramThreadPhotoNext'\)\?\.addEventListener\('click'/);
  assert.match(chats,/event\.key==='ArrowLeft'\?-1:1/);
  assert.match(chats,/photoStage\?\.addEventListener\('touchstart'/);
  assert.match(chats,/photoStage\?\.addEventListener\('touchend'/);
  assert.doesNotMatch(gallery,/fetch\(|setInterval\(|localStorage/);
});
test('photo navigation remains accessible and reduced-motion safe',()=>{
  const art=css.slice(css.indexOf('VETOGRAM 3.8 · owner-scoped'));
  assert.ok(art.length>2400);
  assert.match(art,/width:44px;height:48px/);
  assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(art,/:focus-visible/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});


test('swipe direction, threshold, vertical scroll and arrow keys have real event handlers',()=>{
  const start=chats.indexOf('  // Navigate only photos already downloaded');
  const end=chats.indexOf("  $('telegramThreadPhotoClose')?.addEventListener",start);
  assert.ok(start>0&&end>start);
  const code=chats.slice(start,end);
  const events={prev:{},next:{},dialog:{},stage:{}},moves=[];
  const button=(name)=>({
    addEventListener:(type,fn)=>{events[name][type]=fn}
  });
  const elements={telegramThreadPhotoPrev:button('prev'),
    telegramThreadPhotoNext:button('next'),
    telegramThreadPhotoDialog:button('dialog'),
    telegramThreadPhotoStage:button('stage')};
  runInNewContext(code,{$:id=>elements[id],moveLoadedPhoto:dir=>moves.push(dir)});
  events.prev.click();events.next.click();
  assert.equal(moves.join(','),'-1,1');
  let prevented=0;
  events.dialog.keydown({key:'ArrowLeft',preventDefault(){prevented++}});
  events.dialog.keydown({key:'ArrowRight',preventDefault(){prevented++}});
  events.dialog.keydown({key:'Escape',preventDefault(){throw Error('Escape handled by native dialog')}});
  assert.equal(moves.join(','),'-1,1,-1,1');assert.equal(prevented,2);
  const touch=(type,x,y,count=1)=>{
    const points=Array.from({length:count},()=>({clientX:x,clientY:y}));
    events.stage[type](
      type==='touchstart'?{touches:points}:{changedTouches:points}
    );
  };
  touch('touchstart',180,120);touch('touchend',100,126);
  touch('touchstart',100,120);touch('touchend',180,118);
  assert.equal(moves.join(','),'-1,1,-1,1,1,-1');
  touch('touchstart',100,120);touch('touchend',130,125);
  touch('touchstart',100,120);touch('touchend',175,240);
  touch('touchstart',100,120,2);touch('touchend',5,121);
  assert.equal(moves.length,6,'short, vertical and two-finger gestures must not navigate');
});
