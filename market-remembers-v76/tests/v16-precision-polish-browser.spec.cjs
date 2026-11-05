const {test, expect}=require('./browser-fixtures.cjs');

test('V16 precision polish keeps the two worlds isolated', async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=people#universe');
  await expect(page.locator('#gl')).toBeVisible();
  await expect(page.locator('#mhPlanetSurface')).toBeHidden();
  await page.locator('#mhModeSwitch [data-mh-mode="events"]').click();
  await expect(page.locator('#mhPlanetSurface')).toBeVisible({timeout:6000});
  await expect(page.locator('#mhV16Portal')).toBeHidden({timeout:6000});
  const style=await page.evaluate(()=>{
    const stage=document.querySelector('#mhCrimsonCosmos');
    return {background:getComputedStyle(stage).backgroundImage,shader:window.MHCrimsonShaders?.fragment,
      renderer:window.MarketEventPlanet?.renderer};
  });
  expect(style.background).toContain('radial-gradient');
  expect(style.shader).toContain('vec3 obsidian=mix(vec3(.060,.078,.105)');
  expect(['webgl1','canvas2d']).toContain(style.renderer);
  await page.locator('#mhBackToPeople').click();
  await expect(page.locator('#mhPlanetSurface')).toBeHidden({timeout:6000});
  await expect(page.locator('#gl')).toBeVisible();
});

test('V16 polish uses a compact financial dock and modular full research on Android',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events');
  const panel=page.locator('#mhHistoryPanel');
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveClass(/is-expanded/);
  await expect(panel.locator('.mh-panel-grip')).toBeVisible();
  await panel.locator('.mh-panel-grip').click();
  await expect(panel).toHaveClass(/is-expanded/);
  await expect(panel.locator('.mh-v16-research-card')).toHaveCount(5);
  const layout=await panel.evaluate(node=>({
    height:node.getBoundingClientRect().height,viewport:window.innerHeight,
    overflow:getComputedStyle(node).overflowY
  }));
  expect(layout.height).toBeLessThanOrEqual(layout.viewport*.68);
  expect(layout.overflow).toBe('auto');
  await panel.locator('.mh-panel-grip').click();
  await expect(panel).not.toHaveClass(/is-expanded/);
});

test('V16 visual reference screenshots, with no V17 changes',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const size of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
    await page.setViewportSize(size);
    await page.goto('/?mm=events');
    await expect(page.locator('#mhPlanetSurface')).toBeVisible();
    await page.screenshot({path:'test-results/v16-polish-event-'+size.width+'x'+size.height+'.png',animations:'disabled'});
    if(size.width<820){
      await page.locator('#mhHistoryPanel .mh-panel-grip').click();
      await page.screenshot({path:'test-results/v16-polish-research-'+size.width+'x'+size.height+'.png',animations:'disabled'});
    }
    await page.goto('/?mm=connections');
    await page.screenshot({path:'test-results/v16-polish-connections-'+size.width+'x'+size.height+'.png',animations:'disabled'});
  }
});
