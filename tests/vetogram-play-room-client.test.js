import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const client=readFileSync(new URL('../public/vetogram-play-room.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function element(){
  return {
    textContent:'',value:'',disabled:false,hidden:false,children:[],events:{},dataset:{},
    classList:{contains:name=>name==='active'},
    addEventListener(k,fn){this.events[k]=fn;},
    replaceChildren(){this.children=[];},
    appendChild(child){this.children.push(child);},
    setAttribute(){},focus(){},select(){},
    click(){this.events.click?.();},
  };
}
function harness(configured,initialRoom){
  const ids=['#vpRoomCreate','#vpRoomJoin','#vpRoomCodeInput','#vpRoomAvailability','#vpRoomSession',
    '#vpRoomCode','#vpRoomSeat','#vpRoomBoard','#vpRoomStatus','#vpRoomRefresh','#vpRoomExit',
    '#vpRoomCopy','#vpRoomRound','#vpRoomRematch'];
  const elements=new Map(ids.map(id=>[id,element()]));
  const root={
    classList:{contains:name=>name==='active'},
    querySelector:s=>elements.get(s)||null,
  };
  const calls=[],intervals=new Map(),events={},storage=new Map();
  let nextInterval=1;
  let serverRoom=initialRoom;
  const fetch=async(url,request={})=>{
    if(url.includes('?health=1'))return {ok:true,json:async()=>({ok:true,configured})};
    const body=JSON.parse(request.body||'{}');
    calls.push({url,method:request.method,body});
    if(body.action==='create')return {ok:true,json:async()=>({ok:true,room:serverRoom})};
    if(body.action==='rematch'){
      serverRoom={...serverRoom,round:serverRoom.round+1,board:'.........',turn:'X',
        status:'active',winner:null,version:serverRoom.version+1,seat:'X',
        rematchRequested:false,opponentRequested:false};
      return {ok:true,json:async()=>({ok:true,room:serverRoom})};
    }
    return {ok:false,json:async()=>({ok:false,error:'unknown_action'})};
  };
  const window={
    Telegram:{WebApp:{initData:'signed-placeholder'}},
    location:{search:'',origin:'https://vetogram.test'},
    navigator:{},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setInterval(fn,ms){const id=nextInterval++;intervals.set(id,{fn,ms});return id;},
    clearInterval(id){intervals.delete(id);},
    addEventListener(k,fn){events[k]=fn;},
  };
  const document={
    hidden:false,
    querySelector:s=>s==='.screen[data-screen="play"]'?root:null,
    createElement:element,
    addEventListener(k,fn){events['document:'+k]=fn;},
  };
  runInNewContext(client,{window,document,fetch,URL,URLSearchParams});
  return {elements,fetch,calls,intervals,events,window,storage};
}
test('Online room UI stays disabled when Neon is not configured',async()=>{
  const ui=harness(false,null);
  await flush();
  assert.equal(ui.elements.get('#vpRoomCreate').disabled,true);
  assert.equal(ui.elements.get('#vpRoomJoin').disabled,true);
  assert.match(ui.elements.get('#vpRoomAvailability').textContent,/Neon ещё не подключён/);
  assert.equal(ui.calls.length,0,'no game mutation attempted');
});
test('Finished round displays invitation to accept rematch, then rotates seats',async()=>{
  const finished={
    code:'ABCD2345',seat:'O',guestJoined:true,board:'XXXOO....',turn:'O',
    status:'finished',winner:'X',version:6,round:2,
    rematchRequested:false,opponentRequested:true,
  };
  const ui=harness(true,finished);
  await flush();
  ui.elements.get('#vpRoomCreate').click();
  await flush();
  const button=ui.elements.get('#vpRoomRematch');
  assert.equal(button.hidden,false);
  assert.equal(button.textContent,'Принять реванш');
  assert.equal(ui.elements.get('#vpRoomRound').textContent,'2');
  assert.equal(ui.elements.get('#vpRoomSeat').textContent,'O');
  assert.equal(ui.elements.get('#vpRoomBoard').children.length,9);
  button.click();
  await flush();
  assert.deepEqual(ui.calls.map(x=>x.body.action),['create','rematch']);
  assert.equal(ui.calls[1].body.code,'ABCD2345');
  assert.equal(ui.calls[1].body.version,6);
  assert.equal(ui.elements.get('#vpRoomRound').textContent,'3');
  assert.equal(ui.elements.get('#vpRoomSeat').textContent,'X');
  assert.equal(button.hidden,true);
});
test('No rematch is offered until a game is finished',async()=>{
  const active={code:'ABCD2345',seat:'X',guestJoined:true,board:'.........',turn:'X',
    status:'active',winner:null,version:1,round:1,rematchRequested:false,opponentRequested:false};
  const ui=harness(true,active);
  await flush();
  ui.elements.get('#vpRoomCreate').click();
  await flush();
  const button=ui.elements.get('#vpRoomRematch');
  assert.equal(button.hidden,true);
  assert.equal(button.disabled,true);
  assert.ok(ui.intervals.size>0,'active room polls for opposing moves');
});
test('Room UI and API expose no chat or Business permissions',()=>{
  assert.match(html,/id="vpRoomRound"/);
  assert.match(html,/id="vpRoomRematch"/);
  assert.doesNotMatch(client,/telegram-chats|document\.cookie|sendMessage|BusinessConnection/);
});
