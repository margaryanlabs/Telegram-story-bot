/* One bounded Canvas2D background pass, driven by the ORIGINAL scene scheduler. */
window.MarketV10 = window.MarketV10 || {};
window.MarketV10.atmosphere = (() => {
  let context,canvas,width=0,height=0,points=[],last=-Infinity,draws=0;
  function init() {canvas=document.getElementById('memorySky');context=canvas?.getContext('2d',{alpha:true});}
  function draw(time, state) {
    if (!context) return;
    const {w,h,cameraX,cameraY,low,reduced} = state;
    const count = low ? 52 : w<820 ? 96 : 210;
    if(width!==w || height!==h || points.length!==count) {
      width=w;height=h;canvas.width=Math.round(w*.8);canvas.height=Math.round(h*.8);
      let seed=1052026;
      const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
      // RC4: gentle anisotropic distant dust lane, seeded and stable per size.
      // Most points remain scattered; only one in six follows a faint
      // diagonal corridor, so the scene never resembles a painted galaxy.
      points=Array.from({length:count},(_,i)=>{
        const x=rand(),uniformY=rand(),layer=i%3,drift=rand();
        const inLane=i%6===0&&!low;
        const bandY=.75-x*.46+(uniformY-.5)*.34;
        return {
          x,y:inLane?Math.max(.025,Math.min(.975,bandY)):uniformY,
          layer,r:.45+rand()*.8,phase:rand()*6.28,
          tint:i%13===0?'warm':'ice',halo:i%19===0&&layer===2&&!low,
          drift
        };
      });
      last=-Infinity;
    }
    // 15Hz on mobile/ECO, 24Hz desktop. No extra RAF, timer or DOM layout reads.
    if(time-last < (low||w<820 ? 66 : 42))return;
    last=time;draws++;
    context.setTransform(.8,0,0,.8,0,0);context.clearRect(0,0,w,h);
    // A bounded, camera-responsive distant haze behind the actual 3D globe.
    // 2 gradients max, drawn in the existing 15/24 Hz background pass.
    // No new canvas, extra RAF loop, GPU material, or interactive hit layer.
    const breath=reduced?1:.91+.09*Math.sin(time*.00023);
    const cx=w*.70+cameraY*4,cy=h*.49+cameraX*3;
    const radius=Math.max(w,h)*.66;
    const nebula=context.createRadialGradient(cx,cy,radius*.04,cx,cy,radius);
    nebula.addColorStop(0,'rgba(66,129,150,'+(.123*breath).toFixed(4)+')');
    nebula.addColorStop(.42,'rgba(39,93,115,'+(.080*breath).toFixed(4)+')');
    nebula.addColorStop(1,'rgba(10,24,38,0)');
    context.fillStyle=nebula;context.fillRect(0,0,w,h);
    if(!low){
      const glow=context.createRadialGradient(w*.15,h*.78,0,w*.15,h*.78,Math.max(w,h)*.47);
      glow.addColorStop(0,'rgba(153,116,167,.064)');
      glow.addColorStop(.58,'rgba(103,115,146,.028)');
      glow.addColorStop(1,'rgba(22,37,52,0)');
      context.fillStyle=glow;context.fillRect(0,0,w,h);
    }
    for(const p of points) {
      const depth=(p.layer+1)*.32;
      const x=((p.x*w+cameraY*depth*13)%w+w)%w;
      const y=((p.y*h+cameraX*depth*11)%h+h)%h;
      const flicker=reduced?1:.89+.11*Math.sin(time*.0004+p.phase);
      const alpha=(.19+depth*.3)*flicker;
      // A few soft halos make distant signals less uniform, never interactive.
      if(p.halo){
        context.fillStyle='rgba(144,204,223,'+Math.min(.15,alpha*.22).toFixed(4)+')';
        context.beginPath();context.arc(x,y,Math.max(1.1,p.r*depth*3.4),0,Math.PI*2);context.fill();
      }
      context.fillStyle=p.tint==='warm'?'rgba(200,169,144,'+alpha+')':'rgba(169,216,230,'+alpha+')';
      context.beginPath();context.arc(x,y,p.r*depth,0,Math.PI*2);context.fill();
    }
  }
  return {init,draw,stats:()=>({points:points.length,draws,width,height})};
})();
