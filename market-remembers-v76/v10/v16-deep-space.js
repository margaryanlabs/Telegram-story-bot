/* MARKET REMEMBERS / V16 Cosmic Canvas
 * Deterministic one-time 2D deep-space composition, never a realtime GPU loop.
 * Adds depth behind the existing globe without affecting PEOPLE or touching data.
 */
(() => {
  'use strict';
  const cosmos=document.getElementById('mhCrimsonCosmos');
  const scene=document.getElementById('scene');
  if(!cosmos||!scene||document.getElementById('mhDeepSpace'))return;
  const sky=document.createElement('canvas');
  sky.id='mhDeepSpace';sky.className='mh-deep-space';
  sky.setAttribute('aria-hidden','true');
  cosmos.prepend(sky);
  const ctx=sky.getContext('2d',{alpha:true});
  if(!ctx)return;
  let lastW=0,lastH=0;
  const seed=0x16ca3f;
  function prng(){let state=seed;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};}
  const stars=(()=>{const rnd=prng();return Array.from({length:112},(_,i)=>({
    x:rnd(),y:rnd(),r:.28+rnd()*.97,alpha:.16+rnd()*.56,
    hue:i%9===0?'222,191,210':i%5===0?'162,191,228':'213,221,241',
    foreground:i%7===0
  }));})();
  function arc(x1,y1,x2,y2,offset,opacity,width){
    ctx.save();
    ctx.strokeStyle='rgba(165,181,215,'+opacity+')';ctx.lineWidth=width;
    ctx.beginPath();ctx.moveTo(x1,y1);
    ctx.bezierCurveTo(x1+offset,y1-offset*.58,x2-offset*.76,y2-offset*.24,x2,y2);
    ctx.stroke();ctx.restore();
  }
  function draw(){
    const rect=scene.getBoundingClientRect();
    const w=Math.round(rect.width),h=Math.round(rect.height);
    if(w<10||h<10)return;
    if(w===lastW&&h===lastH)return;lastW=w;lastH=h;
    const dpr=Math.min(window.devicePixelRatio||1,1.35);
    sky.width=Math.max(1,Math.round(w*dpr));
    sky.height=Math.max(1,Math.round(h*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    // A broad cool elliptical cloud behind the planet, not a space wallpaper.
    const mx=w*(w<820?.52:.575),my=h*(w<820?.44:.51);
    const haze=ctx.createRadialGradient(mx,my,10,mx,my,Math.max(175,Math.min(w,h)*.57));
    haze.addColorStop(0,'rgba(115,122,181,.055)');
    haze.addColorStop(.52,'rgba(81,76,131,.075)');
    haze.addColorStop(.79,'rgba(77,43,109,.035)');
    haze.addColorStop(1,'rgba(30,31,70,0)');
    ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    // Fine nebula ribbons: controlled strokes never pass over the research text.
    ctx.save();
    ctx.filter='blur(18px)';
    for(let i=0;i<3;i++){
      ctx.beginPath();
      ctx.moveTo(w*(-.13+i*.04),h*(.72+i*.055));
      ctx.bezierCurveTo(w*.19,h*(.64-i*.07),w*.72,h*(.24+i*.10),w*1.17,h*(.17+i*.16));
      ctx.strokeStyle=i===1?'rgba(146,91,149,.045)':'rgba(113,143,190,.047)';
      ctx.lineWidth=16+i*7;ctx.stroke();
    }
    ctx.restore();
    // Few architectural orbital traces at very low contrast (not red snakes).
    const scale=Math.min(w,h);
    arc(w*.09,h*.84,w*.92,h*.23,scale*.19,.060,.65);
    arc(w*.18,h*.18,w*.95,h*.70,-scale*.13,.040,.55);
    const mobile=w<820;
    stars.forEach(s=>{
      const x=s.x*w,y=s.y*h;
      // Do not crowd the central planet with stars.
      const dist=Math.hypot((x-mx)/(Math.min(w,h)*.43),(y-my)/(Math.min(w,h)*.43));
      const damp=dist<.85?.29:1;
      ctx.fillStyle='rgba('+s.hue+','+(s.alpha*damp).toFixed(3)+')';
      ctx.beginPath();ctx.arc(x,y,s.r*(mobile?.83:1),0,Math.PI*2);ctx.fill();
      if(s.foreground&&!mobile&&damp>.4){
        const glow=ctx.createRadialGradient(x,y,0,x,y,s.r*6);
        glow.addColorStop(0,'rgba(206,212,239,.14)');glow.addColorStop(1,'rgba(206,212,239,0)');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,s.r*6,0,Math.PI*2);ctx.fill();
      }
    });
  }
  draw();
  let observer;
  if(typeof ResizeObserver==='function'){
    observer=new ResizeObserver(draw);observer.observe(scene);
  }else{
    window.addEventListener('resize',draw,{passive:true});
  }
  window.MarketDeepSpace=Object.freeze({redraw:()=>{lastW=0;draw();},get stars(){return stars.length;},get staticComposition(){return true;}});
})();
