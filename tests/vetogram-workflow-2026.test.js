import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {vetogramWorkflow,vetogramWorkflowResult} from '../public/vetogram-workflow-core.js';

const js=readFileSync(new URL('../public/vetogram-workflows-2026.js',import.meta.url),'utf8')
  .replace(/^import .*?;\s*\n/m,'');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/vetogram-experience-2026.css',import.meta.url),'utf8');

function fixture({navigation=true,missingMode=false}={}){
  const nav=[],modeClicks=[],buttons={};
  const status={textContent:'',dataset:{}};
  for(const id of ['reply','campaign','privacy','voice']){
    const attributes={};
    buttons[id]={dataset:{vg30Flow:id},attributes,
      addEventListener(_event,callback){this.onClick=callback},
      setAttribute(k,v){attributes[k]=v},click(){this.onClick?.()}};
  }
  const modes={reply:{disabled:false,click:()=>modeClicks.push('reply')},
    campaign:{disabled:false,click:()=>modeClicks.push('campaign')}};
  const document={
    getElementById:id=>id==='vg30FlowStatus'?status:null,
    querySelectorAll:selector=>selector==='[data-vg30-flow]'?Object.values(buttons):[],
    querySelector:selector=>{
      const match=/\[data-vtai-mode="([^"]+)"\]/.exec(selector);
      if(match)return missingMode?null:modes[match[1]]||null;
      return null;
    }
  };
  const window={VetoTelegramNavigate:screen=>{nav.push(screen);return navigation}};
  vm.runInNewContext(js,{document,window,vetogramWorkflow,vetogramWorkflowResult});
  return {buttons,status,nav,modeClicks};
}

test('workflow names and destination screens are explicit allowlisted',()=>{
  assert.deepEqual(vetogramWorkflow('reply'),
    {screen:'ai',mode:'reply',label:'AI-ответ'});
  assert.deepEqual(vetogramWorkflow('campaign'),
    {screen:'ai',mode:'campaign',label:'Story-to-Sale'});
  assert.equal(vetogramWorkflow('delete_account'),null);
  assert.equal(vetogramWorkflow('javascript:alert(1)'),null);
  assert.equal(vetogramWorkflow(null),null);
  assert.equal(vetogramWorkflowResult(vetogramWorkflow('reply'),true,false).ok,false);
});
test('one click opens AI Reply mode, never generates or sends automatically',()=>{
  const f=fixture();
  f.buttons.reply.click();
  assert.deepEqual(f.nav,['ai']);
  assert.deepEqual(f.modeClicks,['reply']);
  assert.equal(f.buttons.reply.attributes['aria-pressed'],'true');
  assert.equal(f.buttons.campaign.attributes['aria-pressed'],'false');
  assert.match(f.status.textContent,/под твоим контролем/);
});
test('Story-to-Sale opens the existing AI campaign mode only',()=>{
  const f=fixture();
  f.buttons.campaign.click();
  assert.deepEqual(f.nav,['ai']);
  assert.deepEqual(f.modeClicks,['campaign']);
});
test('Anti-Delete and Voice navigate without AI/network/publish side effects',()=>{
  const f=fixture();
  f.buttons.privacy.click();
  f.buttons.voice.click();
  assert.deepEqual(f.nav,['privacy','voice']);
  assert.deepEqual(f.modeClicks,[]);
});
test('failed navigation or missing AI mode never claims a successful launch',()=>{
  for(const options of [{navigation:false},{missingMode:true}]){
    const f=fixture(options);
    f.buttons.reply.click();
    assert.equal(f.status.dataset.error,'true');
    assert.deepEqual(f.modeClicks,[]);
    assert.equal(f.buttons.reply.attributes['aria-pressed'],undefined);
  }
});
test('all premium actions exist in actual HTML and module stays deferred',()=>{
  for(const id of ['reply','campaign','privacy','voice']){
    assert.match(html,new RegExp('data-vg30-flow="'+id+'"'));
  }
  assert.match(html,/id="vg30FlowStatus"[^>]*role="status"/);
  assert.match(html,/type="module" src="\/vetogram-workflows-2026\.js\?/);
  assert.match(css,/\.vg30-flow-deck/);
  assert.match(css,/@media\(max-width:365px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
