/* Market Remembers V14 — a genuinely second procedural planet / event world.
   People renderer is parked while active. Both worlds preserve original data. */
(() => {
'use strict';
const app=document.getElementById('app'),stage=document.getElementById('scene');
if(!app||!stage||document.getElementById('mhPlanetSurface'))return;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const wrapper=document.createElement('div');
wrapper.id='mhPlanetSurface';wrapper.className='mh-planet-surface';wrapper.hidden=true;
wrapper.innerHTML='<canvas id="mhPlanetCanvas" aria-hidden="true"></canvas><canvas id="mhPlanetFallback" aria-hidden="true" hidden></canvas>';
const canvas=wrapper.querySelector('#mhPlanetCanvas'),fallback=wrapper.querySelector('#mhPlanetFallback');
const cosmos=document.createElement('div');
cosmos.id='mhCrimsonCosmos';cosmos.className='mh-crimson-cosmos';cosmos.hidden=true;
cosmos.setAttribute('aria-hidden','true');
cosmos.innerHTML='<div class="mh-crimson-nebula"></div><div class="mh-crimson-aureole"></div><span class="mh-crimson-orbit mh-crimson-orbit-one"></span><span class="mh-crimson-orbit mh-crimson-orbit-two"></span><div class="mh-crimson-vignette"></div>';
stage.append(cosmos,wrapper);
const header=document.createElement('header');header.id='mhEventHeader';
header.className='mh-event-header';header.hidden=true;
header.innerHTML='<div class="mh-event-brand"><span class="mh-event-sigil" aria-hidden="true">◈</span><div><strong>THE MARKET <em>REMEMBERS</em></strong><small>EVENT CORE · FINANCIAL HISTORY</small></div></div><button type="button" id="mhBackToPeople">↖ <span>PEOPLE UNIVERSE</span></button>';
app.append(header);
$('mhBackToPeople').addEventListener('click',()=>window.MarketHistoryModes?.setMode('people'));
const veil=document.createElement('div');veil.id='mhWorldVeil';veil.className='mh-world-veil';veil.setAttribute('aria-hidden','true');app.append(veil);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shouldBeActive=()=>['events','connections'].includes(app.dataset.mhMode);
let gl=null,program=null,buffer=null,attributes=null,uniforms=null,ctx=null,active=false,frame=0,last=0,lastMeasure=0;
let w=0,h=0,dpr=1,planet={x:0,y:0,r:130};
let yaw=.035,pitch=.06,targetYaw=.035,targetPitch=.06,zoom=1,focusUntil=0;
let pointer=null,transitionTimer=0;

function compile(type,source){
 const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error('Crimson shader: '+message);}
 return shader;
}
function initGL(){
 try{
   gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,premultipliedAlpha:false,powerPreference:'low-power'});
   if(!gl)throw Error('WebGL unavailable');
   const sources=window.MHCrimsonShaders;
   if(!sources)throw Error('Missing crimson shaders');
   const vs=compile(gl.VERTEX_SHADER,sources.vertex),fs=compile(gl.FRAGMENT_SHADER,sources.fragment);
   program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Crimson link: '+gl.getProgramInfoLog(program));
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   attributes=gl.getAttribLocation(program,'aPosition');
   uniforms=Object.fromEntries(['uResolution','uCenter','uRadius','uYaw','uPitch','uTime','uEmphasis'].map(k=>[k,gl.getUniformLocation(program,k)]));
   gl.clearColor(0,0,0,0);
   canvas.hidden=false;fallback.hidden=true;ctx=null;
 }catch(error){
   console.warn('EVENT CORE using Canvas2D fallback:',String(error));
   gl=null;program=null;canvas.hidden=true;fallback.hidden=false;
   ctx=fallback.getContext('2d');
 }
}
function size(){
 const rect=stage.getBoundingClientRect();
 const nw=Math.max(1,Math.round(rect.width)),nh=Math.max(1,Math.round(rect.height));
 const ndpr=Math.min(window.devicePixelRatio||1,nw<820?1:1.35);
 if(nw===w&&nh===h&&ndpr===dpr)return;
 w=nw;h=nh;dpr=ndpr;
 for(const c of [canvas,fallback]){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
 if(gl)gl.viewport(0,0,canvas.width,canvas.height);
 if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
}
function place(){
 const mobile=w<820;
 const x=w*(mobile?.515:.575),y=h*(mobile?.425:.525);
 const r=Math.min(w,h)*(mobile?.318:.375)*zoom;
 planet={x,y,r};
 app.style.setProperty('--mh-core-x',x+'px');
 app.style.setProperty('--mh-core-y',y+'px');
 app.style.setProperty('--mh-core-radius',r+'px');
}
function renderGL(t){
 gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.enableVertexAttribArray(attributes);gl.vertexAttribPointer(attributes,2,gl.FLOAT,false,0,0);
 gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);
 gl.uniform2f(uniforms.uCenter,planet.x*dpr,(h-planet.y)*dpr);
 gl.uniform1f(uniforms.uRadius,planet.r*dpr);
 gl.uniform1f(uniforms.uYaw,yaw);gl.uniform1f(uniforms.uPitch,pitch);
 gl.uniform1f(uniforms.uTime,reduced?0:t);
 gl.uniform1f(uniforms.uEmphasis,app.dataset.mhMode==='connections'?1:0);
 gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
}
function render2D(){
 if(!ctx)return;
 const {x,y,r}=planet;ctx.clearRect(0,0,w,h);
 const glow=ctx.createRadialGradient(x,y,r*.72,x,y,r*1.25);
 glow.addColorStop(0,'rgba(70,8,22,0)');glow.addColorStop(.7,'rgba(190,34,62,.28)');glow.addColorStop(1,'rgba(190,34,62,0)');
 ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r*1.25,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
 const base=ctx.createRadialGradient(x-r*.39,y-r*.37,r*.13,x,y,r*1.13);
 base.addColorStop(0,'#5c2532');base.addColorStop(.43,'#24101a');base.addColorStop(1,'#05060b');
 ctx.fillStyle=base;ctx.fillRect(x-r,y-r,r*2,r*2);
 for(let i=0;i<28;i++){
   const theta=i*2.399963+yaw*.53,rad=r*Math.sqrt((i+.5)/29);
   const sx=x+Math.cos(theta)*rad,sy=y+Math.sin(theta)*rad,len=r*(.09+(i%4)*.014);
   ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(sx+len*.1,sy-len*.52,sx-len*.3,sy-len*.8,sx-len*.55,sy-len);
   ctx.strokeStyle=i%4===0?'rgba(252,89,107,.51)':'rgba(186,41,69,.18)';
   ctx.lineWidth=i%4===0?1.7:.8;ctx.stroke();
 }
 const shade=ctx.createLinearGradient(x-r,y-r,x+r,y+r);
 shade.addColorStop(0,'rgba(245,115,138,.14)');shade.addColorStop(.55,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.78)');
 ctx.fillStyle=shade;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
 ctx.strokeStyle='rgba(232,64,95,.44)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
}
function project(pair){
 const {x,y,r}=planet,px=pair[0],py=pair[1],pz=Math.sqrt(Math.max(0,1-px*px-py*py));
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
 const rx=cy*px+sy*pz,rz=-sy*px+cy*pz;
 const ry=cx*py-sx*rz,front=sx*py+cx*rz;
 return {x:x+rx*r,y:y-ry*r,visible:front>-.02};
}
function focus(pair){
 const px=pair[0],py=pair[1],pz=Math.sqrt(Math.max(.01,1-px*px-py*py));
 targetYaw=-Math.atan2(px,pz);
 const rz=-Math.sin(targetYaw)*px+Math.cos(targetYaw)*pz;
 targetPitch=Math.atan2(py,rz);
 focusUntil=performance.now()+2800;request();
}
function tick(t){
 frame=0;
 if(!active||document.hidden)return;
 size();place();
 const minInterval=w<820?33:22;
 if(last&&!reduced&&t-last<minInterval){request();return;}
 const dt=last?Math.min(60,t-last):16;last=t;
 if(!reduced&&t>focusUntil&&!pointer)targetYaw+=dt*.000058;
 const a=reduced?1:1-Math.exp(-dt/230);
 yaw+=(targetYaw-yaw)*a;pitch+=(targetPitch-pitch)*a;
 try{if(gl)renderGL(t);else render2D();}
 catch(error){console.warn('EVENT CORE render fallback:',String(error));gl=null;program=null;canvas.hidden=true;fallback.hidden=false;ctx=fallback.getContext('2d');ctx?.setTransform(dpr,0,0,dpr,0,0);render2D();}
 if(t-lastMeasure>65){window.MarketHistoryModes?.measure();lastMeasure=t;}
 if(!reduced)request();
}
function request(){if(active&&!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
function setActive(value){
 const was=active;active=!!value;
 header.hidden=!active;wrapper.hidden=!active;cosmos.hidden=!active;
 if(!active){
   if(frame){cancelAnimationFrame(frame);frame=0;}
   last=0;
   window.MarketPeopleResume?.();
 }else{
   size();place();last=0;request();
 }
 if(was!==active){
   app.classList.remove('mh-world-shift');void app.offsetWidth;app.classList.add('mh-world-shift');
   clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>app.classList.remove('mh-world-shift'),650);
 }
}
wrapper.addEventListener('pointerdown',event=>{
 if(!active||event.button>0)return;
 event.stopPropagation();event.preventDefault();
 pointer={id:event.pointerId,x:event.clientX,y:event.clientY};wrapper.setPointerCapture?.(event.pointerId);
});
wrapper.addEventListener('pointermove',event=>{
 if(!active||!pointer||pointer.id!==event.pointerId)return;
 event.stopPropagation();event.preventDefault();
 const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
 pointer.x=event.clientX;pointer.y=event.clientY;
 targetYaw+=dx*.006;targetPitch=clamp(targetPitch+dy*.0045,-.85,.85);
 focusUntil=performance.now()+3000;
 if(reduced)request();
});
for(const type of ['pointerup','pointercancel'])wrapper.addEventListener(type,event=>{
 if(!pointer||pointer.id!==event.pointerId)return;
 event.stopPropagation();pointer=null;
});
wrapper.addEventListener('wheel',event=>{
 if(!active)return;
 event.stopPropagation();event.preventDefault();
 zoom=clamp(zoom+(event.deltaY>0?-.06:.06),.86,1.15);
 size();place();request();
},{passive:false});
canvas.addEventListener('webglcontextlost',event=>{
 event.preventDefault();
 gl=null;program=null;canvas.hidden=true;fallback.hidden=false;
 ctx=fallback.getContext('2d');ctx?.setTransform(dpr,0,0,dpr,0,0);if(active)request();
});
canvas.addEventListener('webglcontextrestored',()=>{initGL();if(active)request();});
window.addEventListener('resize',()=>{size();place();if(active)request();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else if(active)request();});
initGL();size();place();
window.MarketEventPlanet=Object.freeze({setActive,project,focus,get active(){return active;},get renderer(){return gl?'webgl1':ctx?'canvas2d':'unavailable';}});
setActive(shouldBeActive());
})();