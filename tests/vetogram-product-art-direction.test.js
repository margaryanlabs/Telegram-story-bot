import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const html=read('studio.html');
const finish=read('vetogram-finish-2026.css');

test('3.3 uses the real Vetogram product identity and leaves account controls wired',()=>{
  assert.match(html,/<div class="vg33-hero-sigil" aria-hidden="true">/);
  assert.match(html,/veto-telegram-mark\.svg/);
  assert.match(html,/<h1>Твоё пространство\.<br><em>Твой ритм\.<\/em><\/h1>/);
  assert.match(html,/id="vetoHomeChatsPrimary" data-open-screen="telegram"/);
  assert.match(html,/id="vetoHomeConnectPrimary"/);
  for(const key of ['vg27MissionAccount','vg27MissionPrivacy','vg27MissionStories','vg27MissionAction'])
    assert.equal((html.match(new RegExp('id="'+key+'"','g'))||[]).length,1);
  assert.ok(html.indexOf('class="veto-command-home"')<
    html.indexOf('id="vg27Mission"'));
  assert.ok(html.indexOf('id="vg27Mission"')<
    html.indexOf('class="vg33-tools-panel"'));
  assert.ok(html.indexOf('class="vg33-tools-panel"')<
    html.indexOf('id="vg26Resume"'));
});

test('all six actual tool buttons remain actionable, no orphan copy or fake statuses',()=>{
  const begin=html.indexOf('class="vg33-tools-panel"');
  const end=html.indexOf('</section>',begin);
  assert.ok(begin>0&&end>begin);
  const tools=html.slice(begin,end);
  assert.equal((tools.match(/data-open-screen="/g)||[]).length,6);
  for(const screen of ['privacy','viewers','story-engine','ai','voice','relay'])
    assert.match(tools,new RegExp('data-open-screen="'+screen+'"'));
  assert.doesNotMatch(tools,/\b(?:Pro active|99\.9% online|Live revenue)\b/i);
});

test('polish stylesheet is last loaded with responsive, motion and focus protections',()=>{
  assert.ok(html.indexOf('/vetogram-finish-2026.css')>
    html.indexOf('/vetogram-experience-2026.css'));
  assert.match(finish,/VETOGRAM 3\.3 \/ Product art direction/);
  assert.match(finish,/@media\(max-width:350px\)/);
  assert.match(finish,/@media\(max-width:600px\)/);
  assert.match(finish,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(finish,/:focus-visible/);
  assert.match(finish,/scroll-snap-type:x proximity/);
  assert.equal((finish.match(/\{/g)||[]).length,(finish.match(/\}/g)||[]).length);
});

function luminance(hex){
  const rgb=hex.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function ratio(foreground,background){
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
test('feature-card text tokens pass AA contrast on declared dark/light backgrounds',()=>{
  assert.ok(ratio('#f4f6ff','#142138')>=4.5);
  assert.ok(ratio('#aebed4','#142138')>=4.5);
  assert.ok(ratio('#24344d','#f6f8fc')>=4.5);
  assert.ok(ratio('#596e88','#f6f8fc')>=4.5);
  for(const color of ['#f4f6ff','#aebed4','#24344d','#596e88'])
    assert.ok(finish.includes(color),'Required accessible token omitted: '+color);
});
