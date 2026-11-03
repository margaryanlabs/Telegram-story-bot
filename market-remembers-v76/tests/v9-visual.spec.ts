import {test,expect} from '@playwright/test';

const viewports=[
 {width:320,height:568},
 {width:390,height:844},
 {width:760,height:420},
 {width:768,height:1024},
 {width:1440,height:900},
];
for(const viewport of viewports){
 test('first-open cinematic composition '+viewport.width+'x'+viewport.height,async({page})=>{
   await page.setViewportSize(viewport);
   const errors:string[]=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('/');
   await expect(page.locator('#scene')).toBeVisible();
   await expect(page.locator('.hero h1')).toContainText('MARKET');
   await expect(page.locator('#globeScale')).toBeVisible();
   await expect(page.locator('#v81Aura')).toHaveCSS('display','none');
   await expect(page.locator('#energySweep')).toHaveCSS('display','none');
   const selected=page.locator(viewport.width<820?'#signalDock':'#selectedCard');
   await expect(selected).toBeVisible();
   await page.screenshot({
     path:'test-results/v9-first-open-'+viewport.width+'x'+viewport.height+'.png',
     animations:'disabled'
   });
   expect(errors).toEqual([]);
 });
}
test('chosen star passage can be skipped to its actual reader',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 await expect(page.locator('#v9PassageStatus')).toContainText('ЗВЕЗДА');
 await page.locator('#cancelDive').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('#drawer')).toHaveClass(/memory-detail/);
 await expect(page.locator('#drawerContents')).toContainText('NORTHSTAR');
 await page.locator('#closeDrawer').click();
 await expect(page.locator('#drawer')).toBeHidden();
});
test('ESC cancels a flight without opening the memory drawer',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#memoryDive')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#memoryDive')).toBeHidden();
 await expect(page.locator('#drawer')).toBeHidden();
});
test('reduced motion goes straight to a real memory',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('#memoryDive')).toBeHidden();
});
test('archive search keyboard does not remesh a covered sphere',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('.mobile-nav [data-open="archive"]').click();
 await expect(page.locator('#archiveSearch')).toBeVisible();
 await page.locator('#archiveSearch').fill('Risk');
 await expect(page.locator('#archiveResultStatus')).toContainText('ИЗ');
 await page.locator('#closeDrawer').click();
 await expect(page.locator('#scene')).toBeVisible();
});

test('observatory reader preserves the selected star through entry and return',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 await expect(page.locator('.v93-observatory-alias')).toContainText('NORTHSTAR');
 await expect(page.locator('.v93-observatory-kind')).toContainText('ВЫМЫШЛЕННАЯ');
 await expect(page.locator('.v93-reader-stage')).toContainText('КОНТЕКСТ');
 await expect(page.locator('.v93-back-to-star')).toHaveAttribute('aria-label',/выбранной звезде/);
 await page.screenshot({path:'test-results/v9-memory-observatory-mobile.png',animations:'disabled'});
 await page.locator('.v93-back-to-star').click();
 await expect(page.locator('#drawer')).toBeHidden();
 await expect(page.locator('#dockAlias')).toContainText('NORTHSTAR');
});
test('reading room remains usable at narrow 320px viewport',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 const bodyWidth=await page.locator('body').evaluate(el=>el.scrollWidth);
 expect(bodyWidth).toBeLessThanOrEqual(321);
 const back=page.locator('.v93-back-to-star');
 await expect(back).toBeVisible();
 const rect=await back.boundingBox();
 expect(rect?.height||0).toBeGreaterThanOrEqual(44);
});
test('reduced motion opens readable observatory instantly',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#dockOpen').click();
 await expect(page.locator('#drawer')).toBeVisible();
 await expect(page.locator('.v93-observatory')).toBeVisible();
 await expect(page.locator('#memoryDive')).toBeHidden();
});
