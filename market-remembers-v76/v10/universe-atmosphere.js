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
      points=Array.from({length:count},(_,i)=>({x:rand(),y:rand(),layer:i%3,r:.45+rand()*.8,phase:rand()*6.28}));
      last=-Infinity;
    }
    // 15Hz on mobile/ECO, 24Hz desktop. No extra RAF, timer or DOM layout reads.
    if(time-last < (low||w<820 ? 66 : 42))return;
    last=time;draws++;
    context.setTransform(.8,0,0,.8,0,0);context.clearRect(0,0,w,h);
    for(const p of points) {
      const depth=(p.layer+1)*.32;
      const x=((p.x*w+cameraY*depth*13)%w+w)%w;
      const y=((p.y*h+cameraX*depth*11)%h+h)%h;
      const flicker=reduced?1:.89+.11*Math.sin(time*.0004+p.phase);
      const alpha=(.19+depth*.3)*flicker;
      context.fillStyle=p.layer===2?'rgba(200,169,144,'+alpha+')':'rgba(169,216,230,'+alpha+')';
      context.beginPath();context.arc(x,y,p.r*depth,0,Math.PI*2);context.fill();
    }
  }
  return {init,draw,stats:()=>({points:points.length,draws,width,height})};
})();
