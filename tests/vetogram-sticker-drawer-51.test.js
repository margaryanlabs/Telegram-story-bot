/* Real sticker drawer close/open controller regressions.
 * The earlier closeStickerDrawer() recursively called itself, crashing chat.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const chats=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const from=chats.indexOf('  function closeStickerDrawer(){');
const to=chats.indexOf('  function stickerShownItems(){',from);
assert.ok(from>0&&to>from,'validate the actual production close controller');
const closeController=chats.slice(from,to);

function fixture(){
  const drawer={hidden:false},search={value:'some name'};
  const state={stickerEpoch:12,stickerQuery:'some name'};
  const nodes={
    telegramThreadStickerDrawer:drawer,
    vetoStickersSearch:search,
  };
  const context=vm.createContext({state,$:id=>nodes[id]});
  new vm.Script(closeController).runInContext(context);
  return {
    drawer,search,state,
    close:()=>new vm.Script('closeStickerDrawer()').runInContext(context),
  };
}

test('sticker panel closes without recursion or stack overflow',()=>{
  const f=fixture();
  assert.doesNotThrow(f.close);
  assert.equal(f.drawer.hidden,true);
  assert.equal(f.search.value,'');
  assert.equal(f.state.stickerQuery,'');
  assert.equal(f.state.stickerEpoch,13);
});

test('close is safe when controls were already unmounted',()=>{
  const state={stickerEpoch:7,stickerQuery:'query'};
  vm.runInNewContext(closeController+'\ncloseStickerDrawer();',
    {state,$:()=>null});
  assert.equal(state.stickerEpoch,8);
  assert.equal(state.stickerQuery,'');
});

test('reclosing remains idempotent for visibility and invalidates stale thumbnails',()=>{
  const f=fixture();
  f.close();f.close();
  assert.equal(f.drawer.hidden,true);
  assert.equal(f.state.stickerEpoch,14);
  assert.equal(f.search.value,'');
});

test('account reset and successful rich send both use safe close path',()=>{
  assert.match(chats,/function resetOwner\(\)[\s\S]*?closeStickerDrawer\(\);/);
  assert.match(chats,/await richRequest\(action,request\);[\s\S]*?closeStickerDrawer\(\);/);
  assert.doesNotMatch(closeController,/closeStickerDrawer\(\);/);
});
