import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){
 const events=[];let timer;
 const elements={sheet:{hidden:false},viewerResendHint:{},viewerResendCode:{}};
 const now=Date.now();
 const state={loginPending:{stage:'code',delivery:'telegram_app',canResend:true,nextDelivery:'sms',resendAvailableAt:new Date(now+30000).toISOString(),expiresAt:new Date(now+600000).toISOString()}};
 const context=vm.createContext({viewerState:state,viewerAuthBusy:false,viewerOwnerEpoch:0,tg:{initData:'owner-a'},$:id=>elements[id]||null,
 clearInterval:()=>events.push('timer-clear'),setInterval:fn=>{timer=fn;return 1},escapeHtml:x=>String(x),openSheet:html=>events.push(html),viewerEmailSheet:()=>events.push('email'),Date});
 const a=app.indexOf("  let viewerCodeDelivery='unknown';"),b=app.indexOf('  function viewerPasswordSheet(',a);
 vm.runInContext(app.slice(a,b),context);
 return {context,state,events,elements,now,tick:()=>timer?.()};
}
test('real auth UI labels actual SMS, app, email and unsupported mobile routes separately',()=>{
 const f=fixture();
 assert.match(f.context.viewerDeliveryInfo('sms').title,/SMS/);
 assert.match(f.context.viewerDeliveryInfo('telegram_app').text,/Это не SMS/);
 assert.match(f.context.viewerDeliveryInfo('email_code').title,/email/);
 assert.match(f.context.viewerDeliveryInfo('firebase_sms').text,/не поддерживается/);
 assert.match(f.context.viewerDeliveryInfo('unknown').text,/отсутствуют/);
});
test('resend requires real next channel, deadline and live challenge; never assumes a timeout',()=>{
 const f=fixture(),p=f.state.loginPending;
 assert.equal(f.context.viewerResendPolicy(p,f.now).ready,false);
 assert.equal(f.context.viewerResendPolicy(p,f.now).seconds,30);
 assert.equal(f.context.viewerResendPolicy(p,f.now+30000).ready,true);
 for(const patch of [{canResend:false},{nextDelivery:null},{resendAvailableAt:null},{stage:'password'},{expiresAt:new Date(0).toISOString()}])
   assert.equal(f.context.viewerResendPolicy({...p,...patch},f.now).available,false);
});
test('restored delivery keeps only safe metadata and drops stale fallback on new email challenge',()=>{
 const f=fixture();
 f.context.rememberViewerChallenge({delivery:'email_code',phoneCodeHash:'secret',session:'secret',code:'12345'});
 assert.equal(f.state.loginPending.delivery,'email_code');
 assert.equal(f.state.loginPending.canResend,false);
 assert.equal(f.state.loginPending.nextDelivery,null);
 for(const key of ['phoneCodeHash','session','code'])assert.equal(key in f.state.loginPending,false);
});
test('rendering auth help never sends or resends a Telegram code',()=>{
 const f=fixture();
 f.context.viewerCodeSheet('telegram_app',true);
 assert.match(f.events.find(x=>typeof x==='string'&&x.includes('<h2>')),/новый код не отправлялся/);
 assert.equal(f.elements.viewerResendCode.disabled,true);
 f.context.viewerNoCodeSheet();
 assert.ok(f.events.some(x=>typeof x==='string'&&x.includes('QR-вход')));
 assert.doesNotMatch(app.slice(app.indexOf('  function viewerDeliveryInfo('),app.indexOf('  function viewerPasswordSheet(')),/viewerApi\(/);
});
test('auth countdown stops on owner switch or modal dismissal without dispatching a request',()=>{
 const f=fixture();f.context.syncViewerResendCountdown();
 f.context.viewerOwnerEpoch=1;f.tick();assert.ok(f.events.includes('timer-clear'));
 assert.equal(f.elements.viewerResendCode.disabled,true);
 const g=fixture();g.context.syncViewerResendCountdown();g.elements.sheet.hidden=true;g.tick();assert.ok(g.events.includes('timer-clear'));
});
