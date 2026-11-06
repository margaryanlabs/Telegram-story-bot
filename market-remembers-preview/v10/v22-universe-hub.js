/* MARKET REMEMBERS V21 — interactive financial universe.
   Procedural ray-sphere WebGL planets / Canvas fallback / no external dependencies.
   PEOPLE and EVENT CORE resolve to the preserved V20 application.
*/
(()=>{
'use strict';
const app=document.getElementById('cosmosApp');
if(!app)return;
const sky=document.getElementById('cosmosSky');
let globe=document.getElementById('cosmosPlanets');
const sky2d=sky.getContext('2d');
const info=document.getElementById('cosmosInfo');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const worlds=[
  {id:'people',name:'PEOPLE',color:'#78dcff',deep:'#073d69',light:'#80dfff',about:'Истории людей, их ошибки, опыт и личные уроки рынка.',url:'worlds/index.html?world=people'},
  {id:'events',name:'EVENT CORE',color:'#ff8572',deep:'#500c1c',light:'#ed4e3d',about:'Исторические кризисы, проверенные источники, сравнение событий и Shock Replay.',url:'worlds/index.html?mm=events'},
  {id:'decisions',name:'DECISIONS',color:'#f6cd86',deep:'#5a320b',light:'#e7b75e',about:'Публичные гипотезы до результата, Decision Passport и разбор принятых решений.'},
  {id:'agora',name:'AGORA',color:'#d4adff',deep:'#45216e',light:'#ae83ef',about:'Дискуссии, аргументы, вопросы опытным участникам и общие исследования.'},
  {id:'mirror',name:'MIRROR',color:'#e1e9f5',deep:'#415267',light:'#d0e0ef',about:'AI-рефлексия, собственные ошибки и развитие финансового мышления.'},
  {id:'guilds',name:'GUILDS',color:'#7ee4aa',deep:'#0a5141',light:'#63d5a0',about:'Профессиональные группы, наставники, коллективный опыт и исследовательские сообщества.'}
];
const labels=Object.fromEntries([...document.querySelectorAll('.cosmos-world')].map(el=>[el.dataset.world,el]));
const byId=Object.fromEntries(worlds.map((v,i)=>[v.id,{...v,index:i}]));
const status=document.getElementById('cosmosStatus');
let W=1,H=1,DPR=1,stars=[],ctx=null,gl=null,program=null,uni=null,attr=-1,buffer=null;
let paused=false,hover=null,flying=null,flightAt=0,flightTimer=null,raf=0,lastFrame=0,now=0,pointer={x:0,y:0};
const seed=20261106;let prng=seed;
const rand=()=>{prng=(Math.imul(prng,1664525)+1013904223)|0;return(prng>>>0)/4294967296};
const rgb=h=>{const v=parseInt(h.slice(1),16);return[(v>>16&255)/255,(v>>8&255)/255,(v&255)/255]};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function loc(world){
 const compact=W<820;
 const coords=compact?[
 [.50,.51,.155],[.18,.365,.085],[.82,.37,.085],[.50,.295,.075],[.20,.735,.084],[.80,.735,.084]
 ]:[
 [.535,.545,.235],[.18,.7,.125],[.415,.235,.105],[.61,.19,.089],[.81,.31,.122],[.84,.71,.115]
 ];
 const c=coords[world.index];
 const r=compact?Math.min(H*c[2],W*(world.index===0?.23:.115)):Math.min(H*c[2],W*(world.index===0?.145:.072));
 const ambient=reduce?0:Math.sin(now*.00032+world.index*1.4)*3.5;
 return {x:W*c[0]+pointer.x*(world.index===0?-.015:.028)*W,y:H*c[1]+ambient+pointer.y*.02*H,r:Math.max(compact?24:30,r)};
}
function coordinates(){
 for(const world of worlds){
  const w=byId[world.id],p=loc(w),el=labels[w.id];
  if(el){el.style.left=p.x+'px';el.style.top=(p.y+p.r+(W<820?5:12))+'px';}
 }
}
function resize(){
 W=Math.max(300,innerWidth);H=Math.max(400,innerHeight);DPR=Math.min(devicePixelRatio||1,W<740?1.35:1.65);
 for(const el of [sky,globe]){el.width=Math.round(W*DPR);el.height=Math.round(H*DPR);el.style.width=W+'px';el.style.height=H+'px';}
 if(sky2d)sky2d.setTransform(DPR,0,0,DPR,0,0);
 if(ctx)ctx.setTransform(DPR,0,0,DPR,0,0);
 if(gl)gl.viewport(0,0,globe.width,globe.height);
 stars=Array.from({length:W<740?135:300},()=>({x:rand(),y:rand(),size:.2+rand()*1.1,light:.1+rand()*.78,phase:rand()*6.28,depth:.2+rand()*.8}));
 coordinates();
}
function skyPass(t){
 if(!sky2d)return;
 sky2d.clearRect(0,0,W,H);
 const x=W*.535,y=H*.545,m=Math.min(W,H*1.7);
 const rings=W<740?[.35,.59,.85]:[.39,.63,.89];
 for(let i=0;i<rings.length;i++){
  sky2d.beginPath();sky2d.ellipse(x,y,m*rings[i],m*rings[i]*.43,-.24,0,Math.PI*2);
  sky2d.strokeStyle='rgba(167,189,222,'+(.11-i*.021)+')';sky2d.lineWidth=.72;sky2d.stroke();
 }
 for(const s of stars){
  const a=s.light*(reduce?1:.75+.25*Math.sin(t*.001+s.phase));
  sky2d.beginPath();sky2d.arc((s.x+pointer.x*s.depth*.013)*W,(s.y+pointer.y*s.depth*.016)*H,s.size,0,6.283);
  sky2d.fillStyle='rgba(210,228,247,'+a+')';sky2d.fill();
 }
 for(const item of worlds){
  const w=byId[item.id],p=loc(w),grad=sky2d.createRadialGradient(p.x,p.y,p.r*.45,p.x,p.y,p.r*1.55);
  grad.addColorStop(0,item.color+'23');grad.addColorStop(.5,item.color+'0c');grad.addColorStop(1,'transparent');
  sky2d.beginPath();sky2d.arc(p.x,p.y,p.r*1.55,0,6.283);sky2d.fillStyle=grad;sky2d.fill();
  if(hover===item.id&&!flying){sky2d.beginPath();sky2d.arc(p.x,p.y,p.r+10,0,6.283);sky2d.strokeStyle=item.color+'95';sky2d.lineWidth=1;sky2d.stroke();}
 }
 // Orbiting light markers and context arcs are decorative, not real market signals.
 const orbitWidth=Math.min(W,H*1.7);
 const angular=reduce?.48:t*.000115;
 for(let j=0;j<3;j++){
  const rr=[.39,.63,.89][j]*orbitWidth;
  const th=angular*(1-j*.18)+j*2.14;
  const px=x+Math.cos(th)*rr,py=y+Math.sin(th)*rr*.43;
  sky2d.beginPath();sky2d.arc(px,py,j===1?1.9:1.2,0,6.283);
  sky2d.fillStyle=j===1?'rgba(243,221,178,.83)':'rgba(181,214,255,.53)';sky2d.fill();
 }
 if(hover&&!flying){
  const focus=loc(byId[hover]),center=loc(byId.people);
  if(hover!=='people'){
   sky2d.save();sky2d.setLineDash([3,8]);
   sky2d.strokeStyle='rgba(162,196,229,.29)';sky2d.lineWidth=1;
   sky2d.beginPath();sky2d.moveTo(center.x,center.y);
   sky2d.quadraticCurveTo((center.x+focus.x)*.5,(center.y+focus.y)*.5-Math.min(56,H*.08),focus.x,focus.y);
   sky2d.stroke();sky2d.restore();
  }
  const pulse=reduce?0:(Math.sin(t*.0025)+1)*.5;
  sky2d.beginPath();sky2d.arc(focus.x,focus.y,focus.r+13+pulse*5,0,6.283);
  sky2d.strokeStyle=byId[hover].color+'64';sky2d.lineWidth=1;sky2d.stroke();
  for(let k=0;k<4;k++){
   const a=k*Math.PI*.5,inner=focus.r+17,outer=focus.r+25;
   sky2d.beginPath();
   sky2d.moveTo(focus.x+Math.cos(a)*inner,focus.y+Math.sin(a)*inner);
   sky2d.lineTo(focus.x+Math.cos(a)*outer,focus.y+Math.sin(a)*outer);
   sky2d.strokeStyle='rgba(220,235,250,.62)';sky2d.stroke();
  }
 }
 if(!reduce){
  const phase=(t%18500)/18500;
  if(phase>.11&&phase<.23){
   const p=(phase-.11)/.12,cx=W*(.92-p*.23),cy=H*(.10+p*.14);
   const g=sky2d.createLinearGradient(cx-96,cy-52,cx,cy);
   g.addColorStop(0,'rgba(90,137,209,0)');g.addColorStop(1,'rgba(183,219,250,.7)');
   sky2d.strokeStyle=g;sky2d.lineWidth=1.5;sky2d.beginPath();sky2d.moveTo(cx-96,cy-52);sky2d.lineTo(cx,cy);sky2d.stroke();
   sky2d.beginPath();sky2d.arc(cx,cy,1.7,0,6.283);sky2d.fillStyle='#dbeeff';sky2d.fill();
  }
 }
}
function shader(type,src){
 const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const err=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(err);}
 return s;
}
const vert=['attribute vec2 a_corner;','varying vec2 v_uv;','uniform vec2 u_center,u_scale;','void main(){v_uv=a_corner;gl_Position=vec4(u_center+a_corner*u_scale,0.,1.);}'].join('');
const frag=[
'precision highp float;varying vec2 v_uv;uniform vec3 u_deep,u_light;uniform float u_time,u_type,u_hover;',
'float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}',
'float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
'return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),',
'mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}',
'void main(){float radius=dot(v_uv,v_uv);if(radius>1.)discard;float z=sqrt(max(0.,1.-radius));vec3 n=normalize(vec3(v_uv,z));',
'float theta=u_time*.035+u_type*.97;vec3 p=vec3(n.x*cos(theta)+n.z*sin(theta),n.y,n.z*cos(theta)-n.x*sin(theta));',
'float f=noise3(p*4.8),detail=noise3(p*13.5);float grain=f*.78+detail*.22;',
'vec3 base=mix(u_deep,u_light,smoothstep(.2,.8,grain));',
'if(u_type<.5){float land=smoothstep(.47,.68,f+detail*.12);base=mix(vec3(.01,.09,.22),vec3(.12,.53,.48),land*.74);',
'float cities=pow(hash(floor(p*53.)),13.)*land;base+=vec3(.85,.56,.2)*cities;',
'float clouds=smoothstep(.69,.85,noise3(p*9.8+vec3(1.,2.,3.)));base=mix(base,vec3(.71,.86,.95),clouds*.36);}',
'else if(u_type<1.5){float crack=pow(abs(sin(p.x*25.+f*11.)*sin(p.z*23.)),18.);base+=vec3(.85,.12,.01)*crack*.72;}',
'else if(u_type<2.5){base+=vec3(.45,.26,.07)*pow(abs(sin(p.y*35.+f*8.)),25.)*.3;}',
'else if(u_type<3.5){base+=vec3(.2,.1,.46)*pow(abs(sin(p.y*22.+f*11.)),10.)*.4;}',
'else if(u_type<4.5){base+=vec3(.45,.48,.51)*pow(max(dot(n,normalize(vec3(-.3,.6,1.))),0.),18.)*.24;}',
'else{float nodes=pow(hash(floor(p*37.)),19.);base+=vec3(.2,.83,.4)*nodes*.85;}',
'vec3 sun=normalize(vec3(-.44,.61,.83));float shade=max(.055,dot(n,sun)*.83+.17);',
'float rim=pow(1.-z,2.8);vec3 c=base*shade+u_light*rim*(.35+.16*u_hover);',
'gl_FragColor=vec4(c,1.);}'
].join('');
function createGL(){
 gl=globe.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:false});
 if(!gl)throw Error('WebGL missing');
 const vs=shader(gl.VERTEX_SHADER,vert),fs=shader(gl.FRAGMENT_SHADER,frag);
 program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
 buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 attr=gl.getAttribLocation(program,'a_corner');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 const get=name=>gl.getUniformLocation(program,name);
 uni={center:get('u_center'),scale:get('u_scale'),deep:get('u_deep'),light:get('u_light'),time:get('u_time'),type:get('u_type'),hover:get('u_hover')};
 gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
 globe.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();},{once:true});
}
function fallback(){
 gl=null;program=null;
 const canvas=document.createElement('canvas');canvas.className='cosmos-planets';canvas.id='cosmosPlanets';canvas.setAttribute('aria-hidden','true');
 globe.replaceWith(canvas);globe=canvas;ctx=canvas.getContext('2d');
 document.getElementById('cosmosRenderStatus').textContent='CANVAS FALLBACK';
 resize();
}
function planet2d(w,p){
 const c=ctx, r=p.r, x=p.x, y=p.y;
 c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();
 // High-contrast lit hemisphere, diffuse terminator and fixed detail seed.
 const grad=c.createRadialGradient(x-r*.32,y-r*.43,r*.03,x+r*.32,y+r*.22,r*1.46);
 grad.addColorStop(0,w.light);grad.addColorStop(.42,w.deep);grad.addColorStop(1,'#010307');
 c.fillStyle=grad;c.fillRect(x-r,y-r,r*2,r*2);
 const terminator=c.createLinearGradient(x-r,y-r*.5,x+r,y+r*.8);
 terminator.addColorStop(0,'#01040a40');terminator.addColorStop(.4,'#020b1600');terminator.addColorStop(1,'#0002097f');
 c.fillStyle=terminator;c.fillRect(x-r,y-r,r*2,r*2);
 for(let k=0;k<42;k++){
  const a=k*2.399963+w.index*.91;
  const d=Math.sqrt((k*.61803398)%1)*r*.94;
  c.beginPath();c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,Math.max(.5,(k%5===0?2:1)*r/125),0,6.283);
  c.fillStyle=k%3===0?'#e8f4ff16':'#03102525';c.fill();
 }
 if(w.index===0){
  // The PEOPLE world has geographical hints, luminous story nodes and routes.
  const a=[[-.73,-.38],[-.4,-.65],[-.13,-.52],[.02,-.2],[-.18,.08],[-.43,.16],[-.22,.51],[-.54,.32]];
  const b=[[.28,-.64],[.7,-.45],[.59,-.19],[.81,.08],[.55,.4],[.26,.23],[.12,-.18]];
  for(const [shape,color] of [[a,'#165a66a9'],[b,'#0c758099']]){
   c.beginPath();shape.forEach(([u,v],i)=>i?c.lineTo(x+u*r,y+v*r):c.moveTo(x+u*r,y+v*r));
   c.closePath();c.fillStyle=color;c.fill();
  }
  c.lineWidth=Math.max(1,r*.017);c.strokeStyle='#a9e8f638';
  for(let i=0;i<6;i++){let yy=y+r*(-.52+i*.18);c.beginPath();c.moveTo(x-r*.76,yy);c.bezierCurveTo(x-r*.27,yy-r*.07,x+r*.27,yy+r*.12,x+r*.78,yy);c.stroke();}
  const nodes=[[-.48,-.2],[-.22,-.18],[.08,.09],[.44,0],[.3,-.3],[-.11,.33],[.58,.25]];
  c.lineWidth=Math.max(.7,r*.007);c.strokeStyle='#ffd69458';
  for(let i=1;i<nodes.length;i++){
   const a=nodes[i-1],b=nodes[i];c.beginPath();c.moveTo(x+a[0]*r,y+a[1]*r);
   c.quadraticCurveTo(x+(a[0]+b[0])*.5*r,y-r*.09,x+b[0]*r,y+b[1]*r);c.stroke();
  }
  for(const [u,v] of nodes){c.beginPath();c.arc(x+u*r,y+v*r,Math.max(1.1,r*.011),0,6.283);c.fillStyle='#ffe0a2';c.shadowColor='#ffcb82';c.shadowBlur=9;c.fill();}
  c.shadowBlur=0;
 }else if(w.index===1){
  c.lineWidth=Math.max(1,r*.019);c.strokeStyle='#ff833cc5';c.shadowColor='#ff3a14';c.shadowBlur=r*.1;
  for(let j=0;j<7;j++){const sx=x+r*(-.72+j*.24),sy=y+r*(-.45+j%3*.3);c.beginPath();c.moveTo(sx,sy);
   c.lineTo(sx+r*.16,sy+r*.20);c.lineTo(sx-r*.01,sy+r*.38);c.lineTo(sx+r*.18,sy+r*.57);c.stroke();}
  c.shadowBlur=0;
 }else if(w.index===2){
  c.lineWidth=Math.max(.6,r*.012);c.strokeStyle='#f7d6a25c';
  for(let j=0;j<12;j++){const xx=x-r*.64+j*r*.12,v=Math.sin(j*1.53)*r*.35;
   c.beginPath();c.moveTo(xx,y+v-r*.11);c.lineTo(xx,y+v+r*.12);c.stroke();
   c.fillStyle=j%2===0?'#ffdfac65':'#2d15077a';c.fillRect(xx-r*.027,y+v-r*.07,r*.054,r*.14);}
 }else if(w.index===3){
  c.strokeStyle='#e2bfff4f';c.lineWidth=Math.max(.7,r*.012);
  for(let j=0;j<8;j++){c.beginPath();c.ellipse(x,y+r*(-.54+j*.15),r*.77,r*.07,-.05,0,6.283);c.stroke();}
 }else if(w.index===4){
  c.lineWidth=Math.max(.7,r*.012);c.strokeStyle='#f6faff45';
  for(let j=0;j<7;j++){c.beginPath();c.moveTo(x-r*.8,y+r*(-.4+j*.13));
   c.bezierCurveTo(x-r*.12,y-r*.18,x+r*.26,y+r*.14,x+r*.77,y+r*(-.41+j*.13));c.stroke();}
 }else if(w.index===5){
  const nodes=[];
  for(let j=0;j<18;j++){const a=j*2.399963,d=r*Math.sqrt((j*.69)%1)*.81;nodes.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}
  c.lineWidth=Math.max(.6,r*.008);c.strokeStyle='#b3ffbb5b';
  for(let j=0;j<nodes.length;j++){c.beginPath();c.moveTo(...nodes[j]);c.lineTo(...nodes[(j+7)%nodes.length]);c.stroke();}
  for(const node of nodes){c.beginPath();c.arc(...node,Math.max(.95,r*.012),0,6.283);c.fillStyle='#caffb0';c.shadowColor='#8bf6a6';c.shadowBlur=8;c.fill();}
  c.shadowBlur=0;
 }
 c.restore();
 c.beginPath();c.arc(x,y,r+.7,0,6.283);c.strokeStyle=w.color+'75';c.lineWidth=1;c.stroke();
 if(w.index===3){c.save();c.beginPath();c.ellipse(x,y,r*1.17,r*.28,-.18,0,6.283);
  c.strokeStyle='#d8b2ff75';c.lineWidth=Math.max(1,r*.018);c.stroke();c.restore();}
}
function planetPass(t){
 if(ctx)ctx.clearRect(0,0,W,H);
 if(gl){gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);}
 const order=worlds.slice().sort((a,b)=>a.id==='people'?1:b.id==='people'?-1:0);
 for(const item of order){
  const w=byId[item.id],p=loc(w);
  if(flying){
   const elapsed=clamp((t-flightAt)/1150,0,1),k=elapsed*elapsed*(3-2*elapsed);
   if(item.id===flying){p.x+=(W*.5-p.x)*k;p.y+=(H*.52-p.y)*k;p.r*=1+3.3*k;}
   else p.r*=1-.75*k;
  }
  if(ctx)planet2d(w,p);
  else if(gl&&uni){
   gl.uniform2f(uni.center,p.x/W*2-1,1-p.y/H*2);
   gl.uniform2f(uni.scale,p.r/W*2,p.r/H*2);
   gl.uniform3fv(uni.deep,rgb(w.deep));gl.uniform3fv(uni.light,rgb(w.light));
   gl.uniform1f(uni.type,w.index);gl.uniform1f(uni.time,t*.001);
   gl.uniform1f(uni.hover,hover===w.id?1:0);
   gl.drawArrays(gl.TRIANGLES,0,6);
  }
 }
}
function render(t){
 raf=0;if(paused)return;
 now=t;
 if(reduce && t-lastFrame<160 && !flying){raf=requestAnimationFrame(render);return;}
 if(!reduce && innerWidth<740 && t-lastFrame<28){raf=requestAnimationFrame(render);return;}
 lastFrame=t;coordinates();skyPass(t);planetPass(t);raf=requestAnimationFrame(render);
}
function request(){if(!raf&&!paused)raf=requestAnimationFrame(render)}
function setHover(id){
 if(hover===id)return;
 if(labels[hover])labels[hover].classList.remove('is-focused');
 hover=id;if(labels[id])labels[id].classList.add('is-focused');
 document.getElementById('cosmosCoordinates').textContent=id?byId[id].name+' / '+byId[id].index.toString().padStart(2,'0'):'SYS / 06 WORLDS';
}
function selectionAt(x,y){
 const sorted=worlds.slice().reverse();
 for(const item of sorted){
  const p=loc(byId[item.id]);if(Math.hypot(x-p.x,y-p.y)<=p.r*1.13)return item.id;
 }
 return null;
}
function openWorld(id){
 const world=byId[id];if(!world||flying)return;
 setHover(id);flying=id;flightAt=performance.now();
 app.classList.add('is-traveling');
 document.getElementById('cosmosFlightName').textContent=world.name;
 status.textContent='Приближаемся к '+world.name;
 for(const item of worlds)labels[item.id].disabled=true;
 const ms=reduce?30:1040;
 flightTimer=setTimeout(()=>{
  flying=null;app.classList.remove('is-traveling');
  for(const item of worlds)labels[item.id].disabled=false;
  if(world.url){location.assign(world.url);return;}
  document.getElementById('cosmosInfoTitle').textContent=world.name;
  document.getElementById('cosmosInfoKicker').textContent='FUTURE WORLD / '+(world.index+1).toString().padStart(2,'0');
  document.getElementById('cosmosInfoBody').textContent=world.about;
  info.hidden=false;document.getElementById('cosmosInfoClose').focus();
  status.textContent=world.name+' — мир в разработке';
 },ms);
}
function closeInfo(){info.hidden=true;labels[hover]?.focus();}
for(const el of document.querySelectorAll('[data-world]'))el.addEventListener('click',()=>openWorld(el.dataset.world));
for(const el of document.querySelectorAll('[data-jump]'))el.addEventListener('click',()=>openWorld(el.dataset.jump));
for(const el of document.querySelectorAll('.cosmos-world')){
 el.addEventListener('mouseenter',()=>setHover(el.dataset.world));
 el.addEventListener('focus',()=>setHover(el.dataset.world));
}
app.addEventListener('pointermove',event=>{
 if(flying||!info.hidden)return;
 pointer={x:clamp(event.clientX/W*2-1,-1,1),y:clamp(event.clientY/H*2-1,-1,1)};
 if(!event.target.closest('button,a'))setHover(selectionAt(event.clientX,event.clientY));
},{passive:true});
app.addEventListener('click',event=>{
 if(flying||!info.hidden||event.target.closest('button,a,.cosmos-info'))return;
 const id=selectionAt(event.clientX,event.clientY);if(id)openWorld(id);
});
document.getElementById('cosmosInfoClose').addEventListener('click',closeInfo);
document.getElementById('cosmosInfoBack').addEventListener('click',closeInfo);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!info.hidden){closeInfo();return;}
 if(!info.hidden||flying||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 const focused=document.activeElement;
 if(!focused?.classList?.contains('cosmos-world'))return;
 const index=worlds.findIndex(w=>labels[w.id]===focused);
 if(index<0)return;
 const next=(index+(event.key==='ArrowRight'?1:-1)+worlds.length)%worlds.length;
 event.preventDefault();labels[worlds[next].id].focus();
});
document.addEventListener('visibilitychange',()=>{
 paused=document.hidden;
 if(paused&&raf){cancelAnimationFrame(raf);raf=0;}
 if(!paused)request();
});
window.addEventListener('pagehide',()=>{if(flightTimer)clearTimeout(flightTimer);if(raf)cancelAnimationFrame(raf);});
window.addEventListener('resize',()=>{resize();request();},{passive:true});
try{createGL();document.getElementById('cosmosRenderStatus').textContent='WEBGL PLANET ENGINE';}
catch(error){console.warn('Cosmic WebGL fallback:',error);fallback();}
resize();request();
})();