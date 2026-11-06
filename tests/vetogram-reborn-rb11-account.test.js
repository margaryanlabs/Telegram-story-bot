/* VETOGRAM REBORN RB11 — account proof and auth-modal regression.
 * Test actual app.js function with an isolated DOM, and assure the design
 * never replaces the existing signed account/OTP/QR/2FA controllers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const html=read('studio.html');
const app=read('app.js');
const css=read('vetogram-reborn-account.css');
const media=read('vetogram-reborn-media.css');
const privacy=read('vetogram-reborn-privacy.css');
const start=app.indexOf('  function renderRebornProfileStatus(){');
const end=app.indexOf('  function renderConnection() {',start);
assert.ok(start>0&&end>start,'the real RB11 status renderer must be present');
const controller=app.slice(start,end);

function readStatus({signed=true,personal=false,mismatch=false,degraded=false,
  business=false,needsBusiness=false,pending=null}={}){
  const ids=['v11MiniAppProof','v11MiniAppState','v11PersonalProof',
    'v11SessionState','v11BusinessProof','v11BusinessState',
    'v11AccountNote','v11ProfileConnect'];
  const nodes=Object.fromEntries(ids.map(k=>[k,{
    dataset:{},textContent:'',disabled:false,
  }]));
  const session=personal||mismatch?{connected:personal,identityMismatch:mismatch}:null;
  const tg={initData:signed?'owner-signed-initdata':''};
  const viewerState={session,degraded,loginPending:pending};
  const state={businessPermissions:{connected:business},
    connection:needsBusiness?'needs_permission':'idle'};
  const context=vm.createContext({
    tg,viewerState,state,$:id=>nodes[id]||null,
    Date,Number,
  });
  vm.runInContext(controller+'renderRebornProfileStatus();',context,{timeout:1000});
  return {nodes,viewerState,state,tg,context};
}

test('profile has three independently described real account proofs',()=>{
  for(const id of ['rb11AccountHeading','v11MiniAppProof','v11MiniAppState',
    'v11PersonalProof','v11SessionState','v11BusinessProof','v11BusinessState',
    'v11AccountNote','v11ProfileConnect']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/Личная Telegram-сессия/);
  assert.match(html,/Telegram Business/);
  assert.match(html,/Вход в Mini App/);
  assert.match(html,/Права Business не включаются автоматически/);
});

test('a signed Mini App is not a connected personal Telegram session',()=>{
  const {nodes}=readStatus();
  assert.equal(nodes.v11MiniAppProof.dataset.state,'ready');
  assert.equal(nodes.v11PersonalProof.dataset.state,'neutral');
  assert.equal(nodes.v11SessionState.textContent,'Личная сессия не подключена');
  assert.equal(nodes.v11BusinessProof.dataset.state,'neutral');
  assert.equal(nodes.v11ProfileConnect.textContent,'Подключить личный Telegram ↗');
});

test('a current confirmed personal session is green but Business remains optional',()=>{
  const {nodes}=readStatus({personal:true});
  assert.equal(nodes.v11PersonalProof.dataset.state,'ready');
  assert.equal(nodes.v11SessionState.textContent,'Личная сессия подключена');
  assert.equal(nodes.v11BusinessProof.dataset.state,'neutral');
  assert.match(nodes.v11AccountNote.textContent,/отдельное согласие/);
  assert.match(nodes.v11ProfileConnect.textContent,/управлять аккаунтом/);
});

test('Business-only access never claims a confirmed personal session',()=>{
  const {nodes}=readStatus({business:true});
  assert.equal(nodes.v11PersonalProof.dataset.state,'neutral');
  assert.equal(nodes.v11BusinessProof.dataset.state,'pending');
  assert.match(nodes.v11BusinessState.textContent,/доставка не проверена/);
});

test('identity mismatch never shows personal access as connected',()=>{
  const {nodes}=readStatus({signed:true,personal:true,mismatch:true});
  assert.equal(nodes.v11PersonalProof.dataset.state,'warn');
  assert.match(nodes.v11SessionState.textContent,/Аккаунт не совпадает/);
});

test('degraded verification is not a connection loss nor fake success',()=>{
  const {nodes}=readStatus({personal:true,degraded:true});
  assert.equal(nodes.v11PersonalProof.dataset.state,'warn');
  assert.match(nodes.v11SessionState.textContent,/временно не подтверждена/);
  assert.match(nodes.v11AccountNote.textContent,/Не запрашивай новый код/);
});

test('pending OTP/2FA is a distinct state and never requests a fresh code',()=>{
  const {nodes}=readStatus({pending:{
    stage:'code',expiresAt:new Date(Date.now()+60000).toISOString(),
  }});
  assert.equal(nodes.v11PersonalProof.dataset.state,'pending');
  assert.match(nodes.v11SessionState.textContent,/ожидает подтверждения/);
  assert.match(nodes.v11AccountNote.textContent,/Повторный запрос кода не нужен/);
  assert.match(nodes.v11ProfileConnect.textContent,/Продолжить подключение/);
});

test('no Telegram Mini App signature means not connected',()=>{
  const {nodes}=readStatus({signed:false,personal:false});
  assert.equal(nodes.v11MiniAppProof.dataset.state,'warn');
  assert.equal(nodes.v11PersonalProof.dataset.state,'warn');
  assert.match(nodes.v11AccountNote.textContent,/Открой Vetogram внутри Telegram/);
});

test('Business needs distinct permission; account flow does not grant it',()=>{
  const {nodes}=readStatus({needsBusiness:true});
  assert.equal(nodes.v11BusinessProof.dataset.state,'warn');
  assert.match(nodes.v11BusinessState.textContent,/отдельное разрешение/);
  assert.doesNotMatch(controller,/viewerApi\(|send_code|verify_password|grant_business/);
});

test('profile action routes through the existing owner-fenced auth flow',()=>{
  assert.match(app,/\$\('v11ProfileConnect'\)\?\.addEventListener\('click'/);
  assert.match(app,/void window\.VetoTelegramOpenAccountConnection\?\.\(\)/);
  assert.match(app,/window\.VetoTelegramOpenAccountConnection = async/);
  assert.match(app,/const signed=String\(tg\.initData\),epoch=viewerOwnerEpoch/);
  assert.match(app,/if\(epoch!==viewerOwnerEpoch\|\|signed!==String\(tg\?\.initData\|\|''\)\)return/);
  assert.match(app,/function profileSheet\(\)/);
  assert.match(app,/function connectionHelpSheet\(\)/);
});

test('profile status updates when real viewer session is refreshed or revoked',()=>{
  assert.match(app,/renderViewers\(\);\s*renderHome\(\);\s*renderRebornProfileStatus\(\)/);
  assert.match(app,/function renderConnection\(\) \{\s*renderRebornProfileStatus\(\)/);
  assert.match(app,/if \(target === 'profile'\) \{\s*renderRebornProfileStatus\(\)/);
  assert.match(app,/if\(tg\?\.initData\)void refreshViewerSync\(\{silent:true\}\)/);
});

test('all original profile destinations and login paths remain in place',()=>{
  for(const id of ['v6Account','v6Appearance']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  for(const route of ['ai','voice','home'])assert.ok(html.includes('data-open-screen="'+route+'"'));
  for(const text of ['viewer-use-phone','viewer-start-qr','viewer-verify-code',
    'viewer-verify-password','viewer-resume-login','viewer-send-email']){
    assert.ok(app.includes(text),text);
  }
});

test('new presentation remains scoped and respects light themes and QR visibility',()=>{
  const links=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(links.at(-1).startsWith('/vetogram-reborn-ui.css?v='));
  assert.ok(links.some(x=>x.includes('vetogram-reborn-foundation.css')));
  assert.ok(media.length>16000&&privacy.length>20000);
  assert.match(css,/data-veto-theme="pearl"/);
  assert.match(css,/data-veto-theme="linen"/);
  assert.match(css,/#viewerQrImage/);
  assert.match(css,/viewerCountryPicker/);
  assert.match(css,/\[hidden\]/);
  assert.match(css,/font-size:16px !important/);
});

test('Account sheet styles do not bypass Privacy destructive confirmation',()=>{
  assert.match(css,/\.ghost-danger/);
  assert.match(css,/button\[data-privacy-confirm-clear\]/);
  assert.match(app,/data-sheet-action="viewer-verify-password"/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/forced-colors:active/);
  assert.doesNotMatch(css,/fetch\(|viewerApi\(|send_code|localStorage|sessionStorage/);
});

test('new CSS stylesheet is balanced and responsive on narrow screens',()=>{
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
  let level=0;
  for(const c of clean){
    if(c==='{')level++;
    if(c==='}')level--;
    assert.ok(level>=0,'unexpected closing CSS brace');
  }
  assert.equal(level,0);
  for(const width of ['345','440','760'])assert.ok(css.includes('max-width:'+width+'px'));
  assert.match(css,/:focus-visible/);
});
