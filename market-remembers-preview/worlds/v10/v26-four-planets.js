/* MARKET REMEMBERS / V26 CELESTIAL ENGINE
 * Four original, visually distinct procedural worlds rendered in ONE WebGL
 * context over the native V20 PEOPLE and V24 EVENT CORE planets.
 * No remote APIs, no fake user data, Canvas fallback for no-WebGL phones.
 */
(()=>{
'use strict';
const hub=document.getElementById('v23Cosmos');
if(!hub||document.getElementById('v26SatelliteField'))return;
const ids=['decisions','agora','mirror','guilds'];
const palettes=[
 {dark:'#28100e',medium:'#965e31',light:'#edc385',glow:'#ea4a3e'},
 {dark:'#190f36',medium:'#674394',light:'#b69bea',glow:'#b77fff'},
 {dark:'#122535',medium:'#829ba9',light:'#e2effb',glow:'#93cadb'},
 {dark:'#08241d',medium:'#227d66',light:'#9bd8b2',glow:'#53cf9b'}
];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let field=document.createElement('canvas');
field.id='v26SatelliteField';field.className='v26-satellite-field';
field.setAttribute('aria-hidden','true');hub.prepend(field);
const labels=ids.map(id=>hub.querySelector('[data-v23-world="'+id+'"]'));
for(let i=0;i<labels.length;i++)if(labels[i]){
 labels[i].setAttribute('aria-label',ids[i].toUpperCase()+' — войти в интерактивную лабораторию');
 labels[i].setAttribute('data-celestial',String(i));
}
const color=h=>{const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
const vs='attribute vec2 a_corner;varying vec2 v_uv;uniform vec2 u_center,u_scale;void main(){v_uv=a_corner;gl_Position=vec4(u_center+a_corner*u_scale,0.,1.);}';
const fs=[
'precision highp float; varying vec2 v_uv;',
'uniform vec3 u_dark,u_mid,u_light,u_glow;uniform float u_type,u_time,u_pixel;',
'float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}',
'float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
'return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),',
'mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}',
'float fbm(vec3 p){float f=0.,a=.5;for(int j=0;j<4;j++){f+=noise3(p)*a;p=p*2.07+vec3(2.0,1.1,3.2);a*=.5;}return f;}',
'void main(){float radius=length(v_uv);if(radius>1.18)discard;',
'float sphere=1.-smoothstep(.988,1.012,radius);',
'float atmos=(1.-smoothstep(1.0,1.18,radius))*smoothstep(.82,1.02,radius);',
'if(sphere<.002){gl_FragColor=vec4(u_glow*.34,atmos*.32);return;}',
'float z=sqrt(max(.0001,1.-min(radius,1.)*min(radius,1.)));vec3 n=normalize(vec3(v_uv,z));',
'float turn=u_time*.21+u_type*.78;vec3 p=vec3(n.x*cos(turn)+n.z*sin(turn),n.y,n.z*cos(turn)-n.x*sin(turn));',
'float n1=fbm(p*5.4),n2=fbm(p*15.),f=n1*.78+n2*.22;',
'vec3 material=mix(u_dark,u_mid,smoothstep(.23,.67,f));',
'if(u_type<.5){',
' float crust=smoothstep(.39,.58,f);material=mix(u_dark,u_mid,crust*.95);',
' float fault=pow(1.-abs(sin((p.x*13.+p.y*19.+p.z*5.)+n1*13.)),16.);',
' material+=u_glow*fault*(.44+crust*.45);',
' float plate=pow(max(0.,sin((p.y+p.x)*6.+f*19.)),8.);material=mix(material,u_light,plate*.24);',
'}else if(u_type<1.5){',
' float band=sin(p.y*31.+n1*8.+p.x*2.);',
' float haze=sin(p.y*14.-n2*11.);',
' material=mix(u_dark,u_mid,smoothstep(-.65,.85,band)*.76+.15);',
' material=mix(material,u_light,smoothstep(.5,.95,haze)*.32);',
' float storm=1.-smoothstep(.09,.38,length(vec2(p.x+.3,p.y-.1)));',
' material+=u_glow*storm*noise3(p*27.)*.23;',
'}else if(u_type<2.5){',
' float ice=smoothstep(.38,.70,f+.11*p.y);',
' material=mix(u_dark,u_mid,ice);material=mix(material,u_light,pow(ice,3.)*.66);',
' float crater=pow(1.-abs(sin(p.x*24.+f*6.)),19.)*pow(1.-abs(sin(p.y*22.+f*3.)),11.);',
' material=mix(material,u_dark,crater*.26);',
'}else{',
' float land=smoothstep(.42,.62,n1);material=mix(u_dark,u_mid,land);',
' float moss=pow(smoothstep(.36,.78,n2),2.);material=mix(material,u_light,moss*.34);',
' vec3 cells=floor(p*33.);float nodes=pow(hash(cells),23.);',
' float paths=pow(1.-abs(sin((p.x+p.y)*36.+n1*9.)),28.);',
' material+=u_glow*(nodes*.7+paths*.17);',
'}',
'vec3 sun=normalize(vec3(-.43,.64,.69));float lambert=max(.07,dot(n,sun)*.72+.29);',
'float spec=pow(max(dot(reflect(-sun,n),vec3(0.,0.,1.)),0.),29.);',
'float rim=pow(1.-z,3.6);vec3 illuminated=material*lambert+u_light*spec*.12+u_glow*rim*.27;',
'float alpha=sphere*(1.-smoothstep(1.-u_pixel*1.8,1.02,radius)) + atmos*.19;',
'gl_FragColor=vec4(illuminated,clamp(alpha,0.,1.));}'
].join('');
let gl=null,ctx=null,program=null,buffer=null,attrs={},uniforms={},frame=0,last=0,active=true,zoomTarget='',zoomStart=0;
let width=0,height=0,dpr=1;
function shader(kind,src){
 const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'shader compilation');
 return s;
}
function switchToCanvas(){
 gl=null;program=null;
 const replacement=document.createElement('canvas');
 replacement.id='v26SatelliteField';replacement.className='v26-satellite-field';replacement.setAttribute('aria-hidden','true');
 field.replaceWith(replacement);field=replacement;
 ctx=field.getContext('2d');
 hub.dataset.v26Renderer='canvas';
 resize();
}
function setup(){
 try{
  gl=field.getContext('webgl',{alpha:true,antialias:false,depth:false,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl)throw Error('WebGL unavailable');
  const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);
  program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader linkage');
  gl.deleteShader(v);gl.deleteShader(f);gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(program,'a_corner');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  for(const name of ['u_center','u_scale','u_dark','u_mid','u_light','u_glow','u_type','u_time','u_pixel'])uniforms[name]=gl.getUniformLocation(program,name);
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0,0,0,0);
 }catch(e){console.warn('V26 shared satellite WebGL unavailable — Canvas fallback:',String(e));switchToCanvas();}
 field.addEventListener('webglcontextlost',e=>{e.preventDefault();switchToCanvas();});
}
function resize(){
 const box=hub.getBoundingClientRect();
 width=Math.max(1,box.width);height=Math.max(1,box.height);
 const mobile=width<820;dpr=Math.min(devicePixelRatio||1,mobile?1:1.4);
 field.width=Math.max(1,Math.round(width*dpr));field.height=Math.max(1,Math.round(height*dpr));
 field.style.width=width+'px';field.style.height=height+'px';
 if(gl)gl.viewport(0,0,field.width,field.height);
 if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
 schedule();
}
function planetBox(i,t){
 const el=labels[i];if(!el)return null;
 const r=el.getBoundingClientRect(),parent=hub.getBoundingClientRect();
 if(r.width<1||r.height<1)return null;
 const mobile=width<820;
 let x=r.left-parent.left+r.width*.5,y=r.top-parent.top+r.height*(mobile?.34:.36);
 let radius=Math.min(r.width*(mobile?.43:.43),r.height*(mobile?.36:.35));
 radius=Math.max(radius,mobile?19:27);
 if(zoomTarget){
  const progress=Math.max(0,Math.min(1,(t-zoomStart)/(reduced?1:850)));
  const k=progress*progress*(3.-2.*progress);
  if(ids[i]===zoomTarget){
   x+=(width*(mobile?.55:.67)-x)*k;
   y+=(height*.50-y)*k;
   radius+=(Math.min(width*.34,height*.46)-radius)*k;
  }else radius*=1.-k*.9;
 }
 return {x,y,radius};
}
function paintCanvasPlanet(i,p,t){
 if(!ctx)return;
 const palette=palettes[i],c=ctx;const x=p.x,y=p.y,R=p.radius;
 c.save();
 const shadow=c.createRadialGradient(x,y,R*.65,x,y,R*1.15);
 shadow.addColorStop(0,'rgba(0,0,0,0)');shadow.addColorStop(.74,'rgba(0,0,0,0)');shadow.addColorStop(1,palette.glow+'0a');
 c.fillStyle=shadow;c.beginPath();c.arc(x,y,R*1.15,0,6.283);c.fill();
 c.beginPath();c.arc(x,y,R,0,6.283);c.clip();
 const g=c.createRadialGradient(x-R*.38,y-R*.44,R*.06,x+R*.2,y+R*.05,R*1.18);
 g.addColorStop(0,palette.light);g.addColorStop(.34,palette.medium);g.addColorStop(.77,palette.dark);g.addColorStop(1,'#020305');
 c.fillStyle=g;c.fillRect(x-R,y-R,R*2,R*2);
 const rot=reduced?0:t*.000015;
 for(let j=0;j<18;j++){
  const ry=(j-9)*R*.12,rx=R*Math.sqrt(Math.max(.01,1-(ry/R)**2));
  c.beginPath();
  c.ellipse(x+Math.sin(j*1.91+rot)*R*.055,y+ry,rx,R*(i===1?.037:.025),Math.sin(j*.8)*.08,0,6.283);
  c.strokeStyle=(j%3===0?palette.light:palette.glow)+'32';c.lineWidth=Math.max(.7,R*.012);c.stroke();
 }
 if(i===0){c.strokeStyle=palette.glow;c.shadowBlur=9;c.shadowColor=palette.glow;
  for(let j=0;j<7;j++){const yy=y+R*(-.75+j*.25);c.beginPath();c.moveTo(x-R,yy);c.lineTo(x+R*.5,yy+R*.3);c.stroke();}
 }else if(i===2){c.strokeStyle=palette.light+'63';
  for(let j=0;j<8;j++){const a=j*2.39,rr=R*((j*.49)%1);c.beginPath();c.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,R*.035+j%3,0,6.283);c.stroke();}
 }else if(i===3){c.strokeStyle=palette.glow+'73';
  for(let j=0;j<8;j++){const a=j*2.399,b=(j+3)*2.399;
   c.beginPath();c.moveTo(x+Math.cos(a)*R*.57,y+Math.sin(a)*R*.57);c.lineTo(x+Math.cos(b)*R*.57,y+Math.sin(b)*R*.57);c.stroke();}
 }
 c.restore();
 c.beginPath();c.arc(x,y,R+.5,0,6.283);c.strokeStyle=palette.glow+'80';c.lineWidth=Math.max(.5,R*.008);c.stroke();
}
function draw(t){
 frame=0;
 if(!active||document.hidden||hub.hidden||width<1||height<1)return;
 if(!reduced&&t-last<(width<820?80:45)){schedule();return;}
 if(reduced&&last&&t-last<400)return;
 last=t;
 if(gl){gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);}
 else if(ctx){ctx.clearRect(0,0,width,height);}
 for(let i=0;i<4;i++){
  const box=planetBox(i,t);if(!box)continue;
  if(ctx){paintCanvasPlanet(i,box,t);continue;}
  if(!gl)continue;
  const c=box,r=box.radius*1.18,pal=palettes[i];
  gl.uniform2f(uniforms.u_center,c.x/width*2-1,1-c.y/height*2);
  gl.uniform2f(uniforms.u_scale,r/width*2,r/height*2);
  gl.uniform3fv(uniforms.u_dark,color(pal.dark));
  gl.uniform3fv(uniforms.u_mid,color(pal.medium));
  gl.uniform3fv(uniforms.u_light,color(pal.light));
  gl.uniform3fv(uniforms.u_glow,color(pal.glow));
  gl.uniform1f(uniforms.u_type,i);
  gl.uniform1f(uniforms.u_time,reduced?0:t*.001);
  gl.uniform1f(uniforms.u_pixel,1/Math.max(1,c.radius));
  gl.drawArrays(gl.TRIANGLES,0,6);
 }
 if(!reduced||zoomTarget)schedule();
}
function schedule(){if(!frame&&!document.hidden&&active)frame=requestAnimationFrame(draw);}
const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
if(resizeObserver)resizeObserver.observe(hub);
window.addEventListener('resize',resize,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else schedule();});
function zoom(id){
 zoomTarget=ids.includes(id)?id:'';
 zoomStart=performance.now();schedule();
}
function reset(){zoomTarget='';zoomStart=0;schedule();}
function stop(){active=false;if(frame){cancelAnimationFrame(frame);frame=0;}resizeObserver?.disconnect();}
setup();resize();
window.MarketFourPlanets=Object.freeze({zoom,reset,stop,resume:()=>{active=true;resize();},get renderer(){return gl?'webgl':'canvas'},get planets(){return ids.slice()},version:'26.0.0'});
})();