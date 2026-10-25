/* Canvas Noir V4.1 regression contracts on REAL UI sources.
   These are local behavior/source tests, not WebView/Telegram end-to-end proof. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const html=read('studio.html');
const experience=read('vetogram-experience-v4.js');
const voice=read('voice-studio.js');
const ai=read('vetogram-reborn-ai.js');
const css=read('vetogram-noir.css');

test('Privacy Vault shows the original, owner-backed evidence before onboarding',()=>{
  const start=experience.indexOf("const vaultScreen = screens('privacy')");
  const end=experience.indexOf('// Story publication:',start);
  assert.ok(start>0 && end>start);
  const block=experience.slice(start,end);
  assert.match(block,/vaultHero\.after\(vaultStats\)/);
  assert.match(block,/vaultStats\.after\(vaultActions\)/);
  assert.match(block,/\.ghost-health-grid/);
  assert.match(block,/\.ghost-quick-grid/);
  assert.doesNotMatch(block,/cloneNode|innerHTML|fetch\(|localStorage/);
  const originalStatIds=['privacyStatThreads','privacyStatDeleted','privacyStatEdited',
    'privacyStatMessages','privacyStatVault'];
  for(const id of originalStatIds)assert.equal(html.split('id="'+id+'"').length-1,1,id);
  for(const option of ['deleted','edited','media','all'])
    assert.match(html,new RegExp('data-ghost-jump="'+option+'"'));
});
test('Voice signal derives from the existing real recorder flags',()=>{
  const start=experience.indexOf('  function voiceCaptureState(node) {');
  const end=experience.indexOf('  const voiceMicState',start);
  assert.ok(start>0 && end>start);
  const fn=vm.runInNewContext('('+experience.slice(start,end).trim()+')');
  const flags=(...active)=>({classList:{contains:x=>active.includes(x)}});
  assert.equal(fn(flags())[0],'off');
  assert.equal(fn(flags('is-requesting-mic'))[0],'requesting');
  assert.equal(fn(flags('live'))[0],'live');
  assert.equal(fn(flags('live','recording'))[0],'recording');
  assert.match(voice,/\$\('voiceMicState'\)\.classList\.toggle\('live',state\.active\)/);
  assert.match(voice,/\$\('voiceMicState'\)\.classList\.toggle\('recording',state\.recording\)/);
  assert.match(experience,/attributeFilter:\['class'\]/);
  assert.match(experience,/voiceMonitorCard\.dataset\.captureState = state/);
  assert.match(html,/class="veto-voice-signal" role="status" aria-live="polite" aria-atomic="true">◌ МИКРОФОН ВЫКЛЮЧЕН/);
  assert.doesNotMatch(html,/class="veto-voice-signal">▂▅▇ · ОБРАБОТКА/);
});
test('AI mode chip reads the actually pressed control, never sends requests',()=>{
  assert.doesNotThrow(()=>new vm.Script(ai));
  assert.match(ai,/\[data-vtai-mode\]\[aria-pressed="true"\]/);
  assert.match(ai,/attributeFilter:\['aria-pressed'\]/);
  assert.match(ai,/modeHint\.textContent/);
  assert.doesNotMatch(ai,/\bfetch\s*\(|vtaiCreate\.click\(|localStorage\.|sessionStorage\./);
});
test('responsive V4.1 visuals retain actual feature actions, focus and reduced motion',()=>{
  assert.match(css,/V4\.1 Canvas Noir/);
  assert.match(css,/\.v4-vault-overview/);
  assert.match(css,/\.v4-vault-actions/);
  assert.match(css,/\[data-capture-state="recording"\]/);
  assert.match(css,/@media\(max-width:380px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/id="voiceMicButton"/);
  assert.match(html,/id="voiceRecord"/);
  assert.match(html,/id="voiceStopRecord"/);
  assert.match(html,/id="vtaiThread"/);
  assert.match(html,/id="vtaiText"/);
  assert.match(html,/id="vtaiConsent"/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
