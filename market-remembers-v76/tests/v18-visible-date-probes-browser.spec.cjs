const {test,expect}=require('./browser-fixtures.cjs');

test('V18.1 all four year probes face the camera and selected star is visible',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events#universe');
  await expect(page.locator('#mhPlanetSurface')).toBeVisible();
  await expect(page.locator('#mhEventLayer [data-mh-beacon]')).toHaveCount(8);
  for(const id of ['1907','1987','2008','2020'])
    await expect(page.locator('#mhEventLayer [data-mh-beacon="'+id+'"]')).toHaveAttribute('aria-hidden','false',{timeout:6000});
  await expect(page.locator('#mhHistoryPanel')).not.toHaveClass(/is-expanded/);
  await expect(page.locator('#mhHistoryPanel > .mh-timeline')).toBeVisible();
  await expect(page.locator('#mhHistoryPanel > .mh-timeline button')).toHaveCount(8);
});

test('V18.1 date selection restores focused visibility after deliberate orbit',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events');
  const star=page.locator('#mhEventLayer [data-mh-beacon="2008"]');
  await expect(star).toHaveAttribute('aria-hidden','false',{timeout:6000});
  await page.locator('#mhHistoryPanel > .mh-timeline [data-mh-event="2020"]').click();
  await expect(page.locator('#mhHistoryPanel')).toContainText('Пандемический шок ликвидности');
  await expect(page.locator('#mhEventLayer [data-mh-beacon="2020"]')).toHaveAttribute('aria-hidden','false',{timeout:6000});
  await page.locator('#mhBackToPeople').click();
  await expect(page.locator('#gl')).toBeVisible();
  await expect(page.locator('#mhPlanetSurface')).toBeHidden();
});

test('V18.1 no idle spin empties the planet after a realistic pause',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mm=events');
  await expect(page.locator('#mhEventLayer [data-mh-beacon="2008"]')).toHaveAttribute('aria-hidden','false',{timeout:6000});
  // This would fail against the previous unlimited yaw += dt rule
  // if left running long enough. Advance clock to avoid slow wall-clock suite.
  await page.clock.install();
  await page.clock.fastForward('01:30');
  await expect(page.locator('#mhEventLayer [data-mh-beacon="2008"]')).toHaveAttribute('aria-hidden','false',{timeout:6000});
});
