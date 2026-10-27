/* VETOGRAM 5.1 regression gates for the actual mobile chat controllers.
 * Local VM assertions use fake DOM and no Telegram account, network or user data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('nested Home activity no longer throws NotFoundError during V4 initialization',()=>{
  const source=read('vetogram-experience-v4.js');
  const start=source.indexOf('  // .control-activity can be nested');
  const end=source.indexOf('  const mission =',start);
  assert.ok(start>0&&end>start);
  const snippet=source.slice(start,end);
  const node=()=>{
    const el={children:[],parentNode:null};
    el.add=child=>{child.parentNode=el;el.children.push(child);return child;};
    el.contains=target=>el===target||el.children.some(child=>child.contains(target));
    el.before=other=>{
      const parent=el.parentNode;
      assert.ok(parent,'insertion anchor must have a parent');
      if(other.parentNode){
        const old=other.parentNode.children;
        old.splice(old.indexOf(other),1);
      }
      parent.children.splice(parent.children.indexOf(el),0,other);
      other.parentNode=parent;
    };
    return el;
  };
  const home=node(),resume=home.add(node()),wrapper=home.add(node());
  const activity=wrapper.add(node());
  vm.runInNewContext(snippet,{home,resume,activity});
  assert.equal(resume.parentNode,wrapper);
  assert.deepEqual(wrapper.children,[resume,activity]);
});

test('avatar queue keeps loading newly visible contacts beyond six, with bounded concurrency',async()=>{
  const source=read('telegram-chats.js');
  const start=source.indexOf('  // Demand-driven avatar loading.');
  const end=source.indexOf('  function rememberPreview(',start);
  assert.ok(start>0&&end>start);
  const snippet=source.slice(start,end);
  let page=0,active=0,maximum=0;
  let scroll=null;
  const elements=Array.from({length:14},(_,n)=>({
    dataset:{vetoAvatar:String(n+1)},
    getBoundingClientRect:()=>page===Math.floor(n/7)
      ?{top:80,bottom:120}:{top:4500,bottom:4560},
    closest:()=>null,
    replaceChildren(node){this.image=node},
  }));
  const state={
    ownerInitData:'signed',avatarEpoch:0,avatarActive:0,
    avatarQueue:[],avatarRequested:new Set(),avatarRetryAt:new Map(),avatarUrls:new Map(),
  };
  const ctx=vm.createContext({
    state,
    tg:{initData:'signed'},
    $:()=>({hidden:false}),
    document:{
      querySelector:()=>({dataset:{screen:'telegram'}}),
      querySelectorAll:()=>elements,
      createElement:tag=>({tag}),
    },
    window:{
      innerHeight:700,
      addEventListener:(name,fn)=>{if(name==='scroll')scroll=fn;},
    },
    requestAnimationFrame:fn=>fn(),
    URL:{revokeObjectURL:()=>{}},
    photoRequest:async(action,id)=>{
      assert.equal(action,'avatar');
      active++;maximum=Math.max(maximum,active);
      await Promise.resolve();
      active--;
      return 'blob:'+id;
    },
    Date,
  });
  new vm.Script(snippet).runInContext(ctx);
  // Run the actual queue and its registered scroll callback.
  new vm.Script('queueVisibleAvatars()').runInContext(ctx);
  for(let i=0;i<20&&state.avatarUrls.size<7;i++)await new Promise(r=>setImmediate(r));
  assert.equal(state.avatarUrls.size,7);
  page=1;
  assert.equal(typeof scroll,'function');
  scroll();
  for(let i=0;i<20&&state.avatarUrls.size<14;i++)await new Promise(r=>setImmediate(r));
  assert.equal(state.avatarUrls.size,14);
  assert.ok(maximum<=2,'at most two Telegram media requests at a time');
  assert.equal(state.avatarUrls.get('14'),'blob:14');
});

test('chat avatars and previews are scoped to the signed account and do not persist',()=>{
  const source=read('telegram-chats.js');
  assert.match(source,/state\.avatarEpoch\+\+;state\.avatarQueue=\[\]/);
  assert.match(source,/state\.avatarRetryAt\.clear\(\)/);
  assert.match(source,/ownerKey!==String\(tg\?\.initData\|\|''\)/);
  assert.match(source,/URL\.revokeObjectURL\(href\)/);
  assert.doesNotMatch(source,/avatarLoaded>=6/);
});

test('warm thread previews remain owner-scoped while reducing repeat opens',()=>{
  const source=read('telegram-chats.js');
  assert.match(source,/while\(state\.threadCache\.size>6\)/);
  assert.match(source,/Date\.now\(\)-value\.at>300000/);
  assert.match(source,/state\.threadCache\.clear\(\)/);
  assert.match(source,/if\(restoreHotThread\(chat\.id\)\)/);
});

test('Telegram native header and Story preview labels have no stacked title overlay',()=>{
  const script=read('vetogram-experience-v4.js');
  const css=read('vetogram-noir.css');
  assert.match(script,/WebApp\?\.initData\) root\.classList\.add\('v4-telegram-webview'\)/);
  assert.match(css,/\.v4-telegram-webview \.topbar/);
  assert.match(css,/#seTemplates \.noir-template-type,[\s\S]*?display:none!important/);
  assert.match(css,/#seTemplates \.se-template-canvas\{[\s\S]*?height:calc\(100% - 34px\)/);
});
