const {test,expect}=require('./browser-fixtures.cjs');

test('V17 has a visible selected event and no neverending orbit',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events#universe');
  await expect(page.locator('#mhPlanetSurface')).toBeVisible();
  await expect(page.locator('[data-mh-beacon="2008"]')).toHaveAttribute('aria-hidden','false',{timeout:5000});
  const selected=await page.evaluate(()=>({
    id:window.MarketHistoryModes?.activeEvent,
    point:window.MarketHistoryModes?.selectedPoint,
    material:window.MHCrimsonShaders?.fragment?.includes('uActivePos'),
    selectedPosition:window.MarketEventPlanet?.selectedPos
  }));
  expect(selected.id).toBe('2008');
  expect(selected.point).toHaveLength(2);
  expect(selected.selectedPosition).toHaveLength(3);
  expect(selected.material).toBe(true);
});

test('V17 selecting another year focuses sphere without forcing the research sheet',async({page})=>{
  await page.setViewportSize({width:390,height:560});
  await page.goto('/?mm=events');
  await expect(page.locator('#mhHistoryPanel')).not.toHaveClass(/is-expanded/);
  await expect(page.locator('#mhHistoryPanel > .mh-timeline')).toBeVisible();
  await page.locator('#mhHistoryPanel > .mh-timeline [data-mh-event="1987"]').click();
  await expect(page.locator('#mhHistoryPanel')).not.toHaveClass(/is-expanded/);
  await expect(page.locator('#mhHistoryPanel')).toContainText('Чёрный понедельник');
  await expect(page.locator('[data-mh-beacon="1987"]')).toHaveAttribute('aria-hidden','false',{timeout:6000});
  await page.locator('#mhHistoryPanel .mh-panel-grip').click();
  await expect(page.locator('#mhHistoryPanel')).toHaveClass(/is-expanded/);
  await expect(page.locator('#mhHistoryPanel .mh-v16-research-card')).toHaveCount(3);
  await expect(page.locator('#mhHistoryPanel .mh-v16-card-footer a')).toHaveAttribute('href',/^https:\/\//);
});

test('V17 compact dock stays clear of the sphere on short and tall phones',async({page})=>{
  for(const vp of [{width:390,height:560},{width:390,height:844},{width:428,height:926}]){
    await page.setViewportSize(vp);
    await page.goto('/?mm=events');
    await expect(page.locator('#mhHistoryPanel')).not.toHaveClass(/is-expanded/);
    const geom=await page.evaluate(()=>{
      const root=document.querySelector('#app');
      const stage=document.querySelector('#scene').getBoundingClientRect();
      const dock=document.querySelector('#mhHistoryPanel').getBoundingClientRect();
      return {
        planetBottom:parseFloat(root.style.getPropertyValue('--mh-core-y'))+
                     parseFloat(root.style.getPropertyValue('--mh-core-radius')),
        dockTop:dock.top-stage.top,scroll:document.documentElement.scrollWidth,viewport:window.innerWidth
      };
    });
    expect(geom.planetBottom).toBeLessThanOrEqual(geom.dockTop+2);
    expect(geom.scroll).toBeLessThanOrEqual(geom.viewport+1);
  }
});

test('V17 research is an intentional immersive view, with an explicit return',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events');
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await expect(page.locator('#app')).toHaveClass(/mh-v17-research-open/);
 await expect(page.locator('#mhHistoryPanel .mh-panel-body')).toBeVisible();
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await expect(page.locator('#app')).not.toHaveClass(/mh-v17-research-open/);
 await page.locator('#mhBackToPeople').click();
 await expect(page.locator('#mhPlanetSurface')).toBeHidden({timeout:5500});
 await expect(page.locator('#app')).not.toHaveClass(/mh-v17-research-open/);
 await expect(page.locator('#gl')).toBeVisible();
});

test('V17 Canvas2D fallback remains readable without WebGL',async({page})=>{
 await page.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){
     return /^webgl/.test(type)?null:original.call(this,type,...args);
   };
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events');
 await expect(page.locator('#mhPlanetFallback')).toBeVisible();
 const sample=await page.evaluate(()=>{
   const cv=document.getElementById('mhPlanetFallback'),ctx=cv.getContext('2d');
   const root=document.getElementById('app');
   const stage=document.getElementById('scene').getBoundingClientRect();
   const x=parseFloat(root.style.getPropertyValue('--mh-core-x'));
   const y=parseFloat(root.style.getPropertyValue('--mh-core-y'));
   const c=cv.getBoundingClientRect();
   return [...ctx.getImageData(Math.min(cv.width-1,Math.round(x*cv.width/c.width)),Math.min(cv.height-1,Math.round(y*cv.height/c.height)),1,1).data];
 });
 expect(sample[3]).toBeGreaterThan(130);
});

test('V17 real visual screenshot targets, including mobile research view',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const vp of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
   await page.setViewportSize(vp);
   await page.goto('/?mm=events');
   await expect(page.locator('#mhPlanetSurface')).toBeVisible();
   await page.screenshot({path:'test-results/v17-aether-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
   if(vp.width<820){
     await page.locator('#mhHistoryPanel .mh-panel-grip').click();
     await page.screenshot({path:'test-results/v17-research-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
   }
 }
});
