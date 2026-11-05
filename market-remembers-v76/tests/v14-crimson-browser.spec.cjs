const {test,expect}=require('./browser-fixtures.cjs');

test('V14 Event Core is a second rendered planet, not the People universe',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events#universe');
 await expect(page.locator('#mhEventHeader')).toBeVisible();
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 await expect(page.locator('#mhHistoryPanel')).toBeVisible();
 await expect(page.locator('#mhModeSwitch [data-mh-mode="events"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#gl')).toBeHidden();
 await expect(page.locator('#mhPlanetSurface canvas:visible')).toHaveCount(1);
 const state=await page.evaluate(()=>({renderer:window.MarketEventPlanet?.renderer,mode:window.MarketHistoryModes?.mode,events:window.MarketHistoryModes?.events?.length}));
 expect(['webgl1','canvas2d']).toContain(state.renderer);
 expect(state.mode).toBe('events');
 expect(state.events).toBe(4);
});

test('V14 inner tabs change finance research without leaving the crimson world',async({page})=>{
 await page.goto('/?mm=events');
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await page.locator('#mhHistoryPanel [data-mh-mode="connections"]').click();
 await expect(page.locator('#mhHistoryPanel [data-mh-mode="connections"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 expect(await page.evaluate(()=>window.MarketHistoryModes.mode)).toBe('connections');
 await expect(page.locator('#mhHistoryPanel .mh-theme-list button').first()).toBeVisible();
 await page.locator('#mhHistoryPanel [data-mh-event="1987"]').first().click();
 expect(await page.evaluate(()=>window.MarketHistoryModes.activeEvent)).toBe('1987');
 await expect(page.locator('#mhHistoryPanel')).toContainText('Чёрный понедельник');
});

test('V14 returns to untouched People sphere and original navigation',async({page})=>{
 await page.goto('/?mm=events');
 await page.locator('#mhBackToPeople').click();
 await expect(page.locator('#mhPlanetSurface')).toBeHidden();
 await expect(page.locator('#mhEventHeader')).toBeHidden();
 await expect(page.locator('#gl')).toBeVisible();
 await expect(page.locator('#selectedCard')).toBeVisible();
 expect(await page.evaluate(()=>window.MarketHistoryModes.mode)).toBe('people');
 await page.locator('#mhModeSwitch [data-mh-mode="events"]').click();
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
});

test('V14 Canvas2D fallback renders and remains interactive when WebGL is absent',async({page})=>{
 await page.addInitScript(()=>{
   const prev=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){
     return /^webgl/.test(type)?null:prev.call(this,type,...args);
   };
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events');
 await expect(page.locator('#mhPlanetFallback')).toBeVisible();
 expect(await page.evaluate(()=>window.MarketEventPlanet.renderer)).toBe('canvas2d');
 const p=await page.evaluate(()=>{
   const c=document.getElementById('mhPlanetFallback'),ctx=c.getContext('2d');
   const midX=Math.floor(c.width*.515),midY=Math.floor(c.height*.425);
   return [...ctx.getImageData(midX,midY,1,1).data];
 });
 expect(p[3]).toBeGreaterThan(100);
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await page.locator('#mhHistoryPanel [data-mh-event="1907"]').first().click();
 await expect(page.locator('#mhHistoryPanel')).toContainText('Паника 1907 года');
});

test('V14 screenshots of both worlds on mobile and desktop',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
   await page.setViewportSize(viewport);
   for(const mode of ['people','events','connections']){
     await page.goto('/?mm='+mode);
     await expect(page.locator('#mhModeSwitch')).toBeVisible();
     if(mode!=='people')await expect(page.locator('#mhPlanetSurface')).toBeVisible();
     await page.screenshot({path:'test-results/v14-'+mode+'-'+viewport.width+'x'+viewport.height+'.png',animations:'disabled'});
   }
 }
});