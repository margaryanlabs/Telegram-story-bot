import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CREATIVE_PRESETS,buildCreativeDraft} from '../public/vetogram-creative-presets-core.js';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');

test('VETOGRAM 3.1 loaded as real last-mile paint layer',()=>{
  const html=read('studio.html'),css=read('vetogram-experience-2026.css');
  assert.match(html,/vetogram-experience-2026\.css/);
  assert.match(css,/VETOGRAM 3\.1 \/ clarity-over-chrome/);
  assert.match(css,/\.screen\[data-screen="home"\] \.veto-command-home-grid/);
  assert.match(css,/#telegramMirror \.veto-mirror-chat/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('premium replies and editorial Stories are user-controlled prompts, not auto-send',()=>{
  assert.equal(CREATIVE_PRESETS.reply.length,8);
  assert.equal(CREATIVE_PRESETS.story.length,6);
  const modes={reply:['premium','boundary','followup','persuasive'],story:['editorial','minimal']};
  for(const [mode,ids] of Object.entries(modes))
    for(const id of ids){
      const item=CREATIVE_PRESETS[mode].find(x=>x.id===id);
      assert.ok(item?.instruction&&item?.title);
      const draft=buildCreativeDraft(mode,id,'Мой собственный текст');
      assert.equal(draft.ok,true);
      assert.match(draft.value,/Мой собственный текст/);
      assert.match(draft.value,/не отправлять автоматически/);
    }
  const controller=read('vetogram-creative-presets.js');
  assert.doesNotMatch(controller,/\bfetch\s*\(/);
  assert.doesNotMatch(controller,/\brequest\s*\(/);
  assert.doesNotMatch(controller,/\blocalStorage\b/);
  assert.doesNotMatch(controller,/\.click\s*\(/);
});
