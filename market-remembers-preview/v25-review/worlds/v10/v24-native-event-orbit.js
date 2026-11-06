/* V24 — EVENT CORE orbit satellite, rendered from EXACT original V18 PEOPLE-mirror shaders.
 * No toy sphere and no second application iframe. Event selection still uses native mode controller.
 * Static low-res preview drawn once, so mobile devices do not sustain a third animation loop.
 */
(()=>{
'use strict';
const hub=document.getElementById('v23Cosmos'),api=window.MarketNativeUniverse;
const shaderSource=window.MHPeopleMirrorShaders;
if(!hub||!api||document.getElementById('v24EventOrbit'))return;
const host=document.createElement('button');
host.id='v24EventOrbit';host.className='v24-event-orbit';host.type='button';
host.setAttribute('aria-label','EVENT CORE — войти в оригинальный мир исторических событий');
host.innerHTML='<span class="v24-planet-frame"><span class="v24-planet-orbit" aria-hidden="true"></span><canvas id="v24EventCanvas" aria-hidden="true"></canvas><span class="v24-planet-mark" aria-hidden="true">◈</span></span><span class="v24-planet-caption"><small>02 / ORIGINAL WORLD</small><strong>EVENT CORE</strong><span>ENTER ↗</span></span>';
hub.append(host);
host.addEventListener('click',()=>api.enter('events'));
const canvas=host.querySelector('canvas');
let gl=null,program=null,indexCount=0,vertexBuffer=null,indexBuffer=null,normalLoc=-1,positionLoc=-1;
const nodes=()=>document.getElementById('v23Cosmos');
function fallback(){host.dataset.renderer='unavailable';canvas.hidden=true;host.title='EVENT CORE — открыть оригинальную планету';}
function shader(type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(msg);}
 return s;
}
function makeGeometry(){
 const lat=28,lon=42,r=.955,vertices=[],indices=[];
 for(let i=0;i<=lat;i++){
  const theta=Math.PI*i/lat,st=Math.sin(theta),ct=Math.cos(theta);
  for(let j=0;j<=lon;j++){
   const phi=Math.PI*2*j/lon,nx=st*Math.cos(phi),ny=ct,nz=st*Math.sin(phi);
   vertices.push(nx*r,ny*r,nz*r,nx,ny,nz);
  }
 }
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
  const a=i*(lon+1)+j,b=a+lon+1;indices.push(a,b,a+1,b,b+1,a+1);
 }
 indexCount=indices.length;
 vertexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
 indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
 gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
}
function render(){
 if(!gl||!program)return;
 const mobile=innerWidth<=820;
 const width=mobile?112:224;
 // Rendering once at DPR 1 avoids GPU churn, yet retains the exact original material.
 canvas.width=width;canvas.height=width;
 gl.viewport(0,0,width,width);gl.clearColor(0,0,0,0);gl.clearDepth(1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
 gl.enableVertexAttribArray(positionLoc);gl.vertexAttribPointer(positionLoc,3,gl.FLOAT,false,24,0);
 gl.enableVertexAttribArray(normalLoc);gl.vertexAttribPointer(normalLoc,3,gl.FLOAT,false,24,12);
 const uniforms={
  uRes:[width,width],uCenter:[width*.5,width*.5],uRadius:width*.43,
  uRotY:-.21,uRotX:.06,uZoom:1,uTime:0,uMotion:0,uPulse:0,
  uFocus:[-.14,.11,.984],uQuality:0
 };
 for(const [name,v] of Object.entries(uniforms)){
  const at=gl.getUniformLocation(program,name);
  if(at===null)continue;
  if(Array.isArray(v)){if(v.length===2)gl.uniform2fv(at,v);else gl.uniform3fv(at,v);}
  else gl.uniform1f(at,v);
 }
 gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
 host.dataset.renderer='native-shader';
}
function setup(){
 if(!shaderSource?.coreVertex||!shaderSource?.coreFragment){fallback();return;}
 try{
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
  if(!gl)throw Error('No available WebGL1');
  const vs=shader(gl.VERTEX_SHADER,shaderSource.coreVertex);
  const fs=shader(gl.FRAGMENT_SHADER,shaderSource.coreFragment);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);
  gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  positionLoc=gl.getAttribLocation(program,'aPos');normalLoc=gl.getAttribLocation(program,'aNormal');
  if(positionLoc<0||normalLoc<0)throw Error('Original shader attribute mismatch');
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  makeGeometry();render();
 }catch(error){
  console.warn('EVENT CORE native orbit preview unavailable; original world remains accessible:',String(error));
  fallback();
 }
}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();gl=null;fallback();});
canvas.addEventListener('webglcontextrestored',setup);
let resizeTimer=0;window.addEventListener('resize',()=>{
 if(resizeTimer)clearTimeout(resizeTimer);
 resizeTimer=setTimeout(()=>{if(gl)render();},180);
},{passive:true});
setup();
window.MarketNativeEventOrbit=Object.freeze({get renderer(){return host.dataset.renderer;},get version(){return '24.0.0';}});
})();