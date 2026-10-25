/* V4.10 Canvas Noir real controls and static layout contract.
 * UI state tests exercise the actual V4 secondary-mode selector. CSS tests
 * are source assertions, NOT screenshot/device validation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
const html=read('studio.html');
const css=read('vetogram-noir.css');
const script=read('vetogram-experience-v4.js');
const modeStart=script.indexOf('    if (modeRail) {');
const modeEnd=script.indexOf('    const advancedIds =',modeStart);
assert.ok(modeStart>0 && modeEnd>modeStart);
const realModeController=script.slice(modeStart,modeEnd);

function modeHarness(){
  class Node{
    constructor(tag='button',mode='',textContent=''){
      this.tag=tag;this.dataset={vtaiMode:mode};
      this.textContent=textContent;this.children=[];
      this.attrs={};this.handlers={};this.open=false;
    }
    getAttribute(key){return this.attrs[key]||null}
    setAttribute(key,value){this.attrs[key]=String(value)}
    addEventListener(name,fn){this.handlers[name]=fn}
    append(...nodes){this.children.push(...nodes)}
    querySelectorAll(){return modes}
  }
  const modes=[
    ['chat','✧ AI-чат'],['translate','⇄ Перевод'],['reply','↗ AI-ответ'],
    ['action','⌁ AI-действия'],['brief','◈ Задачи'],
    ['story','▣ AI-режиссёр'],['campaign','✦ История для продаж'],
    ['negotiator','◇ Переговоры']
  ].map(([mode,label])=>new Node('button',mode,label));
  const modeRail=new Node('div');
  let updated=null;
  const ctx=vm.createContext({
    modeRail,document:{createElement:tag=>new Node(tag)},
    queueMicrotask:fn=>fn(),
    MutationObserver:class{
      constructor(fn){updated=fn}
      observe(){}
    }
  });
  new vm.Script(realModeController).runInContext(ctx);
  const disclosure=modeRail.children.find(x=>x.tag==='details');
  const summary=disclosure?.children.find(x=>x.tag==='summary');
  return {
    disclosure,summary,
    select(mode){
      for(const button of modes)button.setAttribute('aria-pressed',
        String(button.dataset.vtaiMode===mode));
      updated?.();
    },
    reopen(){disclosure.open=true;modeRail.handlers.click?.()},
    modes
  };
}
test('active secondary AI mode is visible in collapsed summary',()=>{
  const h=modeHarness();
  h.select('story');
  assert.equal(h.disclosure.open,true);
  assert.match(h.summary.textContent,/Режим:.*AI-режиссёр/);
  assert.equal(h.disclosure.dataset.selectedMode,'story');
  assert.match(h.summary.getAttribute('aria-label'),/Текущий режим/);
});
test('switching back to primary AI mode closes secondary mode rail',()=>{
  const h=modeHarness();
  h.select('negotiator');
  assert.equal(h.disclosure.open,true);
  h.select('chat');
  assert.equal(h.disclosure.open,false);
  assert.equal(h.summary.textContent,'Другие режимы');
  assert.equal(h.disclosure.dataset.selectedMode,'');
});
test('manual mode browsing is not forced closed when selection did not change',()=>{
  const h=modeHarness();
  h.reopen();
  assert.equal(h.disclosure.open,true);
  assert.equal(h.summary.textContent,'Другие режимы');
});
test('primary actions exist on actual screens and are not decorative buttons',()=>{
  for(const id of ['telegramMirrorSearch','voiceMicButton','voiceRecord',
    'privacyEvidenceRefresh','sePublish','seDownload','vtaiCreate',
    'storyFileInput','storyPortalConfirm']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/id="storyPortalConfirm" type="checkbox" \/>/);
  assert.doesNotMatch(html,/id="storyPortalConfirm" type="checkbox" checked/);
});
test('real Noir styles handle Fold-safe header, mobile AI and scrollable story tabs',()=>{
  assert.match(css,/@media\(max-width:359px\)/);
  assert.match(css,/#vetogram\.vetogram-noir \.topbar \.brand-copy strong/);
  assert.match(css,/#vetogram\.vetogram-noir \[data-screen="ai"\] \.vtai-modes/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/#vetogram\.vetogram-noir #seEngine \.noir-editor-tabs/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/overscroll-behavior-x:contain/);
  assert.match(css,/max-width:100%/);
});
test('AI text and microphone controls use truthful states, not fake activity',()=>{
  assert.match(css,/#vtaiText:focus-visible/);
  assert.match(css,/#voicePresetGrid>button\[aria-pressed="true"\]/);
  const mic=read('voice-studio.js');
  assert.match(mic,/function paintIdleSpectrum\(/);
  assert.doesNotMatch(mic,/Date\.now\(\)\/2500/);
});
test('visual motion respects preference and all four nav items remain present',()=>{
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  for(const id of ['telegram','publish','ai','privacy']){
    assert.match(html,new RegExp('data-nav="'+id+'"'));
  }
  assert.match(html,/data-reborn-nav="four"|class="bottom-nav"/);
});

test('immersive chats are free from normal dashboard max-width and gutters',()=>{
  assert.match(css,/body\.veto-chat-active:not\(\.veto-chat-thread\) \.app-shell/);
  assert.match(css,/body\.veto-chat-thread \.app-shell/);
  assert.match(css,/max-width:none!important/);
  assert.match(css,/height:100dvh!important;overflow:hidden!important/);
});
test('Fold landscape and system contrast modes retain tappable actual controls',()=>{
  assert.match(css,/@media\(max-height:560px\) and \(orientation:landscape\)/);
  assert.match(css,/#seEngine\.v4-studio-focus \.se-canvas-frame/);
  assert.match(css,/@media\(prefers-contrast:more\)/);
  assert.match(css,/@media\(forced-colors:active\)/);
  assert.match(css,/\.bottom-nav \.nav-item\.active/);
});

test('immersive chats outrank shared Noir header and nav display declarations',()=>{
  assert.match(css,/html#vetogram\.vetogram-noir body\.veto-chat-active \.topbar\{\s*display:none!important/);
  assert.match(css,/html#vetogram\.vetogram-noir body\.veto-chat-thread \.bottom-nav,\s*html#vetogram\.vetogram-noir body\.veto-chat-thread #actionDock\{\s*display:none!important/);
  assert.match(css,/#vetogram\.vetogram-noir \.bottom-nav\{[^}]*display:grid!important/);
  assert.match(css,/#vetogram\.vetogram-noir \.topbar\{[^}]*display:flex!important/);
});
