/* VETOGRAM 6.4 — deterministic media state contract, no live account or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fakeRUTUBE(){
  const handlers=new Map();
  const fakeWindow={
    addEventListener(name,fn){handlers.set(name,fn)},
    removeEventListener(name,fn){if(handlers.get(name)===fn)handlers.delete(name)}
  };
  const frame={
    contentWindow:{postMessage(){}},
    setAttribute(){},
    addEventListener(){},
    remove(){this.removed=true}
  };
  const fakeDocument={createElement:()=>frame};
  const sandbox={window:fakeWindow,document:fakeDocument,URL};
  vm.runInNewContext(read('public/cinema-provider.js'),sandbox);
  const player=sandbox.window.VetogramCinemaProvider;
  const video={hidden:false};
  const container={append(el){this.el=el}};
  const seen={ready:0,error:[],events:[]};
  const id='0123456789abcdef0123456789abcdef';
  const source={
    id:'test',type:'iframe',licensed:true,
    license:'Published by channel owner',credit:'Official RUTUBE studio',
    url:'https://rutube.ru/play/embed/'+id
  };
  const attach=()=>player.attach({video,container,source,
    allowedIframeOrigins:['https://rutube.ru'],
    onReady:()=>seen.ready++,
    onError:msg=>seen.error.push(msg),
    onEvent:evt=>seen.events.push(evt)
  });
  const send=(type,data={},origin='https://rutube.ru',windowRef=frame.contentWindow)=>{
    const handler=handlers.get('message');
    assert.ok(handler);
    handler({origin,source:windowRef,data:JSON.stringify({type,data})});
  };
  return {player,source,attach,send,seen,handlers,video,frame};
}
test('RUTUBE: iframe ready alone never means playback; playStart is a distinct event',async()=>{
  const x=fakeRUTUBE(),handle=await x.attach();
  x.send('player:ready',{videoId:'0123456789abcdef0123456789abcdef'});
  assert.equal(x.seen.ready,1);
  assert.deepEqual(x.seen.events,[]);
  x.send('player:playStart',{video_id:'0123456789abcdef0123456789abcdef'});
  assert.equal(x.seen.events.length,1);
  assert.equal(x.seen.events[0].type,'playStarted');
  x.send('player:changeState',{state:'playing'});
  assert.equal(x.seen.events.at(-1).state,'playing');
  handle.cleanup();
  assert.equal(x.handlers.has('message'),false);
  assert.equal(x.video.hidden,false);
  assert.equal(x.frame.removed,true);
});
test('RUTUBE: rejects wrong origin, fake iframe window and another film ID',async()=>{
  const x=fakeRUTUBE(),handle=await x.attach();
  x.send('player:playStart',{},'https://evil.example');
  x.send('player:playStart',{},'https://rutube.ru',{});
  x.send('player:playStart',{video_id:'ffffffffffffffffffffffffffffffff'});
  assert.equal(x.seen.events.length,0);
  x.send('player:error',{text:'Removed from publisher channel'});
  assert.match(x.seen.error[0],/Removed from publisher channel/);
  handle.cleanup();
});
test('RUTUBE: cannot attach unknown embed origin or unlicensed media',async()=>{
  const x=fakeRUTUBE();
  await assert.rejects(x.player.attach({
    video:x.video,container:{append(){}},
    source:{...x.source,url:'https://unverified.example/embed/test'},
    allowedIframeOrigins:['https://rutube.ru']
  }));
  await assert.rejects(x.player.attach({
    video:x.video,container:{append(){}},
    source:{...x.source,licensed:false},
    allowedIframeOrigins:['https://rutube.ru']
  }));
});
test('Music: selection event cancels old song check, real playing and error remain distinct',()=>{
  const core=read('public/vetogram-music.js'),shelf=read('public/vetogram-music-licensed-home-63.js');
  assert.match(core,/vetogram:audio-selected/);
  assert.match(core,/vetogram:audio-playing/);
  assert.match(core,/vetogram:audio-error/);
  assert.match(shelf,/document\.addEventListener\("vetogram:audio-selected"/);
  assert.match(shelf,/if\(pendingId&&id&&pendingId!==id\)cancelPending\(\)/);
  assert.match(shelf,/if\(V\.now\?\.\(\)\?\.id!==key\)/);
});
test('141 Russian Wikisource IDs remain unique and new public-domain roots are original text pages',()=>{
  const books=read('public/books.js');
  const first=books.indexOf('  const verifiedWholeEditions=');
  const last=books.indexOf('  function setSourceInfo(){',first);
  const catalog=new Function(books.slice(first,last)+'\nreturn completeEditionBooks;')();
  assert.equal(catalog.length,141);
  assert.equal(new Set(catalog.map(x=>x.id)).size,141);
  const newIds=[17924,345607,1028302,4334,36596,355620,26704,24770,40478,4390,4448,17983,17199];
  for(const id of newIds){
    const book=catalog.find(x=>x.id===id);
    assert.ok(book&&book.readable&&book.wiki==='ru'&&book.verifiedSourceBytes>=11000,id);
  }
});
