import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const js=readFileSync(new URL('../public/vetogram-play-stats.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
function element(){
  return {
    textContent:'',value:'',checked:false,disabled:false,hidden:false,children:[],events:{},
    setAttribute(){},replaceChildren(){this.children=[];},
    appendChild(node){this.children.push(node);},
    addEventListener(type,fn){this.events[type]=fn;},
    click(){this.events.click?.();},
  };
}
function setup(configured=true){
  const names=[
    '#vpStatsState','#vpStatsContent','#vpStatsRefresh','#vpProfileAlias',
    '#vpLeaderboardConsent','#vpMatchHistory','#vpLeaderboard','#vpLeadersState',
    '#vpLeadersRefresh','#vpStatGames','#vpStatWins','#vpStatDraws','#vpStatPoints',
  ];
  const nodes=new Map(names.map(n=>[n,element()]));
  const root={querySelector:id=>nodes.get(id)||null,classList:{contains:()=>true}};
  const calls=[];
  let optedIn=false;
  const fetch=async (url,request={})=>{
    if(url.includes('health=1'))return {ok:true,json:async()=>({ok:true,configured})};
    const body=request.body?JSON.parse(request.body):null;
    calls.push({url,body,headers:request.headers});
    if(body?.action==='leaderboard_visibility'){
      optedIn=body.visible;
      return {ok:true,json:async()=>({ok:true,profile:{alias:'VP-23456789AB',leaderboardVisible:optedIn}})};
    }
    if(url.includes('view=leaders')){
      return {ok:true,json:async()=>({ok:true,leaders:optedIn?[{alias:'VP-23456789AB',games:3,wins:2,draws:0,losses:1,points:6}]:[]})};
    }
    return {ok:true,json:async()=>({ok:true,profile:{alias:'VP-23456789AB',leaderboardVisible:optedIn},
      stats:{games:3,wins:2,draws:0,losses:1,points:6},history:[]})};
  };
  const window={Telegram:{WebApp:{initData:'signed-test'}} ,addEventListener(){}};
  const document={hidden:false,querySelector:s=>s==='.screen[data-screen="play"]'?root:null,
    createElement:element,addEventListener(){}};
  runInNewContext(js,{window,document,fetch,Date});
  return {nodes,calls,get optedIn(){return optedIn;}};
}
test('Profile UI is disabled and never invents a leaderboard without Neon',async()=>{
  const app=setup(false);await flush();
  assert.equal(app.nodes.get('#vpStatsRefresh').disabled,true);
  assert.equal(app.nodes.get('#vpLeaderboardConsent').disabled,true);
  assert.equal(app.nodes.get('#vpStatsContent').hidden,true);
  assert.match(app.nodes.get('#vpStatsState').textContent,/после подключения/);
  assert.equal(app.calls.length,0);
});
test('Profile and history are read from a signed server request, never local scores',async()=>{
  const app=setup(true);await flush();
  assert.equal(app.nodes.get('#vpStatsContent').hidden,false);
  assert.equal(app.nodes.get('#vpProfileAlias').textContent,'VP-23456789AB');
  assert.equal(app.nodes.get('#vpStatGames').textContent,'3');
  assert.equal(app.nodes.get('#vpStatWins').textContent,'2');
  assert.equal(app.nodes.get('#vpStatPoints').textContent,'6');
  assert.equal(app.nodes.get('#vpLeaderboardConsent').checked,false);
  assert.ok(app.calls.every(call=>call.headers['x-telegram-init-data']==='signed-test'));
});
test('Leaderboard visibility toggles only after the user changes consent',async()=>{
  const app=setup(true);await flush();
  const consent=app.nodes.get('#vpLeaderboardConsent');
  assert.equal(app.optedIn,false);
  consent.checked=true;
  await consent.events.change();
  await flush();
  assert.equal(app.optedIn,true);
  assert.equal(app.calls.at(-1).body.action,'leaderboard_visibility');
  app.nodes.get('#vpLeadersRefresh').click();
  await flush();
  const entries=app.nodes.get('#vpLeaderboard').children;
  assert.equal(entries.length,1);
  assert.match(entries[0].children[0].children[0].textContent,/VP-23456789AB/);
  consent.checked=false;
  await consent.events.change();
  await flush();
  assert.equal(app.optedIn,false);
  assert.equal(app.nodes.get('#vpLeaderboard').children.length,0);
});
