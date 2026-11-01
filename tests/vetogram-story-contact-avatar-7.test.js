import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-stories.js',import.meta.url),'utf8');
const start=source.indexOf('  function syncKnownContactAvatars() {');
const end=source.indexOf('  function storyOrder() {',start);
assert.ok(start>0&&end>start,'production contact-avatar sync must be present');
const snippet=source.slice(start,end);

function fixture({userId=55,chatId='55',hasImage=true}={}){
 let avatar=null;
 const face={
  img:null,textContent:'AD',
  querySelector(){return this.img;},
  contains(node){return this.img===node;},
  replaceChildren(node){this.img=node;this.textContent='';}
 };
 const list={querySelectorAll:()=>[{
  dataset:{vetoAvatar:chatId},
  querySelector:()=>hasImage?{src:'blob:owner-photo'}:null,
 }]};
 const bar={querySelectorAll:()=>[{
  dataset:{vetoStoryPerson:'0'},
  querySelector:()=>face
 }]};
 const ctx={state:{contacts:[{userId,name:'Alice Doe'}]},bar,
  $:id=>id==='telegramMirrorList'?list:null,
  initials:()=> 'AD',
  document:{createElement:tag=>{
   assert.equal(tag,'img');
   const listeners=new Map();
   avatar={src:'',className:'',alt:'',addEventListener:(name,handler)=>listeners.set(name,handler),
    fail(){listeners.get('error')?.();}};
   return avatar;
  }}
 };
 vm.runInNewContext(snippet+'\nthis.syncKnownContactAvatars=syncKnownContactAvatars;',ctx,
  {filename:'vetogram-story-avatar-source.js',timeout:1000});
 return {sync:ctx.syncKnownContactAvatars,face,get avatar(){return avatar;}};
}

test('numeric story owner ID matches string-valued chat avatar ID',()=>{
 const f=fixture({userId:55,chatId:'55'});
 f.sync();
 assert.equal(f.face.img?.src,'blob:owner-photo');
 assert.equal(f.face.img?.className,'veto-story-contact-photo');
});

test('a different chat ID cannot donate its private avatar to the story strip',()=>{
 const f=fixture({userId:55,chatId:'99'});
 f.sync();
 assert.equal(f.face.img,null);
});

test('a missing chat portrait preserves text initials',()=>{
 const f=fixture({userId:'55',chatId:'55',hasImage:false});
 f.sync();
 assert.equal(f.face.img,null);
 assert.equal(f.face.textContent,'AD');
});

test('broken or revoked thumbnail falls back to initials instead of broken image icon',()=>{
 const f=fixture({userId:55,chatId:'55'});
 f.sync();
 f.avatar.fail();
 assert.equal(f.face.textContent,'AD');
});
