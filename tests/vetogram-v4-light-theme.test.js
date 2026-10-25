/* V4.10 explicit light-theme contrast and layer contracts.
 * This is a design-token/source audit, NOT a visual WebView screenshot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../public/vetogram-noir.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/studio.html',import.meta.url),'utf8');
const luminance=hex=>{
  const components=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255);
  const linear=components.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
};
const contrast=(a,b)=>{
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

test('pearl and linen foreground tokens meet 4.5:1 on background and surface',()=>{
  const light=css.match(/html\[data-veto-theme="pearl"\],html\[data-veto-theme="linen"\]\s*\{([^}]+)\}/)?.[1];
  assert.ok(light,'light themes must share explicit tokens');
  const token=name=>{
    const value=light.match(new RegExp('--'+name+':(#[0-9a-fA-F]{3,6})'))?.[1];
    if(!value)return null;
    return value.length===4
      ?'#'+[...value.slice(1)].map(c=>c+c).join('')
      :value;
  };
  const text=token('noir-text'),muted=token('noir-muted'),bg=token('noir-bg'),
    surface=token('noir-surface'),coral=token('noir-coral');
  for(const foreground of [text,muted,coral])
    for(const background of [bg,surface])
      assert.ok(contrast(foreground,background)>=4.5,
        foreground+' on '+background+': '+contrast(foreground,background).toFixed(2)+':1');
});
test('AI mode/composer labels and notes use light-mode text tokens',()=>{
  const section=css.slice(css.indexOf('/* V4.10 pearl / linen light-mode'));
  assert.match(section,/\.vtai-panel h2/);
  assert.match(section,/\.vtai-workspace-item strong/);
  assert.match(section,/\.vtai-input,#vtaiText/);
  assert.match(section,/caret-color:var\(--noir-coral\)/);
  assert.match(section,/data-veto-theme="pearl"/);
  assert.match(section,/data-veto-theme="linen"/);
});
test('Story inspector switches its controls but never recolors the exported canvas',()=>{
  const section=css.slice(css.indexOf('/* V4.10 pearl / linen light-mode'));
  assert.match(section,/#seEngine :is\(\.se-input,\.se-textarea\)/);
  assert.match(section,/#seEngine \.se-panel/);
  assert.match(section,/#seEngine \.se-stage/);
  assert.match(section,/Canvas remains a dark photograph workbench/);
  assert.doesNotMatch(section,/#seCanvas\s*\{[^}]*filter:/);
});
test('default Russian copy has clear actions and no duplicate AI title',()=>{
  assert.match(html,/data-vtai-mode="reply"[^>]*>↗ AI-ответ<\/button>/);
  assert.match(html,/data-vtai-mode="action"[^>]*>⌁ AI-действия<\/button>/);
  assert.match(html,/<h2>Задачи и договорённости<\/h2>/);
  assert.doesNotMatch(html,/Задачи и договорённости · договорённости/);
});
