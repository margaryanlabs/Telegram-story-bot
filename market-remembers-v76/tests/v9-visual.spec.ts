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

test('R4: born star gathers, persists locally, and can be reopened after reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('#heroCreate').click();
 await expect(page.locator('#createForm')).toBeVisible();
 await page.locator('#alias').fill('MY V9 STAR');
 await page.locator('#market').selectOption('CRYPTO');
 await page.locator('#category').selectOption('Risk');
 await page.locator('#quote').fill('I learned that preservation is more important than prediction.');
 await page.locator('#story').fill('I wrote the rule before entering the trade.');
 await page.locator('#rule').fill('Never risk money that I cannot afford to lose.');
 await page.locator('#localConsent').check();
 await page.locator('#createForm button[type="submit"]').click();
 await expect(page.locator('#birthOverlay')).toBeVisible({timeout:9000});
 await expect(page.locator('#birthName')).toContainText('@MY V9 STAR');
 await page.screenshot({path:'test-results/v9-r4-star-birth-mobile.png',animations:'disabled'});
 const local=await page.evaluate(()=>{
  const records=JSON.parse(localStorage.getItem('veto-market-remembers-demo-v4')||'[]');
  return records.at(-1)||null;
 });
 expect(local).not.toBeNull();
 expect(local.alias).toBe('MY V9 STAR');
 expect(local.local).toBe(true);
 expect(local.id).toMatch(/^local-/);
 expect(local.p).toHaveLength(3);
 await page.locator('#birthContinue').click();
 await expect(page.locator('#birthOverlay')).toBeHidden();
 await expect(page.locator('#dockAlias')).toContainText('MY V9 STAR');
 await page.reload();
 await page.locator('.mobile-nav [data-open="archive"]').click();
 await page.locator('#archiveFilters button[data-archive-filter="Mine"]').click();
 await expect(page.locator('.archive-grid')).toContainText('MY V9 STAR');
 await page.locator('.archive-grid button').filter({hasText:'MY V9 STAR'}).click();
 await expect(page.locator('#drawer')).toBeVisible({timeout:6000});
 await expect(page.locator('.v93-observatory-alias')).toContainText('MY V9 STAR');
});
test('R4: storage denial does not falsely show a successful birth',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    if(key==='veto-market-remembers-demo-v4')throw new DOMException('Blocked','QuotaExceededError');
    return original.call(this,key,value);
  };
 });
 await page.goto('/');
 await page.locator('#heroCreate').click();
 await page.locator('#alias').fill('PRIVATE TEST');
 await page.locator('#quote').fill('This record must remain unsaved if storage is blocked.');
 await page.locator('#rule').fill('Only report a successful birth after a successful write.');
 await page.locator('#localConsent').check();
 await page.locator('#createForm button[type="submit"]').click();
 await expect(page.locator('#createForm')).toBeVisible();
 await expect(page.locator('#birthOverlay')).toBeHidden();
 await expect(page.locator('#toast')).toContainText('Не удалось сохранить');
});
test('R4: reduced motion still saves the star and opens the success dialog',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await page.locator('#heroCreate').click();
 await page.locator('#alias').fill('STILL STAR');
 await page.locator('#quote').fill('Every decision needs a clearly articulated risk.');
 await page.locator('#rule').fill('Write the rule before I take a position.');
 await page.locator('#localConsent').check();
 await page.locator('#createForm button[type="submit"]').click();
 await expect(page.locator('#birthOverlay')).toBeVisible();
 await expect(page.locator('#v94BirthField')).toBeHidden();
 await page.locator('#birthContinue').click();
 await expect(page.locator('#birthOverlay')).toBeHidden();
 await expect(page.locator('#dockAlias')).toContainText('STILL STAR');
});

test('V9 release QA is hidden in normal visits and opt-in on-device',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('#qaPanel')).toBeHidden();
 await page.goto('/?qa=1');
 await expect(page.locator('#qaPanel')).toBeVisible();
 await expect(page.locator('#qaStatus')).toContainText('Renderer:');
 await expect(page.locator('#qaStatus')).toContainText('Viewport: 390 × 844');
 await expect(page.locator('#qaStatus')).toContainText('Graphics:');
 await page.screenshot({path:'test-results/v9-device-qa-390x844.png',animations:'disabled'});
 await page.locator('#qaPanel summary').click();
 await expect(page.locator('#qaPanel')).toBeVisible();
});
test('V9 device QA does not leak private story text to its local status snapshot',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('veto-market-remembers-demo-v4',JSON.stringify([{
   local:true,id:'local-safe-check',alias:'TOP SECRET NAME',
   quote:'PRIVATE TEXT MUST NOT DISPLAY IN QA',
   story:'PRIVATE STORY MUST NOT DISPLAY IN QA',
   rule:'KEEP LOCAL',p:[0,0,1],market:'CRYPTO',category:'Risk',
   type:'local',createdAt:new Date().toISOString()
  }]));
 });
 await page.goto('/?qa=1');
 const report=await page.locator('#qaStatus').innerText();
 expect(report).not.toContain('TOP SECRET NAME');
 expect(report).not.toContain('PRIVATE TEXT');
 expect(report).not.toContain('PRIVATE STORY');
 expect(report).not.toContain('local-safe-check');
});
