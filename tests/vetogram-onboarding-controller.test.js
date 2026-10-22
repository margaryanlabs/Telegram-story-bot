import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/privacy.js',import.meta.url),'utf8');
function fixture(enabled=true) {
  const requests=[],listeners={},inputs={};
  const action={disabled:true,textContent:''},picker={hidden:false};
  let scope='selected-private',selected=[];
  for(const id of ['businessWizardConsent','businessWizardAntiDelete','businessWizardStories']) inputs[id]={checked:false};
  const content={innerHTML:''},backdrop={hidden:true};
  const sheet={hidden:true,addEventListener(name,fn){listeners[name]=fn},
    querySelector(selector){
      if(selector==='input[name="vetoBusinessScope"]:checked')return {value:scope};
      if(selector==='[data-business-apply]')return action;
      if(selector==='.veto-consent-chat-list')return picker;
      return null;
    },
    querySelectorAll(selector){if(selector==='[data-business-selected]:checked')return selected.map(value=>({value}));return []},
  };
  const doc={hidden:false,getElementById(id){return ({sheet,sheetContent:content,sheetBackdrop:backdrop,...inputs})[id]||null},
    querySelector(){return null},querySelectorAll(){return []},addEventListener(){}};
  const win={location:{search:''},Telegram:{WebApp:{initData:'fixture-init',BackButton:{show(){},hide(){}}}},addEventListener(){},navigator:{onLine:true}};
  const fetch=async(url,options)=>{
    const body=JSON.parse(options?.body||'{}');requests.push({url,body});
    let result={ok:true};
    if(url==='/api/business-wizard') {
      result=body.action==='prepare'?{ok:true,enabled,state:'none',chats:[{chatId:'101',title:'Test peer'}],snapshotToken:'fixture-snapshot',diagnostics:{}}:
        {ok:true,connected:true,manageStories:body.storiesConsent,settingsUpdated:body.antiDeleteConsent,delivery:{botApi:'pending-webhook'}};
    }
    return {ok:true,json:async()=>result};
  };
  runInNewContext(source,{window:win,document:doc,navigator:{onLine:true},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
    setInterval:()=>1,clearInterval(){},fetch,console,Intl,Blob});
  return {win,requests,inputs,content,sheet,action,async change(){listeners.change({target:{matches:()=>true}})},
    select(value,ids=[]){scope=value;selected=ids},async apply(){await listeners.click({target:{closest:selector=>selector.includes('[data-business-apply]')?{
      ...action,hasAttribute:attr=>attr==='data-business-apply',get disabled(){return action.disabled},set disabled(v){action.disabled=v},
    }:null}})}};
}
test('automatic handoff does not show the new wizard when production capability is disabled',async()=>{
  const f=fixture(false);assert.equal(await f.win.VetoTelegramOpenUnifiedOnboarding({automatic:true}),false);
  assert.equal(f.sheet.hidden,true);assert.equal(f.content.innerHTML,'');assert.equal(f.requests.length,1);
});
test('runtime consent controller requires scope plus separate feature opt-in and submits exact consent',async()=>{
  const f=fixture();assert.equal(await f.win.VetoTelegramOpenUnifiedOnboarding({automatic:true}),true);
  assert.match(f.content.innerHTML,/businessWizardStories/);assert.match(f.content.innerHTML,/businessWizardAntiDelete/);
  assert.equal(f.action.disabled,true);assert.ok(!f.requests.some(r=>r.body.action==='connect'));
  f.select('all-private');f.inputs.businessWizardConsent.checked=true;await f.change();assert.equal(f.action.disabled,true);
  f.inputs.businessWizardStories.checked=true;await f.change();assert.equal(f.action.disabled,false);
  await f.apply();
  const connection=f.requests.find(r=>r.body.action==='connect').body;
  assert.equal(connection.scope,'all-private');assert.equal(connection.storiesConsent,true);assert.equal(connection.antiDeleteConsent,false);
  assert.equal(connection.scopeConsent,true);assert.equal(connection.snapshotToken,'fixture-snapshot');
  assert.equal(f.requests.filter(r=>r.body.action==='connect').length,1);
});
