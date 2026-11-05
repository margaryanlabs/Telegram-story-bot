const {test,expect}=require('./browser-fixtures.cjs');

test('V19 eight sourced events appear in one uncluttered PEOPLE-style globe',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events#universe');
  await expect(page.locator('#mhPlanetSurface')).toBeVisible();
  await expect(page.locator('#mhEventLayer [data-mh-beacon]')).toHaveCount(8);
  await expect(page.locator('#mhEventLayer .mh-beacon.is-featured')).toHaveCount(4);
  await expect(page.locator('#mhEventLayer .mh-beacon.is-archive')).toHaveCount(4);
  const panel=page.locator('#mhHistoryPanel');
  await expect(panel).not.toHaveClass(/is-expanded/);
  await expect(panel.locator(':scope > .mh-timeline button')).toHaveCount(8);
  await expect(panel.locator('.mh-event-peek')).toContainText('15 SEP');
  expect(await page.evaluate(()=>window.MarketHistoryModes?.events.length)).toBe(8);
});

test('V19 select 2023 from rail, show historic metric, then explore chronology and sources',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events');
  const panel=page.locator('#mhHistoryPanel');
  await panel.locator('.mh-timeline [data-mh-event="2023"]').click();
  await expect(panel).not.toHaveClass(/is-expanded/);
  await expect(panel.locator('.mh-panel-grip')).toContainText('Silicon Valley Bank');
  await expect(panel.locator('.mh-event-peek')).toContainText('$42 млрд');
  await expect(page.locator('#mhEventLayer [data-mh-beacon="2023"]')).toHaveClass(/is-active/);
  await panel.locator('.mh-panel-grip').click();
  await expect(panel).toHaveClass(/is-expanded/);
  await expect(panel.locator('.mh-v16-research-card')).toHaveCount(5);
  await expect(panel.locator('.mh-chronicle-step')).toHaveCount(3);
  await expect(panel).toContainText('МЕХАНИЗМ ЗАРАЖЕНИЯ');
  await expect(panel).toContainText('РЕАКЦИЯ РЫНКОВ');
  await expect(panel.locator('.mh-v16-card-footer a')).toHaveAttribute('href',/^https:\/\/www\.fdic\.gov/);
});

test('V19 thematic parallels are bounded and return to original PEOPLE',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events&event=1998');
  const panel=page.locator('#mhHistoryPanel');
  await panel.locator('.mh-panel-grip').click();
  await panel.locator('[data-mh-go-connections]').click();
  await expect(panel).toContainText('ИСТОРИЧЕСКИЕ ПАРАЛЛЕЛИ');
  expect(await panel.locator('.mh-v16-related-card').count()).toBeLessThanOrEqual(4);
  await page.locator('#mhBackToPeople').click();
  await expect(page.locator('#gl')).toBeVisible();
  await expect(page.locator('#mhPlanetSurface')).toBeHidden();
});

test('V19 visual captures in short and tall Android viewport and desktop',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const vp of [{width:390,height:560},{width:390,height:844},{width:1280,height:800}]){
    await page.setViewportSize(vp);
    await page.goto('/?mm=events');
    await expect(page.locator('#mhPlanetSurface')).toBeVisible();
    await page.screenshot({path:'test-results/v19-globe-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
    if(vp.width<820) await page.locator('#mhHistoryPanel .mh-panel-grip').click();
    await page.screenshot({path:'test-results/v19-chronicle-'+vp.width+'x'+vp.height+'.png',animations:'disabled'});
  }
});
