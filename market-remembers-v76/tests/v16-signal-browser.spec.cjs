const {test,expect}=require('./browser-fixtures.cjs');

test('V16 world passage is cinematic, changes whole scene and returns intact People universe',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=people#universe');
 await expect(page.locator('#gl')).toBeVisible();
 await page.locator('#mhModeSwitch [data-mh-mode="events"]').click();
 await expect(page.locator('#mhV16Portal')).toBeVisible();
 await expect(page.locator('#mhPlanetSurface')).toBeVisible({timeout:5000});
 await expect(page.locator('#mhV16Portal')).toBeHidden({timeout:6000});
 await expect(page.locator('#mhV16HUD')).toBeVisible();
 await expect(page.locator('#mhV16Optics')).toBeVisible();
 await expect(page.locator('#gl')).toBeHidden();
 await page.locator('#mhBackToPeople').click();
 await expect(page.locator('#mhV16Portal')).toBeVisible();
 await expect(page.locator('#mhV16Portal')).toBeHidden({timeout:6000});
 await expect(page.locator('#gl')).toBeVisible();
 await expect(page.locator('#selectedCard')).toBeVisible();
});

test('V16 signal nodes are touch-sized and attached to Event Core sphere',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?mm=events#universe');
 const node=page.locator('.mh-beacon[aria-hidden="false"]').first();
 await expect(node).toBeVisible();
 const box=await node.boundingBox();
 expect(box.width).toBeGreaterThanOrEqual(40);
 expect(box.height).toBeGreaterThanOrEqual(40);
 await node.click();
 await expect(page.locator('#mhHistoryPanel')).toHaveClass(/is-expanded/);
 await expect(page.locator('#mhHistoryPanel .mh-v16-research-card')).toHaveCount(3);
 const shader=await page.evaluate(()=>window.MHCrimsonShaders?.fragment||'');
 expect(shader).toContain('vec3 obsidian');
});

test('V16 event dossier has separate sourced blocks and connections',async({page})=>{
 await page.goto('/?mm=events');
 await page.locator('#mhHistoryPanel .mh-panel-grip').click();
 await expect(page.locator('#mhHistoryPanel')).toContainText('МЕХАНИЗМ ШОКА');
 await expect(page.locator('#mhHistoryPanel')).toContainText('УРОК ДЛЯ ТРЕЙДЕРА');
 await expect(page.locator('#mhHistoryPanel .mh-v16-steps li')).toHaveCount(3);
 await expect(page.locator('#mhHistoryPanel .mh-v16-card-footer a')).toHaveAttribute('href',/^https:\/\//);
 await page.locator('#mhHistoryPanel [data-mh-go-connections]').click();
 await expect(page.locator('#mhHistoryPanel .mh-v16-related-card').first()).toBeVisible();
});

test('V16 reduced-motion bypasses animated portal and still supports research',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?mm=people');
 await page.locator('#mhModeSwitch [data-mh-mode="events"]').click();
 await expect(page.locator('#mhPlanetSurface')).toBeVisible();
 await expect(page.locator('#mhV16Portal')).toBeHidden();
 await expect(page.locator('#mhPlanetFallback, #mhPlanetCanvas').filter({visible:true})).toHaveCount(1);
});

test('V16 screenshots: People, Event Core, dossier, Connections in portrait and desktop',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const viewport of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
  await page.setViewportSize(viewport);
  await page.goto('/?mm=events');
  await expect(page.locator('#mhPlanetSurface')).toBeVisible();
  await page.screenshot({path:'test-results/v16-event-'+viewport.width+'x'+viewport.height+'.png',animations:'disabled'});
  await page.locator('#mhHistoryPanel .mh-panel-grip').click();
  await page.screenshot({path:'test-results/v16-dossier-'+viewport.width+'x'+viewport.height+'.png',animations:'disabled'});
  await page.goto('/?mm=connections');
  await page.screenshot({path:'test-results/v16-connections-'+viewport.width+'x'+viewport.height+'.png',animations:'disabled'});
 }
});
