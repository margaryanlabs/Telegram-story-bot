import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../index.html',import.meta.url)),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Application runtime missing');

function extract(name){
 const start=js.indexOf('function '+name+'(');
 assert.ok(start>=0,'Missing '+name);
 const brace=js.indexOf('{',start);let depth=0;
 for(let i=brace;i<js.length;i++){
   if(js[i]==='{')depth++;
   if(js[i]==='}'&&--depth===0)return js.slice(start,i+1);
 }
 throw Error('Unbalanced '+name);
}
const run=(name,context)=>runInNewContext('('+extract(name)+')',context);
function marker(visible=true){
 const classes=new Set();
 return {
   hidden:!visible,
   attrs:{'aria-hidden':String(!visible)},
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
   getAttribute(k){return this.attrs[k]}
 };
}
function fixture(){
 const markers=[marker(true),marker(false),marker(true),marker(true)];
 const stories=[
   {p:{x:210,y:320,z:.66},category:'Risk'},
   {p:{x:210,y:320,z:.91},category:'Risk'},
   {p:{x:224,y:300,z:-.6},category:'Risk'},
   {p:{x:350,y:730,z:.83},category:'Risk'}
 ];
 const c={
   w:390,h:844,
   stage:{getBoundingClientRect:()=>({left:40,top:65})},
   stories,markerEls:markers,project:p=>p,lensMatches:()=>true,
   pointers:new Map(),v97ArmedStar:-1,pinchDistance:0,
   dragging:false,moved:0,inertiaY:0,inertiaX:0,targetY:0,targetX:0,
   targetZoom:1,reduceMotion:false,interactionPulse:0,interactionEnergy:0,
   interactionPoint:[0,0],diveIndex:-1,
   clamp:(v,l,u)=>Math.max(l,Math.min(u,v)),
   setSpin(value){this.spinning=value},
   focus(index,open){this.opened={index,open}}
 };
 for(const [key,value] of Object.entries(c))if(typeof value==='function')c[key]=value.bind(c);
 for(const name of ['v97StagePoint','v97PickStarAt','v97ClearArmedStar',
                     'pointerDown','pointerMove','pointerUp']){
   c[name]=run(name,c);
 }
 const event=(x,y,id=1,type='touch')=>({
   clientX:x+40,clientY:y+65,pointerId:id,pointerType:type,button:0,
   currentTarget:{setPointerCapture(){}}
 });
 return {c,markers,event};
}

test('screen touch light tracks coordinates relative to the scene',()=>{
 const {c}=fixture();
 assert.deepEqual({...c.v97StagePoint(255,385)},{x:215,y:320});
 c.pointerDown({clientX:255,clientY:385,pointerId:1,pointerType:'touch',button:0,
   currentTarget:{setPointerCapture(){}}});
 assert.equal(c.interactionPoint[0],215);
 assert.equal(c.interactionPoint[1],320);
});
test('nearby visible star can be picked at a forgiving touch radius',()=>{
 const {c}=fixture();
 assert.equal(c.v97PickStarAt(240,320,'touch'),0);
 assert.equal(c.v97PickStarAt(240,320,'mouse'),-1);
});
test('unrendered, backside and offscreen markers cannot be picked',()=>{
 const {c,markers}=fixture();
 markers[0].attrs['aria-hidden']='true';
 assert.equal(c.v97PickStarAt(210,320,'touch'),-1);
 assert.equal(c.v97PickStarAt(224,300,'touch'),-1);
 markers[3].attrs['aria-hidden']='false';
 c.stories[3].p.x=398;
 assert.equal(c.v97PickStarAt(398,730,'touch'),-1);
});
test('active lens must match the chosen record even if marker state is stale',()=>{
 const {c}=fixture();
 c.lensMatches=()=>false;
 assert.equal(c.v97PickStarAt(210,320,'touch'),-1);
});
test('direct tap arms only a visible star, opens on release, then clears glimmer',()=>{
 const {c,markers,event}=fixture();
 c.pointerDown(event(213,320));
 assert.equal(c.v97ArmedStar,0);
 assert.equal(markers[0].classList.contains('is-armed'),true);
 c.pointerUp(event(214,322));
 assert.deepEqual(c.opened,{index:0,open:true});
 assert.equal(c.v97ArmedStar,-1);
 assert.equal(markers[0].classList.contains('is-armed'),false);
});
test('one-finger drag rotates but does not accidentally open a story',()=>{
 const {c,markers,event}=fixture();
 c.pointerDown(event(210,320));
 c.pointerMove(event(250,330));
 c.pointerUp(event(250,330));
 assert.equal(c.opened,undefined);
 assert.equal(markers[0].classList.contains('is-armed'),false);
});
test('multi-touch pinch never opens the armed first star',()=>{
 const {c,event}=fixture();
 c.pointerDown(event(210,320,1));
 c.pointerDown(event(240,320,2));
 c.pointerMove(event(258,320,2));
 c.pointerUp(event(210,320,1));
 c.pointerUp(event(258,320,2));
 assert.equal(c.opened,undefined);
 assert.equal(c.v97ArmedStar,-1);
});
test('pointercancel stops residual inertial drift and never opens a story',()=>{
 const {c,event}=fixture();
 c.pointerDown(event(210,320));
 c.pointerMove(event(225,322));
 c.pointerUp(event(225,322),true);
 assert.equal(c.opened,undefined);
 assert.equal(c.inertiaX,0);
 assert.equal(c.inertiaY,0);
});
test('contact glimmer uses existing DOM marker and honors reduced motion',()=>{
 assert.match(html,/\.obsidian \.star-marker\.is-armed/);
 assert.match(html,/@keyframes v97StarContact/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{\s*\.obsidian \.star-marker\.is-armed::before/);
 assert.match(extract('beginDive'),/v97ClearArmedStar\(\)/);
 assert.match(extract('reset'),/v97ClearArmedStar\(\)/);
});
