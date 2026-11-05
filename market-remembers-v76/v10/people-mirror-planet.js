/* Market Remembers V18 — PEOPLE MIRROR renderer.
 * Copies PEOPLE's actual triangulated WebGL globe / star-particle pipeline
 * rather than inventing a new planet. Only event colors and date stars differ.
 * The PEOPLE renderer itself is parked and never modified.
 */
(() => {
'use strict';
const app=document.getElementById('app'),stage=document.getElementById('scene');
if(!app||!stage||document.getElementById('mhPlanetSurface'))return;
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const wrapper=document.createElement('div');wrapper.id='mhPlanetSurface';wrapper.className='mh-planet-surface';wrapper.hidden=true;
wrapper.innerHTML='<canvas id="mhPlanetCanvas" aria-hidden="true"></canvas><canvas id="mhPlanetFallback" aria-hidden="true" hidden></canvas>';
const canvas=$=>wrapper.querySelector($),mainCanvas=canvas('#mhPlanetCanvas'),fallback=canvas('#mhPlanetFallback');
const cosmos=document.createElement('div');cosmos.id='mhCrimsonCosmos';cosmos.className='mh-crimson-cosmos';cosmos.hidden=true;cosmos.setAttribute('aria-hidden','true');
cosmos.innerHTML='<div class="mh-crimson-nebula"></div><div class="mh-crimson-aureole"></div><span class="mh-crimson-orbit mh-crimson-orbit-one"></span><span class="mh-crimson-orbit mh-crimson-orbit-two"></span><div class="mh-crimson-vignette"></div>';
stage.append(cosmos,wrapper);
const header=document.createElement('header');header.id='mhEventHeader';header.className='mh-event-header';header.hidden=true;
header.innerHTML='<div class="mh-event-brand"><span class="mh-event-sigil" aria-hidden="true">✦</span><div><strong>THE MARKET <em>REMEMBERS</em></strong><small>FINANCIAL HISTORY · EVENT UNIVERSE</small></div></div><nav class="mh-header-actions" aria-label="Управление миром событий"><button type="button" id="mhResetEventView" aria-label="Вернуть исторические метки на глобус" title="Вернуть исторические метки">⟳ <span>ЦЕНТР</span></button><button type="button" id="mhBackToPeople">↖ <span>PEOPLE UNIVERSE</span></button></nav>';
app.append(header);
$('mhBackToPeople').addEventListener('click',()=>window.MarketHistoryModes?.setMode('people'));
$('mhResetEventView').addEventListener('click',()=>resetView());
const veil=document.createElement('div');veil.id='mhWorldVeil';veil.className='mh-world-veil';veil.setAttribute('aria-hidden','true');app.append(veil);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const source=window.MHPeopleMirrorShaders;
const twoPi=Math.PI*2;
let gl=null,ctx=null,programCore=null,programPoints=null,programLines=null,rendererInitialized=false;
let vertexBuffer=null,indexBuffer=null,particleBuffer=null,lineBuffer=null,indexCount=0,pointCount=0,lineCount=0;
let w=1,h=1,dpr=1,planet={x:0,y:0,r:160},active=false,frame=0,idleTimer=0,last=0,lastMeasure=0,zoom=1;
let yaw=0,pitch=.04,targetYaw=0,targetPitch=.04,focusUntil=0,selected=[-.14,.11,.984],pulseUntil=0,pointer=null;
let uniformCache=new WeakMap(),dragged=false,contextLost=false;
const activePointers=new Map();let pinchDistance=0;
const activeMode=()=>['events','connections'].includes(app.dataset.mhMode);
const events=()=>window.MarketHistoryModes?.events||[];
const point3=p=>[p[0],p[1],Math.sqrt(Math.max(0,1-p[0]*p[0]-p[1]*p[1]))];
const fallbackDust=Array.from({length:360},(_,i)=>{
 const y=1-2*(i+.5)/360,angle=i*2.399963229728653;
 const radius=Math.sqrt(Math.max(0,1-y*y));
 return [radius*Math.cos(angle),y,radius*Math.sin(angle)];
});
function seeded(seed){let v=seed>>>0;return ()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return(v>>>0)/4294967296;};}
function precision(type,text){
 const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('PEOPLE MIRROR GLSL: '+msg);
 }
 return s;
}
function makeProgram(v,f){
 const vs=precision(gl.VERTEX_SHADER,v),fs=precision(gl.FRAGMENT_SHADER,f),p=gl.createProgram();
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('PEOPLE MIRROR link: '+gl.getProgramInfoLog(p));
 return p;
}
function upload(target,data){const buffer=gl.createBuffer();gl.bindBuffer(target,buffer);gl.bufferData(target,data,gl.STATIC_DRAW);return buffer;}
function buildMesh(){
 // EXACT PEOPLE sphere mesh topology: .955 radius, 30x46 ECO / 46x70 full.
 const low=w<820,lat=low?30:46,lon=low?46:70,vertices=[],triangles=[],radius=.955;
 for(let i=0;i<=lat;i++){
  const a=Math.PI*i/lat,sp=Math.sin(a),cp=Math.cos(a);
  for(let j=0;j<=lon;j++){
   const phi=twoPi*j/lon,nx=sp*Math.cos(phi),ny=cp,nz=sp*Math.sin(phi);
   vertices.push(nx*radius,ny*radius,nz*radius,nx,ny,nz);
  }
 }
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
  const a=i*(lon+1)+j,b=a+lon+1;triangles.push(a,b,a+1,b,b+1,a+1);
 }
 if(vertexBuffer)gl.deleteBuffer(vertexBuffer);if(indexBuffer)gl.deleteBuffer(indexBuffer);
 vertexBuffer=upload(gl.ARRAY_BUFFER,new Float32Array(vertices));
 indexBuffer=upload(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triangles));indexCount=triangles.length;
}
function buildParticles(){
 // Reproduce PEOPLE's Fibonacci shell, inner dust, and luminous streamlines.
 const low=w<820,count=low?1200:5900,rnd=seeded(271828+count),points=[],lines=[];
 for(let i=0;i<count;i++){
  const y=1-2*(i+.5)/count,phi=i*2.399963229728653,xz=Math.sqrt(Math.max(0,1-y*y));
  const rad=.975+rnd()*.08;
  points.push(xz*Math.cos(phi)*rad,y*rad,xz*Math.sin(phi)*rad,rnd(),rnd()>.995?1.55:.10+rnd()*.42);
 }
 for(let i=0;i<Math.floor(count*.09);i++){
  const z=rnd()*2-1,theta=rnd()*twoPi,rr=Math.cbrt(rnd())*.81,rad=Math.sqrt(1-z*z)*rr;
  points.push(rad*Math.cos(theta),z*rr,rad*Math.sin(theta),rnd(),.12+rnd()*.6);
 }
 for(let strand=0;strand<2;strand++){
  const phase=strand*Math.PI,frequency=2.25+strand*.17,segments=low?90:185;
  for(let j=0;j<segments;j++){
   const u=(j+.5)/segments,latitude=(u-.5)*1.48;
   const rad=(.10+.51*Math.pow(Math.sin(Math.PI*u),.9))*(1+.075*Math.sin(u*29.+phase));
   const angle=phase+u*twoPi*frequency;
   points.push(rad*Math.cos(angle),latitude,rad*Math.sin(angle),strand===0?.82+.09*rnd():.34+.09*rnd(),1.12+.25*rnd());
  }
 }
 const innerCount=low?155:470;
 for(let j=0;j<innerCount;j++){
  const u=(j+.5)/innerCount,yy=1-2*u,phi=j*2.399963229728653;
  const spread=Math.sqrt(Math.max(0,1-yy*yy)),rr=.48+.28*rnd();
  points.push(spread*Math.cos(phi)*rr,yy*rr,spread*Math.sin(phi)*rr,rnd(),.24+.32*rnd());
 }
 // Different CONTENT ONLY: four sourced dates where PEOPLE shows story stars.
 events().forEach((ev,i)=>points.push(...point3(ev.p),[.12,.36,.68,.91][i]||.5,3.1));
 for(let k=0;k<1;k++){
  const tilt=.62,shift=.12,rad=1.08;
  for(let j=0;j<320;j++)for(const angle of [j/320*twoPi,(j+1)/320*twoPi]){
   const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;
   lines.push(x*Math.cos(shift)-y*Math.sin(tilt)*Math.sin(shift),y*Math.cos(tilt),x*Math.sin(shift)+y*Math.sin(tilt)*Math.cos(shift));
  }
 }
 if(particleBuffer)gl.deleteBuffer(particleBuffer);if(lineBuffer)gl.deleteBuffer(lineBuffer);
 particleBuffer=upload(gl.ARRAY_BUFFER,new Float32Array(points));pointCount=points.length/5;
 lineBuffer=upload(gl.ARRAY_BUFFER,new Float32Array(lines));lineCount=lines.length/3;
}
function failToCanvas(error){
 console.warn('PEOPLE MIRROR WebGL fallback:',String(error));
 gl=null;programCore=programPoints=programLines=null;
 mainCanvas.hidden=true;fallback.hidden=false;ctx=fallback.getContext('2d');
 if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
}
function initGL(){
 try{
  gl=mainCanvas.getContext('webgl',{alpha:true,antialias:false,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl||!source)throw Error('WebGL1 or mirrored shaders unavailable');
  programCore=makeProgram(source.coreVertex,source.coreFragment);
  programPoints=makeProgram(source.pVertex,source.pFragment);
  programLines=makeProgram(source.lVertex,source.lFragment);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);
  gl.clearColor(0,0,0,0);mainCanvas.hidden=false;fallback.hidden=true;ctx=null;
  buildMesh();buildParticles();
 }catch(error){failToCanvas(error);}
}
function size(){
 const rect=stage.getBoundingClientRect(),nw=Math.max(1,Math.round(rect.width)),nh=Math.max(1,Math.round(rect.height)),ndpr=Math.min(window.devicePixelRatio||1,nw<820?1:1.35);
 if(nw===w&&nh===h&&ndpr===dpr)return;
 w=nw;h=nh;dpr=ndpr;
 for(const c of [mainCanvas,fallback]){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
 if(gl){gl.viewport(0,0,mainCanvas.width,mainCanvas.height);buildMesh();buildParticles();}
 if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
}
function place(){
 const mobile=w<820;
 const dock=$('mhHistoryPanel')?.getBoundingClientRect(),rect=stage.getBoundingClientRect();
 const top=mobile?114:105,bottom=mobile&&dock&&!dock.width?125:mobile&&dock?Math.max(90,Math.min(h*.33,h-(dock.top-rect.top)+18)):110;
 const clear=Math.max(150,h-top-bottom);
 // Same PEOPLE screen-scale and camera composition, with clearance for date rail.
 const r=mobile?Math.min(w*.455,clear*.425):Math.min(w,h)*.385;
 planet={x:w*(mobile?.52:.56),y:mobile?top+clear*.49:h*.515,r};
 app.style.setProperty('--mh-core-x',planet.x+'px');
 app.style.setProperty('--mh-core-y',planet.y+'px');
 app.style.setProperty('--mh-core-radius',planet.r+'px');
}
function uniform(p,t){
 let cache=uniformCache.get(p);if(!cache){cache=new Map();uniformCache.set(p,cache);}
 const get=name=>{if(!cache.has(name))cache.set(name,gl.getUniformLocation(p,name));return cache.get(name);};
 const target=point3(window.MarketHistoryModes?.events?.find(e=>e.id===window.MarketHistoryModes?.activeEvent)?.p||[-.14,.11]);
 const pulse=reduce?0:Math.max(0,(pulseUntil-t)/600);
 const uniforms={
  uRes:[w*dpr,h*dpr],uCenter:[planet.x*dpr,(planet.y)*dpr],uRadius:planet.r*dpr,
  uRotY:yaw,uRotX:pitch,uZoom:zoom,uDpr:dpr,uTime:reduce?0:(t/1000)%32768,
  uFocus:target,uMotion:reduce?0:.12,uPulse:pulse,uQuality:w<820?0:1
 };
 for(const [key,val] of Object.entries(uniforms)){
  const loc=get(key);if(loc===null)continue;
  if(Array.isArray(val)){if(val.length===3)gl.uniform3f(loc,...val);else gl.uniform2f(loc,...val);}
  else gl.uniform1f(loc,val);
 }
}
function webGLRender(t){
 gl.viewport(0,0,mainCanvas.width,mainCanvas.height);gl.clearColor(0,0,0,0);gl.clearDepth(1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
 gl.disable(gl.BLEND);gl.useProgram(programCore);
 gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
 const cp=gl.getAttribLocation(programCore,'aPos'),cn=gl.getAttribLocation(programCore,'aNormal');
 gl.enableVertexAttribArray(cp);gl.enableVertexAttribArray(cn);
 gl.vertexAttribPointer(cp,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(cn,3,gl.FLOAT,false,24,12);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);uniform(programCore,t);
 gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
 gl.disableVertexAttribArray(cp);gl.disableVertexAttribArray(cn);
 gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
 gl.useProgram(programLines);gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);
 const linePos=gl.getAttribLocation(programLines,'aPos');
 gl.enableVertexAttribArray(linePos);gl.vertexAttribPointer(linePos,3,gl.FLOAT,false,0,0);
 uniform(programLines,t);gl.drawArrays(gl.LINES,0,lineCount);gl.disableVertexAttribArray(linePos);
 gl.useProgram(programPoints);gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);
 for(const [name,sz,offset] of [['aPos',3,0],['aColor',1,12],['aKind',1,16]]){
  const at=gl.getAttribLocation(programPoints,name);gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at,sz,gl.FLOAT,false,20,offset);
 }
 uniform(programPoints,t);gl.drawArrays(gl.POINTS,0,pointCount);
 gl.depthMask(true);gl.disable(gl.DEPTH_TEST);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
}
function canvasRender(){
 if(!ctx)return;
 const {x,y}=planet,r=planet.r*zoom;
 ctx.clearRect(0,0,w,h);
 // A true projected front hemisphere replaces the old stationary 2D dust disc.
 // The same yaw/pitch used for historical beacons now moves the visual stars.
 const stone=ctx.createRadialGradient(x-r*.26,y-r*.32,r*.02,x,y,r);
 stone.addColorStop(0,'#594761');
 stone.addColorStop(.33,'#312b46');
 stone.addColorStop(.69,'#171c34');
 stone.addColorStop(1,'#060811');
 ctx.save();
 ctx.beginPath();ctx.arc(x,y,r,0,twoPi);ctx.clip();
 ctx.fillStyle=stone;ctx.fillRect(x-r,y-r,r*2,r*2);
 const sheen=ctx.createLinearGradient(x-r*.87,y-r*.72,x+r*.64,y+r*.8);
 sheen.addColorStop(0,'rgba(227,187,235,.18)');
 sheen.addColorStop(.48,'rgba(127,104,180,.025)');
 sheen.addColorStop(1,'rgba(15,19,37,.19)');
 ctx.fillStyle=sheen;ctx.fillRect(x-r,y-r,r*2,r*2);
 for(let i=0;i<fallbackDust.length;i++){
  const p=rotate(fallbackDust[i]);
  if(p[2]<=.04)continue; // Never render stars through the back of the globe.
  const xx=x+p[0]*r*.94,yy=y-p[1]*r*.94;
  if((xx-x)*(xx-x)+(yy-y)*(yy-y)>r*r*.94)continue;
  const size=i%21===0?1.2:.5+p[2]*.43;
  const alpha=(.14+p[2]*.42)*(i%19===0?1.35:1);
  ctx.globalAlpha=clamp(alpha,.1,.86);
  ctx.fillStyle=i%9===0?'#e8c6df':'#cfc2ed';
  ctx.beginPath();ctx.arc(xx,yy,size,0,twoPi);ctx.fill();
 }
 ctx.globalAlpha=1;
 // A light-catching latitude arc follows the physical orientation.
 ctx.strokeStyle='rgba(198,170,222,.16)';ctx.lineWidth=.8;
 ctx.save();ctx.translate(x,y);ctx.rotate(yaw*.18);ctx.scale(1,.34);
 ctx.beginPath();ctx.arc(0,0,r*.79,0,twoPi);ctx.stroke();ctx.restore();
 ctx.restore();
 ctx.beginPath();ctx.arc(x,y,r,0,twoPi);
 ctx.strokeStyle='rgba(209,189,229,.44)';ctx.lineWidth=1.15;ctx.stroke();
 const rim=ctx.createRadialGradient(x-r*.27,y-r*.35,r*.6,x,y,r*1.08);
 rim.addColorStop(0,'rgba(169,124,199,0)');
 rim.addColorStop(.87,'rgba(169,124,199,0)');
 rim.addColorStop(1,'rgba(195,171,223,.18)');
 ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,twoPi);ctx.clip();
 ctx.fillStyle=rim;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();
}
function rotate(pair){
 const [px,py,pz]=point3(pair),cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
 const rx=cy*px+sy*pz,rz=-sy*px+cy*pz,ry=cx*py-sx*rz;
 return [rx,ry,sx*py+cx*rz];
}
function project(pair){
 const p=rotate(pair),per=2.7/(3.1-p[2]*.7),scale=planet.r*per*zoom;
 return{x:planet.x+p[0]*scale,y:planet.y-p[1]*scale,visible:p[2]>-.035,depth:p[2],z:p[2]};
}
function focus(pair){
 const p=point3(pair);targetYaw=-Math.atan2(p[0],p[2]);targetPitch=Math.atan2(p[1],Math.hypot(p[0],p[2]));
 focusUntil=performance.now()+3500;pulseUntil=performance.now()+650;request();
}
function resetView(){
 zoom=1;
 const current=events().find(item=>item.id===window.MarketHistoryModes?.activeEvent);
 if(current)focus(current.p);
 else {targetYaw=0;targetPitch=.04;request();}
}
function tick(t){
 frame=0;if(!active||document.hidden)return;
 const elapsed=last?t-last:16;
 const moving=!!pointer||activePointers.size>0||t<focusUntil||t<pulseUntil||
   Math.abs(yaw-targetYaw)>.003||Math.abs(pitch-targetPitch)>.003;
 // Inactive input: sleep between frames instead of scheduling 60 RAF
 // callbacks that each reject drawing. Interactions wake us immediately.
 const budget=moving?33:82;
 if(last&&!reduce&&elapsed<budget){
   if(moving)scheduleNext(budget-elapsed);
   else scheduleIdle(budget-elapsed);
   return;
 }
 size();place();
 const dt=last?Math.min(82,elapsed):16;last=t;
 // PEOPLE-style celestial object, not an endlessly rotating showcase:
 // all four source events occupy one archive-facing hemisphere, so idle
 // auto-spin would move every date behind the planet and leave it empty.
 // Keep the chosen date in view; orbit only on deliberate pointer movement.
 // A different date calls focus() and smoothly recenters the actual mesh.
 const ease=reduce?1:1-Math.exp(-dt/245);
 yaw+=(targetYaw-yaw)*ease;pitch+=(targetPitch-pitch)*ease;
 try{if(gl)webGLRender(t);else canvasRender();}catch(e){failToCanvas(e);canvasRender();}
 if(t-lastMeasure>66){window.MarketHistoryModes?.measure();lastMeasure=t;}
 if(!reduce){
   if(moving)scheduleNext(33);
   else scheduleIdle(82);
 }
}
function scheduleIdle(ms=82){
 if(!active||document.hidden||idleTimer)return;
 idleTimer=window.setTimeout(()=>{idleTimer=0;request();},Math.max(8,Math.ceil(ms)));
}
function scheduleNext(ms=33){
 if(!active||document.hidden||idleTimer)return;
 idleTimer=window.setTimeout(()=>{idleTimer=0;request();},Math.max(8,Math.ceil(ms)));
}
function request(){
 if(!active||document.hidden)return;
 if(idleTimer){window.clearTimeout(idleTimer);idleTimer=0;}
 if(!frame)frame=requestAnimationFrame(tick);
}
function setActive(next){
 active=!!next;header.hidden=!active;wrapper.hidden=!active;cosmos.hidden=!active;
 if(!active){
  activePointers.clear();pinchDistance=0;pointer=null;
  if(idleTimer)window.clearTimeout(idleTimer);idleTimer=0;
  if(frame)cancelAnimationFrame(frame);frame=0;last=0;
  window.MarketPeopleResume?.();
 }else{
  size();place();last=0;
  // Do not allocate a second WebGL context until EVENT CORE is actually opened.
  if(!rendererInitialized){rendererInitialized=true;initGL();}
  const cur=events().find(e=>e.id===window.MarketHistoryModes?.activeEvent);
  if(cur)focus(cur.p);
  request();
 }
}
wrapper.addEventListener('pointerdown',e=>{
 if(!active||e.button>0)return;
 e.stopPropagation();e.preventDefault();
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size===1)pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
 else {pointer=null;pinchDistance=0;}
 wrapper.setPointerCapture?.(e.pointerId);
});
wrapper.addEventListener('pointermove',e=>{
 if(!activePointers.has(e.pointerId))return;
 e.stopPropagation();e.preventDefault();
 const previous=activePointers.get(e.pointerId);
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size>=2){
  const [a,b]=[...activePointers.values()];
  const distance=Math.hypot(a.x-b.x,a.y-b.y);
  if(pinchDistance>0)zoom=clamp(zoom+(distance-pinchDistance)*.0016,.82,1.30);
  pinchDistance=distance;focusUntil=performance.now()+1000;request();
  return;
 }
 if(!pointer||pointer.id!==e.pointerId){
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
  return;
 }
 const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
 targetYaw+=dx*.006;targetPitch=clamp(targetPitch+dy*.0045,-1.1,1.1);
 focusUntil=performance.now()+3000;request();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])wrapper.addEventListener(type,e=>{
 if(!activePointers.has(e.pointerId))return;
 activePointers.delete(e.pointerId);
 pinchDistance=0;pointer=null;
 if(activePointers.size===1){
  const [id,point]=activePointers.entries().next().value;
  pointer={id,x:point.x,y:point.y};
 }
 request();
});
wrapper.addEventListener('wheel',e=>{
 if(!active)return;e.stopPropagation();e.preventDefault();
 zoom=clamp(zoom+(e.deltaY>0?-.055:.055),.84,1.15);request();
},{passive:false});
mainCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;failToCanvas('context lost');if(active)request();});
mainCanvas.addEventListener('webglcontextrestored',()=>{contextLost=false;initGL();size();if(active)request();});
window.addEventListener('resize',()=>{size();place();if(active)request();},{passive:true});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
   if(frame)cancelAnimationFrame(frame);frame=0;
   if(idleTimer)window.clearTimeout(idleTimer);idleTimer=0;
 }else if(active)request();
});
size();place();
window.MarketEventPlanet=Object.freeze({
 setActive,project,focus,resetView,
 get active(){return active;},
 get renderer(){return gl?'webgl1':ctx?'canvas2d':'unavailable';},
 get copiedPeopleRenderer(){return true;}
});
setActive(activeMode());
})();