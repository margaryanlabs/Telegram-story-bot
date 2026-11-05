const {test,expect}=require('./browser-fixtures.cjs');

test('V18 EVENT CORE uses actual PEOPLE 3D mesh and shaders with different color + dates',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?mm=events#universe');
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 const result=await page.evaluate(()=>({
   mirror:window.MarketEventPlanet?.copiedPeopleRenderer,
   renderer:window.MarketEventPlanet?.renderer,
   volume:window.MHPeopleMirrorShaders?.coreFragment.includes('accumulatedNebula'),
   glslStars:window.MHPeopleMirrorShaders?.pVertex.includes('gl_PointSize'),
   years:window.MarketHistoryModes?.events.map(e=>e.year),
   positions:window.MarketHistoryModes?.events.map(e=>e.p)
 }));
 expect(result.mirror).toBe(true);
 expect(['webgl1','canvas2d']).toContain(result.renderer);
 expect(result.volume).toBe(true);
 expect(result.glslStars).toBe(true);
 expect(result.years).toEqual(['1907','1929','1987','1998','2008','2010','2020','2023']);
 result.positions.forEach(p=>expect(p).toHaveLength(2));
 await expect(page.locator('#mhV16Optics')).toBeHidden();
 await expect(page.locator('#gl')).toBeHidden();
 expect(errors).toEqual([]);
});

test('V18 selecting dates changes focus while preserving PEOPLE and sourced financial cards',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events');
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await page.locator('#mhHistoryPanel [data-mh-event="1987"]').first().click();
 await expect(page.locator('#mhHistoryPanel')).toContainText('Чёрный понедельник');
 await expect(page.locator('#mhHistoryPanel .mh-v16-research-card')).toHaveCount(5);
 const selected=await page.evaluate(()=>window.MarketHistoryModes.activeEvent);
 expect(selected).toBe('1987');
 await page.locator('#mhBackToPeople').click();
 await expect(page.locator('#mhPlanetSurface')).toBeHidden({timeout:6000});
 await expect(page.locator('#gl')).toBeVisible();
 await expect(page.locator('#selectedCard')).toBeVisible();
});

test('V18 uses Canvas2D fallback without WebGL and keeps years navigable',async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
    return /^webgl/.test(type)?null:original.call(this,type,...args);
  };
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events');
 await expect(page.locator('#mhPlanetFallback')).toBeVisible();
 expect(await page.evaluate(()=>window.MarketEventPlanet.renderer)).toBe('canvas2d');
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await page.locator('#mhHistoryPanel [data-mh-event="2020"]').first().click();
 await expect(page.locator('#mhHistoryPanel')).toContainText('Пандемический шок ликвидности');
});

test('V18 side-by-side visual comparison targets on phone and desktop',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const v of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
  await page.setViewportSize(v);
  await page.goto('/?mm=people#universe');
  await page.screenshot({path:'test-results/v18-people-original-'+v.width+'x'+v.height+'.png',animations:'disabled'});
  await page.goto('/?mm=events#universe');
  await expect(page.locator('#mhPlanetSurface')).toBeVisible();
  await page.screenshot({path:'test-results/v18-people-mirror-dates-'+v.width+'x'+v.height+'.png',animations:'disabled'});
 }
});
