const {test,expect}=require('./browser-fixtures.cjs');
test('WebKit small phone, tablet and landscape composition',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:760,height:420},{width:768,height:1024}]){
  await page.setViewportSize(viewport);await page.goto('/');await expect(page.locator('#scene')).toBeVisible();
  expect(await page.evaluate(()=>document.body.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await expect(page.locator('#dockOpen')).toBeVisible();
 }
 expect(errors).toEqual([]);
});
test('WebKit four chapters, scroll, keyboard trap and return',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#story/1');
 await expect(page.locator('.v10-chapter')).toHaveCount(2);await page.locator('[data-v10-chapter="1"]').click();
 await expect(page.locator('[data-v10-chapter="1"]')).toHaveAttribute('aria-current','step');
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.locator('#drawer').evaluate(el=>el.contains(document.activeElement))).toBe(true);}
 await page.locator('.v93-back-to-star').click();await expect(page.locator('#drawer')).toBeHidden();await expect(page.locator('#dockAlias')).toContainText('NORTHSTAR');
});
test('WebKit archive URL restores search and locates the same star',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#archive');await page.locator('#archiveSearch').fill('MIRA');
 await expect(page.locator('.v10-archive-row')).toHaveCount(1);await page.locator('#v10ArchiveSort').selectOption('alias');await page.reload();
 await expect(page.locator('#archiveSearch')).toHaveValue('MIRA');await expect(page.locator('#v10ArchiveSort')).toHaveValue('alias');
 await page.locator('.v10-locate-star').tap();await expect(page.locator('#dockAlias')).toContainText('MIRA');await page.goBack();await expect(page.locator('#archiveSearch')).toHaveValue('MIRA');
});
test('WebKit private story is saved only after review and survives reload',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#create');
 const values={alias:'WEBKIT MEMORY',before:'Before a difficult decision in the market.',decision:'I reduced the position and recorded my reasoning.',consequences:'The decision gave me space to think clearly.'};
 for(const [id,text] of Object.entries(values)){await page.locator('#'+id).fill(text);await page.locator('#v10FormNext').click();}
 await page.locator('#quote').fill('The time to decide is before emotions take over.');await page.locator('#rule').fill('I always document my risk before entering.');await page.locator('#v10FormNext').click();
 await expect(page.locator('#v10LegacyReview')).toContainText('WEBKIT MEMORY');await expect(page.locator('#birthOverlay')).toBeHidden();
 await page.locator('#localConsent').check();await page.locator('#v10FormSave').tap();await expect(page.locator('#birthOverlay')).toBeVisible();
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('veto-market-remembers-demo-v4'))[0].id);
 await page.goto('/#story/'+id);await page.reload();await expect(page.locator('[data-chapter=decision]')).toContainText('reduced the position');
});
