import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const helper=file('v10/v20-beacon-layout.js');
const controller=file('v10/market-history-modes.js');
const css=file('v10/v20-beacon-layout.css');
const html=file('index.html');

function layout(){
  const window={};
  new Script(helper).runInNewContext({window});
  return window.MarketBeaconLayoutV20.arrange;
}
const input=(id,x,y,active=false,visible=true)=>({id,x,y,active,visible});

test('V20.6 picks a fitting side near viewport borders, never alters a star location',()=>{
  const arrange=layout();
  const data=[input('2008',466,210,true)];
  const snapshot=JSON.stringify(data);
  const r=arrange(data,{width:500,height:400});
  assert.equal(r['2008'].hidden,false);
  assert.equal(r['2008'].side,'left');
  assert.equal(r['2008'].placement,'center');
  assert.equal(JSON.stringify(data),snapshot,'Projection coordinates must be immutable');
});

test('V20.6 prioritizes selected beacon, avoids other labels and live UI rectangles',()=>{
  const arrange=layout();
  const data=[input('1907',260,205),input('2008',260,205,true),input('1987',310,205)];
  const options={width:650,height:540,obstacles:[
    {left:0,top:80,right:155,bottom:360},
    {left:470,top:235,right:650,bottom:540}
  ]};
  const a=arrange(data,options);
  const b=arrange(data.slice().reverse(),options);
  assert.deepEqual({...a},{...b},'Input DOM order must not change label priority');
  assert.equal(a['2008'].hidden,false);
  for(const id of Object.keys(a)){
    assert.ok(['left','right'].includes(a[id].side));
    assert.ok(['center','above','below'].includes(a[id].placement));
    assert.equal(typeof a[id].hidden,'boolean');
  }
});

test('V20.6 keeps the star accessible when there is no safe room for its label',()=>{
  const arrange=layout();
  const data=[input('2008',200,170,true),input('1907',500,200,false,false)];
  const r=arrange(data,{width:600,height:420,
    obstacles:[{left:0,top:0,right:600,bottom:420}]});
  assert.equal(r['2008'].hidden,true,'Hide only label when panel covers it');
  assert.equal(r['1907'].hidden,true,'Back-facing star does not acquire a label');
  assert.doesNotMatch(helper,/Math\.random\(|localStorage\.|fetch\(/);
  assert.match(controller,/button\.setAttribute\('aria-label',event\.year/);
  assert.match(controller,/button\.setAttribute\('aria-hidden',String\(!visible\)\)/);
});

test('V20.6 can move a label above or below instead of hiding a visible beacon',()=>{
  const arrange=layout();
  const r=arrange([input('2008',260,255,true)],{
    width:600,height:460,
    obstacles:[{left:0,top:220,right:600,bottom:300}]
  });
  assert.equal(r['2008'].hidden,false);
  assert.ok(['above','below'].includes(r['2008'].placement));
});

test('V20.6 handles invalid projection geometry without throwing, no phantom coordinates',()=>{
  const arrange=layout();
  assert.equal(Object.keys(arrange([input('2008',100,100,true)],{width:NaN,height:400})).length,0);
  const r=arrange([input('2008',NaN,100,true),input('1987',250,250,false)],{
    width:540,height:460,obstacles:[null,{left:NaN,top:0,right:80,bottom:80}]
  });
  assert.equal(r['2008'].hidden,true);
  assert.equal(r['1987'].hidden,false);
});

test('V20.6 connected styles and layout preserve PEOPLE, Replay and Compare',()=>{
  new Script(helper);new Script(controller);
  assert.ok(html.indexOf('v10/v20-beacon-layout.js')<html.indexOf('v10/market-history-modes.js'));
  assert.ok(html.indexOf('v10/v20-beacon-layout.css')>html.indexOf('v10/v20-three-state-sheet.css'));
  assert.match(controller,/window\.MarketBeaconLayoutV20\?\.arrange/);
  assert.match(controller,/button\.dataset\.mhLabelPlacement = label\?\.placement/);
  assert.match(controller,/button\.classList\.toggle\('is-label-hidden',!!label\?\.hidden\)/);
  assert.match(css,/\.mh-beacon\.is-label-hidden \.mh-beacon-year/);
  assert.match(css,/data-mh-label-placement="above"/);
  assert.match(css,/data-mh-label-placement="below"/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/\.selected-card|\.signal-dock|#markers|#drawer|\.mh-planet-surface/);
  assert.match(controller,/MarketShockReplay2008\?\.mount/);
  assert.match(controller,/comparisonMarkup\(event\)/);
  let braces=0;for(const c of css){if(c==='{')braces++;if(c==='}')braces--;assert.ok(braces>=0);}
  assert.equal(braces,0);
});
