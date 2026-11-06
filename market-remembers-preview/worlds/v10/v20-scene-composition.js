/* MARKET REMEMBERS V20.7 / EVENT SCENE COMPOSITION
 * Pure viewport composition for the mirrored EVENT globe, NOT the PEOPLE globe.
 * Computes camera framing from real projected UI bounds; document changes
 * should not whip the planet around in the visitor's viewport.
 */
(() => {
  'use strict';
  if (window.MarketSceneCompositionV20) return;

  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  function clean(rect) {
    if(!rect || ![rect.left,rect.top,rect.right,rect.bottom].every(finite) ||
       rect.bottom<=rect.top || rect.right<=rect.left)return null;
    return rect;
  }
  const number=(v,fallback)=>finite(v)?v:fallback;

  function compose({width,height,chronosphere=null,panel=null,header=null,orientation='auto'}={}) {
    if(!finite(width)||!finite(height)||width<=0||height<=0)
      return {x:0,y:0,r:0,strategy:'invalid'};

    const w=width,h=height;
    const nav=clean(chronosphere),doc=clean(panel),topbar=clean(header);
    const headerBottom=topbar?topbar.bottom: (w<820?62:77);
    const landscape=(orientation==='landscape' || (orientation==='auto'&&w>h&&h<=650));
    const shortEdge=Math.min(w,h);
    const minRadius=Math.min(66,shortEdge*.18);
    let x,y,r,strategy;

    if (w<820 && !landscape) {
      strategy='portrait';
      // Do NOT use the research/full sheet's live top edge; that causes an
      // involuntary camera jump as the reader is expanded or collapsed.
      const upper=clamp(Math.max(100,headerBottom+58,(nav?.bottom||0)+14),90,h*.72);
      const compactDockTop=h-clamp(h*.25,140,235);
      const lower=Math.max(upper+36,compactDockTop-13);
      const clear=Math.max(36,lower-upper);
      x=w*.52;
      r=clamp(Math.min(w*.445,clear*.45,h*.31),minRadius,w*.46);
      y=(upper+lower)*.5;
    } else if (w<820 && landscape) {
      strategy='landscape';
      // Compact landscape keeps the sphere between the left chronology and
      // the right evidence column where space allows.
      const left=Math.max(12,(nav?.right||0)+12);
      const right=(doc?.left||w*.77)-12;
      const usable=right-left;
      if(usable>=160) {
        x=(left+right)*.5;
        r=Math.min(shortEdge*.33,(usable-12)*.47);
      } else {
        x=w*.49;
        r=Math.min(shortEdge*.32,w*.235);
      }
      y=clamp(h*.54,Math.min(h*.37,h-30),Math.max(h*.62,30));
    } else if (w<1200) {
      strategy='tablet';
      const left=20, right=Math.max(left+170,(doc?.left||w*.64)-15);
      const upper=Math.max(headerBottom+18,(nav?.bottom||headerBottom+70)+13);
      const lower=h-24;
      const span=Math.max(100,right-left);
      x=(left+right)*.5;
      y=(upper+lower)*.5;
      r=Math.min(span*.47,Math.max(74,(lower-upper)*.47),h*.37);
    } else {
      strategy='desktop';
      const left=Math.max(25,(nav?.right||w*.24)+18);
      const right=Math.min(w-30,(doc?.left||w*.74)-17);
      const span=Math.max(100,right-left);
      x=(left+right)*.5;
      y=clamp(h*.51,Math.min(h*.38,300),Math.max(h*.64,360));
      r=Math.min(span*.47,h*.405,w*.31);
    }
    r=clamp(number(r,minRadius),minRadius,shortEdge*.47);
    x=clamp(number(x,w*.52),r+6,Math.max(r+6,w-r-6));
    y=clamp(number(y,h*.52),r+6,Math.max(r+6,h-r-6));
    return {x,y,r,strategy};
  }
  window.MarketSceneCompositionV20=Object.freeze({compose});
})();