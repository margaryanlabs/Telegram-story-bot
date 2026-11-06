/* Market Remembers V20.6 — deterministic beacon label decluttering.
 * Source event coordinates remain symbolic, unchanged. This places labels
 * around actual projected globe stars while avoiding the real nav/document.
 * It never moves, hides or modifies an on-hemisphere event beacon itself. */
(() => {
  'use strict';
  if (window.MarketBeaconLayoutV20) return;

  const finite=value => typeof value==='number' && Number.isFinite(value);
  const intersects=(a,b,gap=0)=>
    a.left < b.right+gap && a.right+gap > b.left &&
    a.top < b.bottom+gap && a.bottom+gap > b.top;

  function bounds(item,side,placement,mobile) {
    const width=item.active?(mobile?134:184):(mobile?57:68);
    const height=item.active?(mobile?55:55):(mobile?28:30);
    const left=side==='right'?item.x+11:item.x-10-width;
    const top=placement==='above'?item.y-height-26
      :placement==='below'?item.y+26:item.y-12;
    return {left,top,right:left+width,bottom:top+height};
  }

  function arrange(items,{width,height,obstacles=[],mobile=false}={}) {
    const result=Object.create(null);
    if(!finite(width)||!finite(height)||width<=0||height<=0)return result;
    const protectedZones=obstacles.filter(rect=>
      rect&&[rect.left,rect.top,rect.right,rect.bottom].every(finite) &&
      rect.right>rect.left && rect.bottom>rect.top
    );
    const occupied=[];
    // Active star gets the first available document-safe label; later stars
    // can lose just the written tag, not their semantic button / glowing dot.
    const ordered=items.filter(Boolean).slice().sort((a,b)=>
      Number(!!b.active)-Number(!!a.active) ||
      String(a.id).localeCompare(String(b.id))
    );
    for(const item of ordered) {
      const blank={side:'right',placement:'center',hidden:true};
      if(!finite(item.x)||!finite(item.y)||item.visible===false){
        result[item.id]=blank;
        continue;
      }
      const favorite=item.x>width*.57?'left':'right';
      const sides=[favorite,favorite==='right'?'left':'right'];
      const positions=['center','above','below'];
      let accepted=null;
      for(const placement of positions) {
        for(const side of sides) {
          const rect=bounds(item,side,placement,mobile);
          if(rect.left<8 || rect.right>width-8 ||
             rect.top<(mobile?70:79) || rect.bottom>height-8)continue;
          if(protectedZones.some(zone=>intersects(rect,zone,7)))continue;
          if(occupied.some(zone=>intersects(rect,zone,6)))continue;
          accepted={side,placement,hidden:false,rect};
          break;
        }
        if(accepted)break;
      }
      if(accepted){
        occupied.push(accepted.rect);
        result[item.id]={side:accepted.side,placement:accepted.placement,hidden:false};
      } else result[item.id]=blank;
    }
    return result;
  }

  window.MarketBeaconLayoutV20=Object.freeze({arrange});
})();