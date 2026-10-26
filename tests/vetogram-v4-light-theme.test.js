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

const tokens=theme=>{
  const section=css.match(new RegExp('html\\[data-veto-theme="'+theme+
    '"\\]\\s*\\{([^}]+)\\}'))?.[1];
  assert.ok(section,'missing independent '+theme+' palette');
  const token=name=>{
    const value=section.match(new RegExp('--'+name+':(#[0-9a-fA-F]{3,6})'))?.[1];
    assert.ok(value,theme+':'+name);
    return value.length===4
      ?'#'+[...value.slice(1)].map(c=>c+c).join('')
      :value;
  };
  return Object.fromEntries(['noir-bg','noir-surface','noir-text','noir-muted',
    'noir-coral'].map(k=>[k,token(k)]));
};

test('pearl, linen and slate foreground tokens meet WCAG 4.5:1',()=>{
  for(const theme of ['pearl','linen','slate']){
    const palette=tokens(theme);
    for(const foreground of ['noir-text','noir-muted','noir-coral'])
      for(const background of ['noir-bg','noir-surface']){
        const a=palette[foreground],b=palette[background];
        assert.ok(contrast(a,b)>=4.5,
          theme+' '+foreground+' on '+background+': '+contrast(a,b).toFixed(2)+':1');
      }
  }
});
test('white, linen and slate are distinct selectable presentation themes',()=>{
  const light=tokens('pearl'),warm=tokens('linen'),slate=tokens('slate');
  assert.notEqual(light['noir-bg'],warm['noir-bg']);
  assert.notEqual(light['noir-surface'],warm['noir-surface']);
  assert.notEqual(slate['noir-bg'],warm['noir-bg']);
  assert.notEqual(slate['noir-bg'],light['noir-bg']);
});

test('AI mode/composer labels and notes use light-mode text tokens',()=>{
  const section=css;
  assert.match(section,/\.vtai-panel h2/);
  assert.match(section,/\.vtai-workspace-item strong/);
  assert.match(section,/\.vtai-input,#vtaiText/);
  assert.match(section,/caret-color:var\(--noir-coral\)/);
  assert.match(section,/data-veto-theme="pearl"/);
  assert.match(section,/data-veto-theme="linen"/);
});
test('Story inspector switches its controls but never recolors the exported canvas',()=>{
  const section=css;
  assert.match(section,/#seEngine :is\(\.se-input,\.se-textarea\)/);
  assert.match(section,/#seEngine \.se-panel/);
  assert.match(section,/#seEngine \.se-stage/);
  assert.match(section,/#seEngine \.se-stage\s*\{[^}]*color:#dde7f6!important/);
  assert.doesNotMatch(section,/#seCanvas\s*\{[^}]*filter:/);
});
test('default Russian copy has clear actions and no duplicate AI title',()=>{
  assert.match(html,/data-vtai-mode="reply"[^>]*>↗ AI-ответ<\/button>/);
  assert.match(html,/data-vtai-mode="action"[^>]*>⌁ AI-действия<\/button>/);
  assert.match(html,/<h2 data-ui-text="tasksAgreements">Задачи и договорённости<\/h2>/);
  assert.doesNotMatch(html,/Задачи и договорённости · договорённости/);
});
