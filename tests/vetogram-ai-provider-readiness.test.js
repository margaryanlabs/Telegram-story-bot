/* Real VETOGRAM AI configuration probe: zero prompt, quota and provider cost.
 * Offline harness only; these tests do not invoke a model or Telegram.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {uiText} from '../public/vetogram-locale-core.js';

const api=readFileSync(new URL('../api/vetogram-ai.js',import.meta.url),'utf8');
const client=readFileSync(new URL('../public/vetogram-ai.js',import.meta.url),'utf8');
const serverBody=api.replace(/^import [^\n]*\n/gm,'')
  .replace('export default async function handler','async function handler');
const begin=client.indexOf('async function checkAiAvailability(){');
const end=client.indexOf('  async function request(',begin);
assert.ok(begin>0&&end>begin);
const clientHandler=client.slice(begin,end).trim();

function server(env,authorized=true){
  let billed=0,invoked=0;
  const process={env:{TELEGRAM_BOT_TOKEN:'fake-bot',...env}};
  const handler=vm.runInNewContext(serverBody+';handler',{
    process,
    validateTelegramMiniApp:()=>authorized?{id:'123'}:null,
    reserveAiBudget:async()=>{billed++;throw Error('BUDGET_MUST_NOT_RUN')},
    fetch:async()=>{invoked++;throw Error('PROVIDER_MUST_NOT_RUN')},
  });
  const run=async(method='GET',headers={'x-telegram-init-data':'signed-owner'})=>{
    const response={
      statusCode:0,body:null,headers:{},
      setHeader(name,value){this.headers[name]=value},
      status(code){this.statusCode=code;return this},
      json(data){this.body=data;return this},
    };
    await handler({method,headers},response);
    return response;
  };
  return {run,stats:()=>({billed,invoked})};
}
test('AI GET is authenticated and never spends quota or invokes provider',async()=>{
  for(const [env,configured,state] of [
    [{},false,'disabled'],
    [{VETOGRAM_AI_ENABLED:'true'},false,'provider_missing'],
    [{VETOGRAM_AI_ENABLED:'true',VETOGRAM_GEMINI_API_KEY:'private-fake-value'},true,'configured']
  ]){
    const s=server(env),res=await s.run();
    assert.equal(res.statusCode,200);
    assert.equal(res.body.configured,configured);
    assert.equal(res.body.state,state);
    assert.equal(JSON.stringify(res.body).includes('private-fake-value'),false);
    assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
    assert.deepEqual(s.stats(),{billed:0,invoked:0});
  }
});
test('unauthorized status and unsafe HTTP methods reveal no provider configuration',async()=>{
  const s=server({VETOGRAM_AI_ENABLED:'true',VETOGRAM_GEMINI_API_KEY:'fake'},false);
  const status=await s.run();
  assert.equal(status.statusCode,401);
  assert.equal(status.body.configured,undefined);
  const patch=await s.run('PATCH');
  assert.equal(patch.statusCode,405);
  assert.deepEqual(s.stats(),{billed:0,invoked:0});
});
test('POST retains explicit AI-content consent, independent of status GET',async()=>{
  const s=server({VETOGRAM_AI_ENABLED:'true',VETOGRAM_GEMINI_API_KEY:'fake'});
  const result=await s.run('POST');
  assert.equal(result.statusCode,403);
  assert.deepEqual(s.stats(),{billed:0,invoked:0});
});
function clientFixture(reply){
  const state={identity:'signed-A',requestEpoch:1,aiAvailability:null,
    aiAvailabilityIntent:0,aiAvailabilityCheckedAt:0,busy:false};
  const controls={vtaiCreate:{disabled:false},vtaiQuota:{textContent:''}};
  const calls=[];
  let activeLocale='ru';
  const window={VetogramI18n:{t:(key,ru)=>uiText(key,activeLocale,ru)}};
  const scope=()=>({identity:state.identity,epoch:state.requestEpoch,ownerId:'123'});
  const sandbox={
    state,window,$:id=>controls[id],
    safeIdentity:()=>true,
    ownerRequestScope:scope,
    isOwnerRequestCurrent:x=>x.identity===state.identity&&x.epoch===state.requestEpoch,
    fetch:async(url,options)=>{calls.push({url,options});return reply()},
    AbortController,setTimeout,clearTimeout,Date,
  };
  const check=vm.runInNewContext('('+clientHandler+')',sandbox);
  return {check,controls,calls,state,setLocale:value=>{activeLocale=value}};
}
test('client shows disabled generation, keeps drafts, and never transmits prompt',async()=>{
  const s=clientFixture(async()=>({ok:true,json:async()=>({configured:false,state:'provider_missing'})}));
  await s.check();
  assert.equal(s.state.aiAvailability,false);
  assert.equal(s.controls.vtaiCreate.disabled,true);
  assert.match(s.controls.vtaiQuota.textContent,/не подключена/);
  assert.equal(s.calls.length,1);
  assert.equal(s.calls[0].url,'/api/vetogram-ai');
  assert.equal(s.calls[0].options.method,'GET');
  assert.equal(s.calls[0].options.body,undefined);
  assert.equal(s.calls[0].options.headers['x-vetogram-ai-consent'],undefined);
  await s.check();
  assert.equal(s.calls.length,1,'re-entering within 60 seconds reuses owner-bound status');
});
test('enabled configuration is not misrepresented as a successful model request',async()=>{
  const s=clientFixture(async()=>({ok:true,json:async()=>({configured:true,state:'configured'})}));
  await s.check();
  assert.equal(s.state.aiAvailability,true);
  assert.equal(s.controls.vtaiCreate.disabled,false);
  assert.match(s.controls.vtaiQuota.textContent,/проверится после твоего согласия/);
});
test('late A status cannot overwrite B account availability or private UI',async()=>{
  let finish;
  const pending=new Promise(resolve=>{finish=resolve});
  const s=clientFixture(()=>pending);
  const running=s.check();
  s.state.identity='signed-B';s.state.requestEpoch+=1;
  s.state.aiAvailabilityIntent+=1;
  s.controls.vtaiQuota.textContent='Новый аккаунт';
  finish({ok:true,json:async()=>({configured:false})});
  await running;
  assert.equal(s.state.aiAvailability,null);
  assert.equal(s.controls.vtaiQuota.textContent,'Новый аккаунт');
  assert.equal(s.controls.vtaiCreate.disabled,false);
});


test('cached AI status changes RU EN HY without a new network or provider call',async()=>{
  const s=clientFixture(async()=>({ok:true,json:async()=>({configured:false,state:'provider_missing'})}));
  await s.check();
  assert.match(s.controls.vtaiQuota.textContent,/не подключена/);
  s.setLocale('en');
  await s.check();
  assert.match(s.controls.vtaiQuota.textContent,/not connected yet/);
  s.setLocale('hy');
  await s.check();
  assert.match(s.controls.vtaiQuota.textContent,/AI գեներացումը/);
  assert.equal(s.calls.length,1,'locale switches must repaint only cached owner state');
  assert.equal(s.controls.vtaiCreate.disabled,true);
});
