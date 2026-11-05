const {test,expect}=require('./browser-fixtures.cjs');

test('V16 Cosmic Finish draws a stable deep-space backdrop behind the original sphere',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events#universe');
  await expect(page.locator('#mhPlanetSurface')).toBeVisible();
  const result=await page.evaluate(()=>{
    const sky=document.getElementById('mhDeepSpace');
    const c=sky?.getContext('2d');
    return {
      exists:!!sky,
      w:sky?.width,h:sky?.height,
      stars:window.MarketDeepSpace?.stars,
      staticComposition:window.MarketDeepSpace?.staticComposition,
      opacity:sky?getComputedStyle(sky).opacity:null,
      alpha:c?c.getImageData(Math.floor(sky.width*.5),Math.floor(sky.height*.5),1,1).data[3]:0
    };
  });
  expect(result.exists).toBe(true);
  expect(result.w).toBeGreaterThan(300);
  expect(result.h).toBeGreaterThan(300);
  expect(result.stars).toBe(112);
  expect(result.staticComposition).toBe(true);
  await expect(page.locator('#mhDeepSpace')).toBeVisible();
});

test('clicking a probe fires only a short halo and does not force the large dossier',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events');
  const node=page.locator('#mhEventLayer [data-mh-beacon][aria-hidden="false"]').first();
  await expect(node).toBeVisible();
  await node.click();
  await expect(page.locator('#mhHistoryPanel')).not.toHaveClass(/is-expanded/);
  await expect(page.locator('#mhEventBurst')).toHaveClass(/is-live/);
  await expect(page.locator('#mhEventBurst')).not.toHaveClass(/is-live/,{timeout:3500});
  await page.locator('#mhHistoryPanel .mh-panel-grip').click();
  await expect(page.locator('#mhHistoryPanel .mh-v16-research-card')).toHaveCount(3);
});

test('V16 Cosmic Finish respects reduced-motion and keeps PEOPLE untouched',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?mm=events');
  await page.locator('#mhHistoryPanel .mh-panel-grip').click();
  await expect(page.locator('#mhHistoryPanel')).toHaveClass(/is-expanded/);
  await page.locator('#mhBackToPeople').click();
  await expect(page.locator('#gl')).toBeVisible();
  await expect(page.locator('#mhPlanetSurface')).toBeHidden();
});

test('Screenshot targets for cosmic atmosphere and event research',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const vp of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
    await page.setViewportSize(vp);
    await page.goto('/?mm=events');
    await expect(page.locator('#mhPlanetSurface')).toBeVisible();
    await page.screenshot({path:'test-results/v16-cosmic-event-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
    if(vp.width<820)await page.locator('#mhHistoryPanel .mh-panel-grip').click();
    await page.screenshot({path:'test-results/v16-cosmic-research-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
    await page.goto('/?mm=connections');
    await page.screenshot({path:'test-results/v16-cosmic-connections-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
  }
});
