import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const code=read('telegram-chats.js'),html=read('studio.html'),css=read('vetogram-finish-2026.css');
const start=code.indexOf('  function openPhotoViewer(messageId){');
const end=code.indexOf('  function inlineImage(message){',start);
assert.ok(start>0&&end>start,'must test the actual media viewer controller');
const realOpen=code.slice(start,end);

function fixture(mime='image/jpeg',href='blob:my-photo',valid=true){
  const img={},save={},dialog={open:false,showModal(){this.open=true}};
  const elements={telegramThreadPhotoDialog:dialog,telegramThreadPhotoFull:img,telegramThreadPhotoSave:save};
  const state={
    thread:{id:'my-chat'},
    mediaPreviewUrls:new Map([['42',href]]),
    mediaUrls:valid?[href]:[],
    mediaMimeByUrl:new Map([[href,mime]])
  };
  const context={resetOwner:()=>false,state,$:key=>elements[key]};
  vm.runInNewContext(realOpen+';openPhotoViewer(42)',context);
  return {img,save,dialog};
}
test('photo lightbox preserves real PNG/WebP/GIF instead of misnaming all files JPG',()=>{
  for(const [mime,extension] of [
    ['image/png','png'],['image/webp','webp'],['image/gif','gif'],
    ['image/jpeg','jpg'],['image/unknown','jpg']
  ]){
    const f=fixture(mime);
    assert.equal(f.dialog.open,true);
    assert.equal(f.img.src,'blob:my-photo');
    assert.equal(f.save.href,'blob:my-photo');
    assert.equal(f.save.download,'vetogram-photo-42.'+extension);
  }
});
test('photo viewer refuses non-owner or non-live local blob links',()=>{
  const invalid=fixture('image/png','blob:my-photo',false);
  assert.equal(invalid.dialog.open,false);
  const remote=fixture('image/png','https://other.site/image.png');
  assert.equal(remote.dialog.open,false);
  const state={thread:{id:'chat'},mediaPreviewUrls:new Map([['42','blob:a']]),
    mediaUrls:['blob:a'],mediaMimeByUrl:new Map([['blob:a','image/png']])};
  let opened=false;
  const $=()=>({showModal(){opened=true}});
  vm.runInNewContext(realOpen+';openPhotoViewer(42)',{resetOwner:()=>true,state,$});
  assert.equal(opened,false);
});
test('MIME is derived from downloaded Blob for live/archive/expanded images only',()=>{
  assert.match(code,/mediaMimeByUrl:new Map\(\)/);
  assert.match(code,/if\(action==='photo'\)state\.mediaMimeByUrl\.set\(href,blob\.type\.toLowerCase\(\)\)/);
  assert.match(code,/state\.mediaMimeByUrl\.set\(href,blob\.type\.toLowerCase\(\)\)/);
  assert.match(code,/if\(mime\.startsWith\('image\/'\)\)state\.mediaMimeByUrl\.set\(href,mime\)/);
  assert.match(code,/state\.mediaPreviewUrls\.clear\(\);state\.mediaMimeByUrl\.clear\(\)/);
  assert.match(code,/state\.mediaMimeByUrl\.delete\(old\.href\)/);
  assert.match(code,/state\.mediaMimeByUrl\.delete\(href\);URL\.revokeObjectURL\(href\)/);
});
test('real image viewer has touch-safe controls, reduced motion and is not a demo',()=>{
  for(const id of ['telegramThreadPhotoDialog','telegramThreadPhotoFull','telegramThreadPhotoClose',
    'telegramThreadPhotoSave','telegramThreadVoicePreview','telegramThreadVoicePlayer'])
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  const part=css.slice(css.indexOf('VETOGRAM 3.6 · real media lightbox'));
  assert.ok(part.length>3000);
  assert.match(part,/\.veto-mirror-photo-head button\{\s*width:44px;min-width:44px;height:44px/);
  assert.match(part,/\.veto-mirror-photo-dialog:not\(\[open\]\)\{display:none!important\}/);
  assert.match(part,/@media\(max-width:520px\)/);
  assert.match(part,/safe-area-inset-top/);
  assert.match(part,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(part,/fetch\(|setInterval\(|localStorage|new Image\(/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});


test('voice record control announces its actual state without sending or recording automatically',()=>{
  const begin=code.indexOf("    const voiceButton=$('telegramThreadRecordVoice');");
  const end=code.indexOf("    form.classList.toggle('is-readonly'",begin);
  assert.ok(begin>0&&end>begin);
  const handler=code.slice(begin,end);
  for(const on of [false,true]){
    const attrs={},classes={};
    const voice={
      setAttribute:(name,value)=>{attrs[name]=value},
      classList:{toggle:(name,val)=>{classes[name]=val}}
    };
    const state={recording:on?{started:123}:null,pendingAttachment:null,sendInFlight:false};
    vm.runInNewContext(handler,{
      state,writable:true,$:id=>id==='telegramThreadRecordVoice'?voice:null,Boolean,String
    });
    assert.equal(attrs['aria-pressed'],String(on));
    assert.equal(attrs['aria-label'],on?'Завершить запись голосового':'Начать запись голосового');
    assert.equal(classes.recording,on);
    assert.equal(voice.textContent,on?'■':'◉');
    assert.equal(voice.disabled,false);
  }
  assert.doesNotMatch(handler,/getUserMedia\(|\.start\(|sendOutgoing\(|fetch\(/);
});
