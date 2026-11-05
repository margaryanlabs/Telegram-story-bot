const {test,expect}=require('./browser-fixtures.cjs');

test('V15 mobile EVENT CORE opens with planet unobstructed and a compact information dock',async({page})=>{
 await page.setViewportSize({width:390,height:560});
 await page.goto('/?mm=events#universe');
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 await expect(page.locator('#mhHistoryPanel')).toBeVisible();
 await expect(page.locator('#mhHistoryPanel')).not.toHaveClass(/is-expanded/);
 await expect(page.locator('#mhHistoryPanel .mh-panel-grip')).toBeVisible();
 await expect(page.locator('#mhHistoryPanel .mh-panel-body')).toBeHidden();
 await expect(page.locator('#mhIntro')).toBeHidden();
 const geom=await page.evaluate(()=>{
   const root=document.querySelector('#app'),panel=document.querySelector('#mhHistoryPanel'),
     stage=document.querySelector('#scene').getBoundingClientRect();
   const y=parseFloat(root.style.getPropertyValue('--mh-core-y'));
   const r=parseFloat(root.style.getPropertyValue('--mh-core-radius'));
   return {planetBottom:y+r,panelTop:panel.getBoundingClientRect().top-stage.top,scrollWidth:document.documentElement.scrollWidth,screenWidth:innerWidth};
 });
 expect(geom.planetBottom).toBeLessThanOrEqual(geom.panelTop+22);
 expect(geom.scrollWidth).toBeLessThanOrEqual(geom.screenWidth+1);
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await expect(page.locator('#mhHistoryPanel')).toHaveClass(/is-expanded/);
 await expect(page.locator('#mhHistoryPanel .mh-panel-body')).toBeVisible();
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await expect(page.locator('#mhHistoryPanel .mh-panel-body')).toBeHidden();
});

test('V15 events and connections keep separate planet and allow event selection on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=connections');
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await page.locator('#mhHistoryPanel [data-mh-event="1987"]').first().click();
 await expect(page.locator('#mhHistoryPanel')).toContainText('Чёрный понедельник');
 await page.locator('#mhHistoryPanel [data-mh-mode="events"]').click();
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 await page.locator('#mhBackToPeople').click();
 await expect(page.locator('#gl')).toBeVisible();
 await expect(page.locator('#mhPlanetSurface')).toBeHidden();
});

test('V15 mobile screenshot review targets',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const viewport of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
   await page.setViewportSize(viewport);
   await page.goto('/?mm=events');
   await page.screenshot({path:'test-results/v15-obsidian-'+viewport.width+'x'+viewport.height+'.png',animations:'disabled'});
 }
});
