/* THE MARKET REMEMBERS — standalone, dependency-free WebGL globe prototype.
   Sample people are fictional. A new user's entry is saved ONLY in localStorage. */
(() => {
  'use strict';
  const EXAMPLES = [
    { id:1, alias:'NORTHSTAR', market:'CRYPTO', category:'Patience', quote:'Я понял: не каждая свеча требует моего решения.', lesson:'Ожидание — тоже действие. После года импульсивных входов я впервые смог пропустить сигнал и сохранить спокойствие.', p:[.30,.15,.942] },
    { id:2, alias:'NIGHT OWL', market:'FOREX', category:'Risk', quote:'Рынок не обязан возвращать мне потерянное.', lesson:'Попытки отыграться превратили обычный убыточный день в катастрофу. Теперь у меня заранее определён лимит потерь.', p:[-.31,.45,.84] },
    { id:3, alias:'MIRA', market:'STOCKS', category:'Discipline', quote:'Мой лучший трейд — тот, который я не открыла.', lesson:'Я научилась признавать, что отсутствие ясного сценария — хорошая причина остаться вне рынка.', p:[.55,-.26,.792] },
    { id:4, alias:'SOLACE', market:'CRYPTO', category:'FOMO', quote:'Чужая прибыль — не мой упущенный шанс.', lesson:'Сравнение себя с другими лишало меня дисциплины. Я перестал гнаться за чужими скриншотами.', p:[-.65,-.12,.75] },
    { id:5, alias:'ATLAS', market:'FUTURES', category:'Risk', quote:'Плечо не превращает ошибку в уверенность.', lesson:'Я научился оценивать риск сделки прежде, чем думать о потенциальной прибыли.', p:[.14,-.60,.787] },
    { id:6, alias:'ASTER', market:'CRYPTO', category:'Discipline', quote:'План работает лишь тогда, когда ему следуешь.', lesson:'Я начал вести журнал решений, включая дни без сделок.', p:[-.05,.82,.571] },
    { id:7, alias:'VIOLET', market:'FOREX', category:'Patience', quote:'Иногда самое сложное — ничего не делать.', lesson:'Неопределённость невозможно победить количеством кликов.', p:[.80,.20,.564] },
    { id:8, alias:'MONO', market:'STOCKS', category:'FOMO', quote:'Я перестал покупать чужой энтузиазм.', lesson:'Мой горизонт инвестиций не должен меняться из-за одного вирусного поста.', p:[-.29,-.80,.525] },
    { id:9, alias:'HELIX', market:'CRYPTO', category:'Risk', quote:'Капитал можно вернуть. Потерянное время — нет.', lesson:'Я решил не рисковать финансовой безопасностью семьи ради одной идеи.', p:[.68,.64,.355] },
    { id:10, alias:'ECHO', market:'FOREX', category:'Discipline', quote:'Моя уверенность не делает прогноз правдой.', lesson:'После серии удач я перестал проверять предположения и дорого заплатил за это.', p:[-.77,.51,.376] },
    { id:11, alias:'LUMEN', market:'STOCKS', category:'Patience', quote:'Рынок будет завтра. Моё внимание — ограничено.', lesson:'Отдых не мешает дисциплине. Он её поддерживает.', p:[.33,-.84,.429] },
    { id:12, alias:'ORBIT', market:'CRYPTO', category:'FOMO', quote:'Скорость решения не гарантирует его качество.', lesson:'Я оставляю время на проверку фактов перед входом.', p:[-.87,-.29,.403] },
  ];
  const els = (id) => document.getElementById(id);
  const stage=els('globeStage'), canvas=els('globeCanvas'), pin=els('focusPin');
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const normalize=(p)=>{const s=Math.hypot(...p);return p.map(v=>v/s)};
  const savedKey='market-remembers-demo-local-stories-v1';
  let saved=[];
  try { const data=JSON.parse(localStorage.getItem(savedKey)||'[]'); if(Array.isArray(data)) saved=data.filter(s=>s&&typeof s.alias==='string'&&typeof s.quote==='string'&&Array.isArray(s.p)).slice(-80); } catch {}
  const stories=[...EXAMPLES,...saved];
  let selected=0, currentFilter='all', searchTerm='', visibleLimit=24, rotY=.16, rotX=-.14, zoom=1, spinning=!reduceMotion, cameraTarget=null, dragging=false, sx=0,sy=0,lastX=0,lastY=0,moved=0;
  let w=1,h=1,dpr=1,renderer=null,particles=[],particleBuffer=null,network=[],networkBuffer=null;
  let gl=null,glPoints=null,glLines=null,programPoints=null,programLines=null,ctx2d=null,fallbackCanvas=null,frame=0,lastTs=0;

  function seededRand(seed){ let x=seed|0; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}; }
  const rand=seededRand(1642);
  function makeParticles(){
    const lowPower=window.innerWidth<700||(navigator.hardwareConcurrency||4)<=4;
    const count=lowPower?1100:2400;
    const geometryRand=seededRand(1642);
    particles=[];
    const golden=Math.PI*(3-Math.sqrt(5));
    for(let i=0;i<count;i++){
      const y=1-2*(i+.5)/count;const r=Math.sqrt(Math.max(0,1-y*y));const theta=golden*i;
      // Mostly a luminous shell, with a handful of inner and outer layers for true parallax.
      const seed=geometryRand();
      const radius=seed<.16?.35+geometryRand()*.56:seed>.965?1.04+geometryRand()*.13:.965+geometryRand()*.07;
      particles.push({p:[Math.cos(theta)*r*radius,y*radius,Math.sin(theta)*r*radius],seed:geometryRand(),kind:geometryRand()>.992?1.25:.13+geometryRand()*.45,storyIndex:0});
    }
    stories.forEach((s,i)=>particles.push({p:s.p,seed:.99,kind:3,storyIndex:i+1,id:i}));
    // Short constellation connections following nearby spiral samples, not real social connections.
    network=[];
    for(let k=0;k<count;k+=4){if(geometryRand()>.55){const b=k+(geometryRand()>.5?8:13);if(b<count){network.push(...particles[k].p,...particles[b].p);}}}
  }
  function makeShader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function makeProgram(v,f){const p=gl.createProgram();gl.attachShader(p,makeShader(gl.VERTEX_SHADER,v));gl.attachShader(p,makeShader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  const transform=`
    uniform float uX; uniform float uY; uniform float uZoom; uniform float uAspect;
    vec3 transformPoint(vec3 pt){float cy=cos(uY),sy=sin(uY),cx=cos(uX),sx=sin(uX);
      vec3 q=vec3(cy*pt.x+sy*pt.z,pt.y,-sy*pt.x+cy*pt.z);
      return vec3(q.x,cx*q.y-sx*q.z,sx*q.y+cx*q.z);}
    vec4 project(vec3 p){float persp=2.8/(3.2-p.z*.65);return vec4(p.x*persp*.92*uZoom/uAspect,p.y*persp*.92*uZoom,.03-p.z*.01,1.);}
  `;
  const vertPoints=`attribute vec3 aPos;attribute float aSeed;attribute float aKind;attribute float aStoryIndex;uniform float uTime;uniform float uDpr;uniform float uSelected;uniform float uMotion;${transform}varying vec3 vColor;varying float vOpacity;varying float vKind;varying float vSelected;void main(){vec3 p=transformPoint(aPos);gl_Position=project(p);float front=clamp(.50+p.z*.48,.08,1.);float pulse=.5+.5*sin(uTime*.0025+aSeed*9.);float shimmer=1.-uMotion*.13+uMotion*.13*pulse;vSelected=step(.5,aStoryIndex)*(1.-step(.5,abs(aStoryIndex-uSelected)));vKind=aKind;vColor=mix(vec3(.51,.39,.64),vec3(.84,.68,.47),smoothstep(.72,.99,aSeed));if(aKind>2.)vColor=vec3(.87,.72,.53);if(vSelected>.5)vColor=vec3(1.,.90,.72);vOpacity=front*shimmer;gl_PointSize=min(40.,(1.1+aKind*2.3+vSelected*(10.+uMotion*2.*pulse))*uDpr*(.81+.30*p.z)*sqrt(uZoom));}`;
  const fragPoints=`precision mediump float;varying vec3 vColor;varying float vOpacity;varying float vKind;varying float vSelected;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;float glow=1.-smoothstep(.04,.5,r);float core=1.-smoothstep(.02,.15,r);float alpha=(core*.88+glow*(.24+vSelected*.34))*vOpacity;gl_FragColor=vec4(vColor,min(1.,alpha));}`;
  const vertLines=`attribute vec3 aPos;${transform}varying float vOpacity;void main(){vec3 p=transformPoint(aPos);gl_Position=project(p);vOpacity=.08*clamp(.7+p.z*.3,.12,1.);}`;
  const fragLines=`precision mediump float;varying float vOpacity;void main(){gl_FragColor=vec4(.63,.53,.69,vOpacity);}`;
  function initWebGL(){
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});if(!gl)throw Error('WebGL unavailable');
    if(programPoints)gl.deleteProgram(programPoints);
    if(programLines)gl.deleteProgram(programLines);
    if(particleBuffer)gl.deleteBuffer(particleBuffer);
    if(networkBuffer)gl.deleteBuffer(networkBuffer);
    programPoints=makeProgram(vertPoints,fragPoints);programLines=makeProgram(vertLines,fragLines);
    const pointArray=new Float32Array(particles.length*6);
    particles.forEach((n,i)=>{let j=i*6;pointArray[j]=n.p[0];pointArray[j+1]=n.p[1];pointArray[j+2]=n.p[2];pointArray[j+3]=n.seed;pointArray[j+4]=n.kind;pointArray[j+5]=n.storyIndex||0;});
    particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,pointArray,gl.STATIC_DRAW);
    networkBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,networkBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(network),gl.STATIC_DRAW);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);
    renderer='webgl';
  }
  function initFallback(){
    gl=null;
    if(!fallbackCanvas){
      fallbackCanvas=document.createElement('canvas');
      fallbackCanvas.className='fallback-globe-canvas';
      fallbackCanvas.setAttribute('aria-hidden','true');
      stage.insertBefore(fallbackCanvas,pin);
    }
    canvas.style.display='none';
    ctx2d=fallbackCanvas.getContext('2d');
    if(!ctx2d)throw Error('Canvas 2D unavailable');
    renderer='2d';
  }
  function resize(){
    const rect=stage.getBoundingClientRect();w=Math.max(1,rect.width);h=Math.max(1,rect.height);
    dpr=Math.min(window.devicePixelRatio||1,1.8);
    const surface=gl?canvas:fallbackCanvas;
    if(!surface)return;
    surface.width=Math.round(w*dpr);surface.height=Math.round(h*dpr);
    if(gl)gl.viewport(0,0,surface.width,surface.height);
    if(ctx2d)ctx2d.setTransform(dpr,0,0,dpr,0,0);
    renderPin();
  }
  function uniforms(program){gl.uniform1f(gl.getUniformLocation(program,'uX'),rotX);gl.uniform1f(gl.getUniformLocation(program,'uY'),rotY);gl.uniform1f(gl.getUniformLocation(program,'uZoom'),zoom);gl.uniform1f(gl.getUniformLocation(program,'uAspect'),w/h);}
  function drawWebGL(timestamp){
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(programLines);gl.bindBuffer(gl.ARRAY_BUFFER,networkBuffer);
    const lp=gl.getAttribLocation(programLines,'aPos');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,0,0);
    uniforms(programLines);gl.drawArrays(gl.LINES,0,network.length/3);gl.disableVertexAttribArray(lp);
    gl.useProgram(programPoints);gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);
    for(const [name,size,offset] of [['aPos',3,0],['aSeed',1,12],['aKind',1,16],['aStoryIndex',1,20]]){const a=gl.getAttribLocation(programPoints,name);if(a<0)continue;gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,24,offset);}
    uniforms(programPoints);
    gl.uniform1f(gl.getUniformLocation(programPoints,'uDpr'),dpr);
    gl.uniform1f(gl.getUniformLocation(programPoints,'uTime'),timestamp);
    gl.uniform1f(gl.getUniformLocation(programPoints,'uSelected'),selected+1);
    gl.uniform1f(gl.getUniformLocation(programPoints,'uMotion'),reduceMotion?0:1);
    gl.drawArrays(gl.POINTS,0,particles.length);
  }
  function project(p){const cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX);let x=cy*p[0]+sy*p[2], z=-sy*p[0]+cy*p[2],y=cx*p[1]-sx*z;z=sx*p[1]+cx*z;const persp=2.8/(3.2-z*.65);return {x:(.5+(x*persp*.92*zoom/(w/h))*.5)*w,y:(.5-(y*persp*.92*zoom)*.5)*h,z};}
  function draw2d(t){
    ctx2d.clearRect(0,0,w,h);
    const projected=particles.map(n=>({...project(n.p),kind:n.kind,seed:n.seed,storyIndex:n.storyIndex||0})).sort((a,b)=>a.z-b.z);
    ctx2d.lineWidth=.6;
    for(let k=0;k<network.length;k+=6){
      const a=project(network.slice(k,k+3)),b=project(network.slice(k+3,k+6));
      ctx2d.strokeStyle='rgba(172,142,180,'+Math.max(.015,.03+Math.min(a.z,b.z)*.014)+')';
      ctx2d.beginPath();ctx2d.moveTo(a.x,a.y);ctx2d.lineTo(b.x,b.y);ctx2d.stroke();
    }
    for(const n of projected){
      const active=n.storyIndex===selected+1;
      const front=clamp(.53+n.z*.45,.07,1);
      const size=(1.15+n.kind*1.3)*(.75+n.z*.2);
      const radius=Math.max(.5,size+(active?2:0));
      if(active){
        ctx2d.beginPath();ctx2d.arc(n.x,n.y,17,0,Math.PI*2);
        const halo=ctx2d.createRadialGradient(n.x,n.y,1,n.x,n.y,17);
        halo.addColorStop(0,'rgba(242,216,165,.72)');
        halo.addColorStop(.26,'rgba(220,180,114,.30)');
        halo.addColorStop(1,'rgba(220,180,114,0)');
        ctx2d.fillStyle=halo;ctx2d.fill();
      }
      ctx2d.beginPath();ctx2d.arc(n.x,n.y,radius,0,Math.PI*2);
      ctx2d.fillStyle=active?'rgba(255,237,198,.98)':n.storyIndex>0?
        'rgba(229,196,145,'+front+')':n.seed>.85?
        'rgba(223,185,150,'+front*.58+')':
        'rgba(164,139,190,'+front*.50+')';
      ctx2d.fill();
    }
  }
  function renderPin(){
    const s=stories[selected];if(!s)return;
    const p=project(s.p), visible=p.z>-.10&&p.x>10&&p.x<w-10&&p.y>10&&p.y<h-10;
    pin.style.left=p.x+'px';pin.style.top=p.y+'px';
    pin.style.opacity=visible?'1':'0';
    pin.style.pointerEvents=visible?'auto':'none';
    const legend=els('focusLegend');
    legend.style.left=clamp(p.x+24,12,Math.max(12,w-202))+'px';
    legend.style.top=clamp(p.y-77,14,Math.max(14,h-106))+'px';
    legend.style.opacity=visible?'1':'0';
  }
  let globeVisible=true;
  function frameLoop(t){
    const dt=clamp((t-lastTs)||16,0,50);lastTs=t;
    if(document.hidden||!globeVisible){requestAnimationFrame(frameLoop);return;}
    if(cameraTarget&&!dragging){
      const mix=reduceMotion?1:Math.min(.22,dt*.012);
      rotY+=(cameraTarget.y-rotY)*mix;rotX+=(cameraTarget.x-rotX)*mix;
      if(Math.abs(rotY-cameraTarget.y)+Math.abs(rotX-cameraTarget.x)<.003){
        rotY=cameraTarget.y;rotX=cameraTarget.x;cameraTarget=null;
      }
    }else if(spinning&&!dragging)rotY+=dt*.00007;
    try{if(gl)drawWebGL(t);else draw2d(t);}catch(e){console.warn('WebGL rendering failed. Switching to Canvas 2D.',e);initFallback();resize();}
    if(frame++%2===0)renderPin();requestAnimationFrame(frameLoop);
  }
  function syncStory(){
    const s=stories[selected];
    els('floatId').textContent=(s.local?'LOCAL DEMO / #':'FICTIONAL EXAMPLE / #')+String(s.id).padStart(6,'0');
    els('floatQuote').textContent='«'+s.quote.replace(/[«»]/g,'')+'»';
    els('floatAuthor').textContent='@'+s.alias+' · '+s.market;
    const page=String(selected+1).padStart(2,'0')+' / '+String(stories.length).padStart(2,'0');
    els('starPosition').textContent=page;
    els('detailPosition').textContent=page;
    pin.setAttribute('aria-label','Открыть историю '+(selected+1)+' из '+stories.length+': '+s.alias);
    els('focusLegendName').textContent='@'+s.alias.toUpperCase();
    els('focusLegendCategory').textContent=s.category.toUpperCase()+' · '+(s.local?'LOCAL DEMO':'FICTIONAL');
    renderPin();
  }
  function syncSpinControl(){
    const b=els('toggleSpin');
    b.textContent=spinning?'Ⅱ':'▶';
    b.setAttribute('aria-pressed',String(spinning));
    b.title=spinning?'Остановить вращение':'Возобновить вращение';
    b.setAttribute('aria-label',b.title);
  }
  function pointCameraAtSelection(){
    const p=stories[selected].p;
    const frontAngle=Math.atan2(-p[0],p[2]);
    const delta=Math.atan2(Math.sin(frontAngle-rotY),Math.cos(frontAngle-rotY));
    cameraTarget={
      y:rotY+delta,
      x:clamp(Math.atan2(p[1],Math.hypot(p[0],p[2])),-1.36,1.36)
    };
    spinning=false;syncSpinControl();
    if(reduceMotion){rotY=cameraTarget.y;rotX=cameraTarget.x;cameraTarget=null;renderPin();}
  }
  function selectStory(i,open=false){selected=(i+stories.length)%stories.length;pointCameraAtSelection();syncStory();if(open)openStory();}
  function openStory(){const s=stories[selected];els('detailTitle').textContent=(s.local?'Локальная демо-история #':'Вымышленная история #')+String(s.id).padStart(6,'0');els('detailMeta').replaceChildren();[s.alias,s.market,s.category,s.local?'Локальная запись':'Пример'].forEach(t=>{let span=document.createElement('span');span.textContent=t;els('detailMeta').appendChild(span);});els('detailQuote').textContent='«'+s.quote.replace(/[«»]/g,'')+'»';els('detailLesson').textContent=(s.local&&s.rule?'Моё правило на 30 дней: '+s.rule+'\n\n':'')+s.lesson;if(!els('storyDialog').open)els('storyDialog').showModal();}
  function showToast(msg){const el=els('toast');el.textContent=msg;el.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('show'),4000);}
  function drawCards(){
    const cards=els('storyCards');cards.replaceChildren();
    const matching=stories.filter(s=>(currentFilter==='all'||s.category===currentFilter)&&(!searchTerm||[s.alias,s.market,s.category,s.quote,s.lesson].join(' ').toLocaleLowerCase().includes(searchTerm)));
    const items=matching.slice(0,visibleLimit);
    const more=els('loadMoreStories');more.hidden=matching.length<=visibleLimit;
    more.textContent='Показать ещё истории ('+(matching.length-items.length)+') ↓';
    els('searchCount').textContent=items.length===matching.length?
      matching.length+' '+(matching.length===1?'история':'историй')+' · демо / локально':
      items.length+' из '+matching.length+' историй · демо / локально';
    if(!items.length){const p=document.createElement('p');p.textContent='По выбранным параметрам историй не найдено. Попробуйте другой запрос.';p.className='stories-empty';cards.append(p);return;}
    items.forEach(s=>{const b=document.createElement('button');b.className='story-card';b.type='button';b.setAttribute('aria-label','Открыть историю '+s.alias+', '+s.category+(s.local?', локальная демо-история':', вымышленный пример'));const top=document.createElement('div');top.className='story-card-top';const index=document.createElement('span');index.textContent='#'+String(s.id).padStart(6,'0');const tag=document.createElement('span');tag.textContent=s.local?'LOCAL DEMO':'FICTIONAL EXAMPLE';top.append(index,tag);const glyph=document.createElement('span');glyph.className='story-card-glyph';glyph.textContent='✧';const q=document.createElement('blockquote');q.textContent='“'+s.quote.replace(/[«»]/g,'')+'”';const footer=document.createElement('div');footer.className='story-card-footer';const name=document.createElement('b');name.textContent='@'+s.alias;const category=document.createElement('span');category.textContent=s.category.toUpperCase()+' ↗';footer.append(name,category);b.append(top,glyph,q,footer);b.addEventListener('click',()=>{selectStory(stories.indexOf(s));openStory();});cards.appendChild(b);});
  }
  function addStory(data){const id=stories.reduce((m,s)=>Math.max(m,s.id),100000)+1;const a=rand()*Math.PI*2, z=.66+rand()*.26,r=Math.sqrt(1-z*z);const p=normalize([Math.cos(a)*r,Math.sin(a)*r,z]);const s={id,alias:String(data.get('alias')).trim().slice(0,32),market:String(data.get('market')),category:String(data.get('category')),quote:String(data.get('lesson')).trim().slice(0,260),rule:String(data.get('rule')||'').trim().slice(0,140),capsule:String(data.get('capsule')||'').trim().slice(0,360),createdAt:new Date().toISOString(),lesson:'Эту историю ты добавил в локальную демонстрацию. Она видна только в этом браузере и не передаётся на сервер.',p,local:true};stories.unshift(s);saved.push(s);try{localStorage.setItem(savedKey,JSON.stringify(saved.slice(-80)));}catch{showToast('Запись показана в демо, но браузер не разрешил сохранение.');}makeParticles();if(gl){try{initWebGL();}catch(err){console.warn('Rebuilding the constellation failed; using Canvas fallback.',err);initFallback();resize();}}selectStory(0);drawCards();window.dispatchEvent(new CustomEvent('market:story-added',{detail:{localId:s.id}}));els('joinDialog').close();els('storyForm').reset();showToast('Твоя звезда создана локально ✦ Открой её на сфере.');els('my-legacy').scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});}
  // UI and pointer controls
  [els('joinTop'),els('joinHero'),els('joinBottom')].forEach(b=>b.addEventListener('click',()=>els('joinDialog').showModal()));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>els(b.dataset.close).close()));
  [els('joinDialog'),els('storyDialog')].forEach(d=>d.addEventListener('click',(e)=>{if(e.target===d)d.close();}));
  els('storyForm').addEventListener('input',()=>{const f=els('storyForm');els('previewAlias').textContent='@'+(f.elements.alias.value.trim().slice(0,32)||'YOUR NAME').toUpperCase();els('previewLesson').textContent=f.elements.lesson.value.trim().slice(0,200)||'Твоя история появится здесь, пока ты пишешь…';});
  els('storyForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;addStory(new FormData(form));});
  els('detailNext').addEventListener('click',()=>{selectStory(selected+1);openStory();});
  els('detailPrev').addEventListener('click',()=>{selectStory(selected-1);openStory();});
  els('nextStar').addEventListener('click',()=>selectStory(selected+1));
  els('previousStar').addEventListener('click',()=>selectStory(selected-1));
  els('detailViewStar').addEventListener('click',()=>{
    els('storyDialog').close();pointCameraAtSelection();
    stage.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'});
  });
  els('storyDialog').addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.key==='ArrowRight'){e.preventDefault();selectStory(selected+1);openStory();}
    if(e.key==='ArrowLeft'){e.preventDefault();selectStory(selected-1);openStory();}
  });
  els('randomStory').addEventListener('click',()=>{selectStory(Math.floor(rand()*stories.length));openStory();});
  els('exploreButton').addEventListener('click',()=>{pointCameraAtSelection();stage.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'});});
  els('resetView').addEventListener('click',()=>{cameraTarget=null;rotX=-.14;rotY=.16;zoom=1;showToast('Ракурс восстановлен');});
  els('toggleSpin').addEventListener('click',()=>{cameraTarget=null;spinning=!spinning;syncSpinControl();});
  const openSelected=()=>openStory();pin.addEventListener('click',openSelected);els('storyFloat').addEventListener('click',openSelected);els('storyFloat').addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSelected();}});
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{visibleLimit=24;currentFilter=b.dataset.filter;document.querySelectorAll('.filter').forEach(el=>{el.classList.toggle('active',el===b);el.setAttribute('aria-pressed',String(el===b));});drawCards();}));
  els('storySearch').addEventListener('input',e=>{searchTerm=e.target.value.trim().toLocaleLowerCase().slice(0,80);visibleLimit=24;drawCards();});
  els('loadMoreStories').addEventListener('click',()=>{visibleLimit+=24;drawCards();});
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('button,[role="button"]'))return;cameraTarget=null;spinning=false;syncSpinControl();dragging=true;moved=0;sx=lastX=e.clientX;sy=lastY=e.clientY;stage.classList.add('dragging');stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);rotY+=dx*.006;rotX=clamp(rotX+dy*.006,-1.42,1.42);});
  stage.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;stage.classList.remove('dragging');if(moved<8){const r=stage.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=-1,dist=25;stories.forEach((s,i)=>{const p=project(s.p);if(p.z<-.17)return;const d=Math.hypot(p.x-x,p.y-y);if(d<dist){dist=d;best=i;}});if(best>=0){selectStory(best);openStory();}}});
  stage.addEventListener('pointercancel',()=>{dragging=false;stage.classList.remove('dragging');});
  stage.addEventListener('wheel',(e)=>{e.preventDefault();zoom=clamp(zoom-e.deltaY*.0008,.73,1.52);},{passive:false});
  stage.addEventListener('dblclick',()=>{zoom=1;rotX=-.14;rotY=.16;});
  makeParticles();try{initWebGL();}catch(err){console.warn('Using Canvas fallback:',err);initFallback();}
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();
    if(renderer==='webgl'){initFallback();resize();}
  });
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(stage);else window.addEventListener('resize',resize);
  if(typeof IntersectionObserver!=='undefined'){
    new IntersectionObserver(entries=>{globeVisible=!!entries[0]?.isIntersecting;},{rootMargin:'120px'}).observe(stage);
  }
  resize();syncSpinControl();syncStory();drawCards();requestAnimationFrame(frameLoop);
})();
