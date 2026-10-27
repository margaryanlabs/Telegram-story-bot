/* Race protection for Telegram A→B→A open-with-uncertain-send.
 * Uses the shipping async openThread implementation without live APIs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/telegram-chats.js',import.meta.url),'utf8');
const start=source.indexOf('  async function openThread(chat){');
const end=source.indexOf('  // First paint comes from owner-verified MTProto;',start);
assert.ok(start>0&&end>start,'shipping open-thread method exists');
const actual=source.slice(start,end);

function fixture(){
  const arrivals=[],notices=[];
  const state={
    ownerInitData:'signed',thread:null,threadGeneration:0,
    messages:[],syncRunId:0,syncBusy:false,threadLoading:false,
    connectionProof:{verified:true},
    lastSendFailures:new Map([['A',{
      chatId:'A',message:'hi',replyTo:null,nonce:'nonce-original',
    }]]),
    lastRichFailures:new Map(),
    drafts:new Map([['A','hi']]),inboxReturn:null,
  };
  const nodes={
    telegramChatsView:{hidden:true},
    telegramThreadStickerDrawer:{hidden:false},
  };
  const context=vm.createContext({
    state,tg:{initData:'signed'},
    $:id=>nodes[id]||null,resetOwner:()=>false,
    revokeMediaUrls(){},haptic(){},cancelVoiceCapture(){},
    stopThreadSync(){},renderDeliveryStatus(){},closeThreadSearch(){},
    restoreUncertainRichMedia:()=>false,
    renderReplyPreview(){},renderAttachmentChip(){},
    setThread(){},queueVisibleAvatars(){},restoreHotThread:()=>false,
    syncLabel(){},renderMessages(){},renderSendComposer(){},
    threadNotice:text=>notices.push(text),
    loadMessages:()=>{
      state.threadGeneration++;
      return new Promise(resolve=>arrivals.push(resolve));
    },
  });
  new vm.Script(actual).runInContext(context);
  const open=id=>new vm.Script('openThread({id:'+JSON.stringify(id)+
    ",title:'Contact',type:'private'})").runInContext(context);
  return {open,state,arrivals,notices};
}

test('late first A history completion cannot post uncertain-send warning over reopened A',async()=>{
  const f=fixture();
  const first=f.open('A');
  const second=f.open('B');
  const third=f.open('A');
  assert.equal(f.arrivals.length,3);
  f.arrivals[2]();await third;
  f.arrivals[0]();await first;
  f.arrivals[1]();await second;
  assert.equal(f.state.thread.id,'A');
  assert.equal(f.notices.length,1);
  assert.match(f.notices[0],/Отправка не подтверждена/);
});

test('stale A may not produce warning in B even before B loading completes',async()=>{
  const f=fixture();
  const a=f.open('A'),b=f.open('B');
  f.arrivals[0]();await a;
  assert.equal(f.notices.length,0);
  f.arrivals[1]();await b;
  assert.equal(f.state.thread.id,'B');
  assert.equal(f.notices.length,0);
});

test('warning belongs to exact opening history generation, not merely chat ID',()=>{
  assert.match(actual,/const historyLoad=loadMessages\(\{reset:true\}\)/);
  assert.match(actual,/if\(openedGeneration!==state\.threadGeneration\)return/);
});
